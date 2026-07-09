"""规划 Agent 各 intent 分支（legacy / LangGraph 共用）。"""

from __future__ import annotations

from typing import Any

from app.workflow.helpers import build_generate_route_draft_payload, resolve_planning_city
from app.workflow.nodes.spans import append_node_span
from app.workflow.state import WorkflowContext
from app.workflow.streaming import call_node_tool_traced, emit_tool_start


def _template_config(state: WorkflowContext) -> dict[str, Any]:
    """
    读取当前会话已选工作流模板的 nodeConfig。

    @param state - 工作流上下文
    @returns nodeConfig 字典；无模板时为空 dict
    """
    return state.get("template_config") or {}


async def enrich_and_validate_draft(
    state: WorkflowContext,
    draft: dict[str, Any] | None,
    rag_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """
    retrieve_playbooks → enrich_route → validate_route。

    @param state - 工作流上下文
    @param draft - 待 enrich 的路线草稿
    @param rag_candidates - validate 用 RAG 候选
    @returns 校验后的 draft；无 intent 时原样返回
    """
    if not draft or not state.get("intent"):
        return draft

    intent = state["intent"] or {}
    city = resolve_planning_city(intent) or draft.get("matchedCity")

    tpl = _template_config(state)
    pb_data = await call_node_tool_traced(
        state,
        "retrieve_playbooks",
        {
            "city": city,
            "themes": intent.get("themes"),
            "prompt": state.get("prompt"),
            "limit": tpl.get("playbookLimit"),
        },
    )
    playbooks = pb_data.get("playbooks") or []
    trace = state.get("tool_trace") or []
    if trace and trace[-1].get("tool") == "retrieve_playbooks":
        trace[-1]["matchedPlaybookIds"] = pb_data.get("matchedPlaybookIds") or [
            item.get("playbook", {}).get("id")
            for item in playbooks
            if isinstance(item, dict) and item.get("playbook", {}).get("id")
        ]

    enriched_data = await call_node_tool_traced(
        state,
        "enrich_route",
        {
            "draft": draft,
            "intent": intent,
            "locale": state["locale"],
            "playbooks": playbooks,
        },
    )
    draft = enriched_data.get("draft", draft)

    validated_data = await call_node_tool_traced(
        state,
        "validate_route",
        {
            "draft": draft,
            "locale": state["locale"],
            "ragCandidates": rag_candidates or [],
            "autoFix": True,
        },
    )
    return validated_data.get("draft", draft)


async def run_tweak_branch(state: WorkflowContext, routed: dict[str, Any]) -> None:
    """tweak_day / tweak_poi：patch_route_day → enrich → validate。"""
    day_index = routed.get("dayIndex")
    exclude_names = routed.get("excludePoiNames") or []
    if day_index is None and not exclude_names:
        return

    patch_payload: dict[str, Any] = {
        "draft": state["current_draft"],
        "intent": state["intent"],
        "locale": state["locale"],
        "relaxed": bool(routed.get("relaxed")),
        "prompt": state["prompt"],
    }
    if day_index is not None:
        patch_payload["dayIndex"] = day_index
    if exclude_names:
        patch_payload["excludeNames"] = exclude_names

    patch_data = await call_node_tool_traced(state, "patch_route_day", patch_payload)
    state["draft"] = await enrich_and_validate_draft(state, patch_data.get("draft"))
    state["assistant_hint"] = "已局部调整指定天行程"


async def run_budget_tune_branch(state: WorkflowContext) -> None:
    """budget_tune：tune_route_budget → enrich → validate。"""
    if not state.get("current_draft"):
        return

    tuned = await call_node_tool_traced(
        state,
        "tune_route_budget",
        {
            "draft": state["current_draft"],
            "intent": state["intent"],
            "locale": state["locale"],
        },
    )
    state["draft"] = await enrich_and_validate_draft(state, tuned.get("draft"))
    state["assistant_hint"] = "已按新预算调整方案"


async def run_lodging_tune_branch(state: WorkflowContext) -> None:
    """lodging_tune：enrich → validate。"""
    if not state.get("current_draft"):
        return

    state["draft"] = await enrich_and_validate_draft(state, state["current_draft"])
    state["assistant_hint"] = "已按住宿偏好更新住店安排"


async def run_qa_food_branch(state: WorkflowContext) -> None:
    """qa_food：answer_food_qa。"""
    qa_data = await call_node_tool_traced(
        state,
        "answer_food_qa",
        {
            "intent": state["intent"],
            "prompt": state["prompt"],
            "locale": state["locale"],
            "userId": state["user_id"],
        },
    )
    state["assistant_message"] = qa_data.get("assistantMessage")


async def run_select_variant_branch(state: WorkflowContext) -> None:
    """select_variant：select_plan_variant。"""
    session_id = state.get("session_id")
    if not session_id:
        return

    select_data = await call_node_tool_traced(
        state,
        "select_plan_variant",
        {
            "sessionId": session_id,
            "userId": state["user_id"],
            "prompt": state["prompt"],
            "locale": state["locale"],
        },
    )
    route_id = select_data.get("routeId")
    if isinstance(route_id, int):
        state["selected_route_id"] = route_id
    state["assistant_message"] = select_data.get("assistantMessage")


async def run_plan_new_branch(state: WorkflowContext) -> None:
    """plan_new / 默认：选模板 → RAG → variants → generate → enrich → validate。"""
    preselected = bool(state.get("_template_preselected") or state.get("template_id"))

    if not preselected:
        sel_data = await call_node_tool_traced(
            state,
            "select_workflow_template",
            {
                "userId": state["user_id"],
                "intent": state.get("intent") or {},
                "routedIntent": state.get("routed_intent"),
            },
        )
        state["template_id"] = sel_data.get("templateId")
        state["template_config"] = sel_data.get("nodeConfig") or {}
        trace = state.get("tool_trace") or []
        if trace and trace[-1].get("tool") == "select_workflow_template":
            trace[-1]["inputDigest"] = sel_data.get("inputDigest")
            trace[-1]["outputDigest"] = sel_data.get("outputDigest")
    else:
        emit_tool_start(state, "select_workflow_template")
        append_node_span(state, "select_workflow_template", True, 0, source="preselected")

    tpl = _template_config(state)
    rag_payload: dict[str, Any] = {
        "city": resolve_planning_city(state["intent"] or {}),
        "themes": (state["intent"] or {}).get("themes"),
        "prompt": state["prompt"],
        "days": (state["intent"] or {}).get("days"),
        "userId": state["user_id"],
    }
    if tpl.get("topK") is not None:
        rag_payload["limit"] = tpl.get("topK")
    if tpl.get("mmrLambda") is not None:
        rag_payload["mmrLambda"] = tpl.get("mmrLambda")

    rag_data = await call_node_tool_traced(state, "retrieve_attractions", rag_payload)
    rag_candidates = rag_data.get("candidates") or []
    trace = state.get("tool_trace") or []
    if trace and trace[-1].get("tool") == "retrieve_attractions":
        trace[-1]["ragMatchedIds"] = rag_data.get("matchedIds") or [
            c.get("id") for c in rag_candidates if isinstance(c.get("id"), int)
        ]
        trace[-1]["ragScoreSummary"] = rag_data.get("ragScoreSummary")

    is_first_plan = not state.get("current_draft")
    skip_variants = bool(tpl.get("skipVariants"))
    if is_first_plan and not skip_variants:
        variant_payload: dict[str, Any] = {
            "intent": state["intent"],
            "locale": state["locale"],
            "userId": state["user_id"],
        }
        if tpl.get("variantCount") is not None:
            variant_payload["candidateCount"] = tpl.get("variantCount")
        variants_data = await call_node_tool_traced(state, "build_route_variants", variant_payload)
        variants = variants_data.get("variants") or []

        candidates: list[dict[str, Any]] = []
        for variant in variants:
            sort_order = int(variant.get("sortOrder") or 0)
            gen_data = await call_node_tool_traced(
                state,
                "generate_route_draft",
                build_generate_route_draft_payload(
                    state,
                    rag_candidates,
                    variant_key=variant.get("key"),
                    variant_hint=variant.get("hint"),
                    rag_variant_index=sort_order,
                ),
            )
            draft = gen_data.get("draft")
            finalized = await enrich_and_validate_draft(state, draft, rag_candidates)
            if finalized:
                candidates.append(
                    {
                        "draft": finalized,
                        "variantKey": variant.get("key"),
                        "label": variant.get("label"),
                        "sortOrder": sort_order,
                    }
                )

        if candidates:
            state["draft"] = candidates[0]["draft"]
            state["candidates"] = candidates
        return

    gen_data = await call_node_tool_traced(
        state,
        "generate_route_draft",
        build_generate_route_draft_payload(state, rag_candidates),
    )
    draft = gen_data.get("draft")
    state["draft"] = await enrich_and_validate_draft(state, draft, rag_candidates)
