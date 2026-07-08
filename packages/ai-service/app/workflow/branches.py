"""规划 Agent 各 intent 分支（legacy / LangGraph 共用）。"""

from __future__ import annotations

import time
from typing import Any

from app.tools.node_client import call_node_tool
from app.workflow.helpers import build_generate_route_draft_payload, resolve_planning_city
from app.workflow.nodes.spans import append_node_span
from app.workflow.state import WorkflowContext


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

    t_playbooks = time.time()
    pb_data = await call_node_tool(
        "retrieve_playbooks",
        {
            "city": city,
            "themes": intent.get("themes"),
            "prompt": state.get("prompt"),
        },
    )
    playbooks = pb_data.get("playbooks") or []
    pb_ms = int((time.time() - t_playbooks) * 1000)
    append_node_span(
        state,
        "retrieve_playbooks",
        True,
        pb_ms,
        matchedPlaybookIds=pb_data.get("matchedPlaybookIds")
        or [
            item.get("playbook", {}).get("id")
            for item in playbooks
            if isinstance(item, dict) and item.get("playbook", {}).get("id")
        ],
    )

    t_enrich = time.time()
    enriched_data = await call_node_tool(
        "enrich_route",
        {
            "draft": draft,
            "intent": intent,
            "locale": state["locale"],
            "playbooks": playbooks,
        },
    )
    draft = enriched_data.get("draft", draft)
    enrich_ms = int((time.time() - t_enrich) * 1000)
    append_node_span(state, "enrich_route", True, enrich_ms)

    t_validate = time.time()
    validated_data = await call_node_tool(
        "validate_route",
        {
            "draft": draft,
            "locale": state["locale"],
            "ragCandidates": rag_candidates or [],
            "autoFix": True,
        },
    )
    draft = validated_data.get("draft", draft)
    validate_ms = int((time.time() - t_validate) * 1000)
    append_node_span(state, "validate_route", True, validate_ms)
    return draft


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

    t_patch = time.time()
    patch_data = await call_node_tool("patch_route_day", patch_payload)
    append_node_span(state, "patch_route_day", True, int((time.time() - t_patch) * 1000))
    state["draft"] = await enrich_and_validate_draft(state, patch_data.get("draft"))
    state["assistant_hint"] = "已局部调整指定天行程"


async def run_budget_tune_branch(state: WorkflowContext) -> None:
    """budget_tune：tune_route_budget → enrich → validate。"""
    if not state.get("current_draft"):
        return

    t_tune = time.time()
    tuned = await call_node_tool(
        "tune_route_budget",
        {
            "draft": state["current_draft"],
            "intent": state["intent"],
            "locale": state["locale"],
        },
    )
    append_node_span(state, "tune_route_budget", True, int((time.time() - t_tune) * 1000))
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
    t_qa = time.time()
    qa_data = await call_node_tool(
        "answer_food_qa",
        {
            "intent": state["intent"],
            "prompt": state["prompt"],
            "locale": state["locale"],
            "userId": state["user_id"],
        },
    )
    append_node_span(state, "answer_food_qa", True, int((time.time() - t_qa) * 1000))
    state["assistant_message"] = qa_data.get("assistantMessage")


async def run_select_variant_branch(state: WorkflowContext) -> None:
    """select_variant：select_plan_variant。"""
    session_id = state.get("session_id")
    if not session_id:
        return

    t_select = time.time()
    select_data = await call_node_tool(
        "select_plan_variant",
        {
            "sessionId": session_id,
            "userId": state["user_id"],
            "prompt": state["prompt"],
            "locale": state["locale"],
        },
    )
    append_node_span(state, "select_plan_variant", True, int((time.time() - t_select) * 1000))
    route_id = select_data.get("routeId")
    if isinstance(route_id, int):
        state["selected_route_id"] = route_id
    state["assistant_message"] = select_data.get("assistantMessage")


async def run_plan_new_branch(state: WorkflowContext) -> None:
    """plan_new / 默认：RAG → variants → generate → enrich → validate。"""
    t_rag = time.time()
    rag_data = await call_node_tool(
        "retrieve_attractions",
        {
            "city": resolve_planning_city(state["intent"] or {}),
            "themes": (state["intent"] or {}).get("themes"),
            "prompt": state["prompt"],
            "days": (state["intent"] or {}).get("days"),
            "userId": state["user_id"],
        },
    )
    rag_candidates = rag_data.get("candidates") or []
    rag_ms = int((time.time() - t_rag) * 1000)
    append_node_span(
        state,
        "retrieve_attractions",
        True,
        rag_ms,
        ragMatchedIds=rag_data.get("matchedIds")
        or [c.get("id") for c in rag_candidates if isinstance(c.get("id"), int)],
        ragScoreSummary=rag_data.get("ragScoreSummary"),
    )

    is_first_plan = not state.get("current_draft")
    if is_first_plan:
        t_var = time.time()
        variants_data = await call_node_tool(
            "build_route_variants",
            {
                "intent": state["intent"],
                "locale": state["locale"],
                "userId": state["user_id"],
            },
        )
        variants = variants_data.get("variants") or []
        append_node_span(state, "build_route_variants", True, int((time.time() - t_var) * 1000))

        candidates: list[dict[str, Any]] = []
        for variant in variants:
            sort_order = int(variant.get("sortOrder") or 0)
            t_gen = time.time()
            gen_data = await call_node_tool(
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
            append_node_span(state, "generate_route_draft", True, int((time.time() - t_gen) * 1000))
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

    t_gen = time.time()
    gen_data = await call_node_tool(
        "generate_route_draft",
        build_generate_route_draft_payload(state, rag_candidates),
    )
    draft = gen_data.get("draft")
    append_node_span(state, "generate_route_draft", True, int((time.time() - t_gen) * 1000))
    state["draft"] = await enrich_and_validate_draft(state, draft, rag_candidates)
