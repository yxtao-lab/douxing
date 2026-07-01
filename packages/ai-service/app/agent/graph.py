"""LangGraph Supervisor 规划 Agent（C7-a/b POC）。"""

from __future__ import annotations

import time
from typing import Any, TypedDict

from app.tools.node_client import call_node_tool, call_route_intent
from app.agent.memory_agent import apply_memory_context_to_intent, run_memory_agent


class PlanAgentState(TypedDict, total=False):
    prompt: str
    user_id: int
    session_id: int | None
    history: list[dict[str, str]]
    days: int | None
    budget: str | None
    locale: str
    provider: str | None
    current_draft: dict[str, Any] | None
    intent: dict[str, Any] | None
    draft: dict[str, Any] | None
    candidates: list[dict[str, Any]]
    tool_trace: list[dict[str, Any]]
    routed: dict[str, Any]
    routed_intent: str
    assistant_hint: str | None
    assistant_message: str | None
    selected_route_id: int | None
    memories: list[dict[str, Any]]
    memory_summary: str | None
    memory_context: dict[str, Any] | None
    recall_explain: list[dict[str, Any]]


def _resolve_planning_city(intent: dict) -> str | None:
    city = intent.get("city")
    departure = intent.get("departureCity")
    suggested = intent.get("suggestedDestinations") or []
    if city and departure and city == departure:
        for item in suggested:
            if item != departure:
                return item
        return None
    if city:
        return city
    if suggested:
        return suggested[0]
    cities = intent.get("cities") or []
    if cities:
        return cities[0]
    return None


def _build_generate_route_draft_payload(
    state: PlanAgentState,
    rag_candidates: list[dict[str, Any]],
    *,
    variant_key: str | None = None,
    variant_hint: str | None = None,
    rag_variant_index: int | None = None,
) -> dict[str, Any]:
    """
    组装 generate_route_draft 入参；days/budget 优先会话字段，否则回退 intent。

    @param state - Agent 状态
    @param rag_candidates - RAG 候选景点
    @param variant_key - 方案变体键；首屏多候选时传入
    @param variant_hint - 变体提示文案
    @param rag_variant_index - RAG 轮换索引
    @returns 可直接传给 Node Tool API 的字典（`None` 由 node_client 剔除）
    """
    intent = state.get("intent") or {}
    days = state.get("days")
    if days is None:
        days = intent.get("days")
    budget = state.get("budget")
    if budget is None:
        budget = intent.get("budget")

    payload: dict[str, Any] = {
        "prompt": state["prompt"],
        "days": days,
        "budget": budget,
        "provider": state.get("provider") or "auto",
        "locale": state["locale"],
        "intent": state["intent"],
        "ragCandidates": rag_candidates,
        "userId": state["user_id"],
    }
    if variant_key:
        payload["variantKey"] = variant_key
    if variant_hint:
        payload["variantHint"] = variant_hint
    if rag_variant_index is not None:
        payload["ragVariantIndex"] = rag_variant_index
    return payload


