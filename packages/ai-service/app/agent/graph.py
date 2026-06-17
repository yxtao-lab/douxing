"""LangGraph Supervisor 规划 Agent（C7-a/b POC）。"""

from __future__ import annotations

import time
from typing import Any, TypedDict

from app.tools.node_client import call_node_tool, call_route_intent


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
    tool_trace: list[dict[str, Any]]
    routed: dict[str, Any]
    routed_intent: str
    assistant_hint: str | None
    assistant_message: str | None
    selected_route_id: int | None


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

    t_gen = time.time()
    gen_data = await call_node_tool(
        "generate_route_draft",
        {
            "prompt": state["prompt"],
            "days": state["days"],
            "budget": state["budget"],
            "provider": state["provider"],
            "locale": state["locale"],
            "intent": state["intent"],
            "ragCandidates": rag_candidates,
            "userId": state["user_id"],
        },
    )
    draft = gen_data.get("draft")
    state["tool_trace"].append(
        {"tool": "generate_route_draft", "ok": True, "ms": int((time.time() - t_gen) * 1000)}
    )
    state["draft"] = await _enrich_and_validate_draft(state, draft, rag_candidates)


async def run_plan_agent(request: dict[str, Any]) -> dict[str, Any]:
    prompt = request.get("prompt", "")
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

    # 1. 记忆召回（qa / select 可跳过全量生成，但仍保留记忆上下文）
    t0 = time.time()
    memory_data = await call_node_tool(
        "recall_user_memory",
        {"userId": state["user_id"], "limit": 8},
    )
    state["tool_trace"].append(
        {"tool": "recall_user_memory", "ok": True, "ms": int((time.time() - t0) * 1000)}
    )

    # 2. 意图解析
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
        "toolTrace": state["tool_trace"],
        "routedIntent": state["routed_intent"],
        "assistantHint": state.get("assistant_hint"),
        "assistantMessage": state.get("assistant_message"),
        "selectedRouteId": state.get("selected_route_id"),
        "memories": memory_data.get("memories"),
    }