async def _enrich_and_validate_draft(
    state: PlanAgentState,
    draft: dict[str, Any] | None,
    rag_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """与管道一致：generate/patch/tune 后必须 enrich_route → validate_route。"""
    if not draft or not state.get("intent"):
        return draft

    t_enrich = time.time()
    enriched_data = await call_node_tool(
        "enrich_route",
        {
            "draft": draft,
            "intent": state["intent"],
            "locale": state["locale"],
        },
    )
    draft = enriched_data.get("draft", draft)
    state["tool_trace"].append(
        {"tool": "enrich_route", "ok": True, "ms": int((time.time() - t_enrich) * 1000)}
    )

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
    state["tool_trace"].append(
        {"tool": "validate_route", "ok": True, "ms": int((time.time() - t_validate) * 1000)}
    )
    return draft


async def _run_tweak_branch(state: PlanAgentState, routed: dict[str, Any]) -> None:
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
    state["tool_trace"].append(
        {"tool": "patch_route_day", "ok": True, "ms": int((time.time() - t_patch) * 1000)}
    )
    state["draft"] = await _enrich_and_validate_draft(state, patch_data.get("draft"))
    state["assistant_hint"] = "已局部调整指定天行程"


async def _run_budget_tune_branch(state: PlanAgentState) -> None:
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
    state["tool_trace"].append(
        {"tool": "tune_route_budget", "ok": True, "ms": int((time.time() - t_tune) * 1000)}
    )
    state["draft"] = await _enrich_and_validate_draft(state, tuned.get("draft"))
    state["assistant_hint"] = "已按新预算调整方案"


async def _run_lodging_tune_branch(state: PlanAgentState) -> None:
    if not state.get("current_draft"):
        return

    state["draft"] = await _enrich_and_validate_draft(state, state["current_draft"])
    state["assistant_hint"] = "已按住宿偏好更新住店安排"


async def _run_qa_food_branch(state: PlanAgentState) -> None:
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
    state["tool_trace"].append(
        {"tool": "answer_food_qa", "ok": True, "ms": int((time.time() - t_qa) * 1000)}
    )
    state["assistant_message"] = qa_data.get("assistantMessage")


async def _run_select_variant_branch(state: PlanAgentState) -> None:
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
    state["tool_trace"].append(
        {"tool": "select_plan_variant", "ok": True, "ms": int((time.time() - t_select) * 1000)}
    )
    route_id = select_data.get("routeId")
    if isinstance(route_id, int):
        state["selected_route_id"] = route_id
    state["assistant_message"] = select_data.get("assistantMessage")


async def _run_plan_new_branch(state: PlanAgentState) -> None:
    t_rag = time.time()
    rag_data = await call_node_tool(
        "retrieve_attractions",
        {
            "city": _resolve_planning_city(state["intent"] or {}),
            "themes": (state["intent"] or {}).get("themes"),
            "prompt": state["prompt"],
            "days": (state["intent"] or {}).get("days"),
            "userId": state["user_id"],
        },
    )
    rag_candidates = rag_data.get("candidates") or []
    state["tool_trace"].append(
        {"tool": "retrieve_attractions", "ok": True, "ms": int((time.time() - t_rag) * 1000)}
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
        state["tool_trace"].append(
            {
                "tool": "build_route_variants",
                "ok": True,
                "ms": int((time.time() - t_var) * 1000),
            }
        )

        candidates: list[dict[str, Any]] = []
        for variant in variants:
            sort_order = int(variant.get("sortOrder") or 0)
            t_gen = time.time()
            gen_data = await call_node_tool(
                "generate_route_draft",
                _build_generate_route_draft_payload(
                    state,
                    rag_candidates,
                    variant_key=variant.get("key"),
                    variant_hint=variant.get("hint"),
                    rag_variant_index=sort_order,
                ),
            )
            draft = gen_data.get("draft")
            state["tool_trace"].append(
                {
                    "tool": "generate_route_draft",
                    "ok": True,
                    "ms": int((time.time() - t_gen) * 1000),
                }
            )
            finalized = await _enrich_and_validate_draft(state, draft, rag_candidates)
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
        _build_generate_route_draft_payload(state, rag_candidates),
    )
    draft = gen_data.get("draft")
    state["tool_trace"].append(
        {"tool": "generate_route_draft", "ok": True, "ms": int((time.time() - t_gen) * 1000)}
    )
    state["draft"] = await _enrich_and_validate_draft(state, draft, rag_candidates)


async def run_plan_agent(request: dict[str, Any]) -> dict[str, Any]:
    from app.observability.langfuse_client import NOOP, agent_plan_trace

    prompt = request.get("prompt", "")
    user_id = int(request["userId"])
    session_id = request.get("sessionId")
    locale = request.get("locale") or "zh-CN"

    with agent_plan_trace(
        user_id=user_id,
        session_id=session_id,
        prompt=prompt,
        locale=locale,
    ) as trace:
        result = await _run_plan_agent_core(request, prompt)
        if trace is not NOOP:
            tool_trace = result.get("toolTrace") or []
            trace.update(
                output={
                    "routedIntent": result.get("routedIntent"),
                    "hasDraft": result.get("draft") is not None,
                    "toolCount": len(tool_trace),
                },
                metadata={
                    "tools": [entry.get("tool") for entry in tool_trace],
                    "totalMs": sum(int(entry.get("ms") or 0) for entry in tool_trace),
                },
            )
        return result


async def _run_plan_agent_core(request: dict[str, Any], prompt: str) -> dict[str, Any]:
    routed = await call_route_intent(prompt)
    route = routed.get("route", "unknown")

    state: PlanAgentState = {
        "prompt": prompt,
        "user_id": int(request["userId"]),
        "session_id": request.get("sessionId"),
        "history": request.get("history") or [],
        "days": request.get("days"),
        "budget": request.get("budget"),
        "locale": request.get("locale") or "zh-CN",
        "provider": request.get("provider"),
        "current_draft": request.get("currentDraft"),
        "tool_trace": [],
        "routed": routed,
        "routed_intent": route,
    }

    # 1. memory_agent：可解释召回 + context
    await run_memory_agent(state)

    # 2. 意图解析 — Node 已传入合并后的 intent 时直接沿用，避免追问丢失 exclude 等约束
    pre_intent = request.get("intent")
    if pre_intent:
        state["intent"] = pre_intent
        state["tool_trace"].append(
            {"tool": "parse_intent", "ok": True, "ms": 0, "source": "session"}
        )
    else:
        t1 = time.time()
        intent_data = await call_node_tool(
            "parse_intent",
            {
                "prompt": state["prompt"],
                "history": state["history"],
                "days": state["days"],
                "budget": state["budget"],
                "userId": state["user_id"],
            },
        )
        state["intent"] = intent_data.get("intent")
        state["tool_trace"].append(
            {"tool": "parse_intent", "ok": True, "ms": int((time.time() - t1) * 1000)}
        )

    # 3. 注入 memory context 到 intent（含 session 预填 intent）
    await apply_memory_context_to_intent(state)

    routed = state["routed"]
    route = state["routed_intent"]

    if route in {"tweak_day", "tweak_poi"} and state.get("current_draft"):
        await _run_tweak_branch(state, routed)
    elif route == "budget_tune" and state.get("current_draft"):
        await _run_budget_tune_branch(state)
    elif route == "lodging_tune" and state.get("current_draft"):
        await _run_lodging_tune_branch(state)
    elif route == "qa_food":
        await _run_qa_food_branch(state)
    elif route == "select_variant":
        await _run_select_variant_branch(state)
    else:
        await _run_plan_new_branch(state)

    return {
        "draft": state.get("draft"),
        "candidates": state.get("candidates"),
        "toolTrace": state["tool_trace"],
        "routedIntent": state["routed_intent"],
        "assistantHint": state.get("assistant_hint"),
        "assistantMessage": state.get("assistant_message"),
        "selectedRouteId": state.get("selected_route_id"),
        "memories": state.get("memories") or [],
        "memorySummary": state.get("memory_summary"),
        "recallExplain": state.get("recall_explain") or [],
    }
