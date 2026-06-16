"""LangGraph Supervisor 规划 Agent（C7-a/b POC）。"""

from __future__ import annotations

import time
from typing import Any, TypedDict

from app.tools.node_client import call_node_tool


class PlanAgentState(TypedDict, total=False):
    prompt: str
    user_id: int
    history: list[dict[str, str]]
    days: int | None
    budget: str | None
    locale: str
    provider: str | None
    current_draft: dict[str, Any] | None
    intent: dict[str, Any] | None
    draft: dict[str, Any] | None
    tool_trace: list[dict[str, Any]]
    routed_intent: str
    assistant_hint: str | None


def _route_intent(prompt: str) -> str:
    text = prompt.strip()
    if "第三天" in text and ("轻松" in text or "悠闲" in text):
        return "tweak_day"
    if "不要" in text or "小众" in text:
        return "tweak_poi"
    if "预算" in text:
        return "budget_tune"
    if "酒店" in text or "住" in text:
        return "lodging_tune"
    return "plan_new"


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


async def run_plan_agent(request: dict[str, Any]) -> dict[str, Any]:
    state: PlanAgentState = {
        "prompt": request.get("prompt", ""),
        "user_id": int(request["userId"]),
        "history": request.get("history") or [],
        "days": request.get("days"),
        "budget": request.get("budget"),
        "locale": request.get("locale") or "zh-CN",
        "provider": request.get("provider"),
        "current_draft": request.get("currentDraft"),
        "tool_trace": [],
        "routed_intent": _route_intent(request.get("prompt", "")),
    }

    # 1. 记忆召回
    t0 = time.time()
    memory_data = await call_node_tool(
        "recall_user_memory",
        {"userId": state["user_id"], "limit": 8},
    )
    state["tool_trace"].append(
        {"tool": "recall_user_memory", "ok": True, "ms": int((time.time() - t0) * 1000)}
    )

    # 2. 意图解析（注入 userId）
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

    routed = state["routed_intent"]
    if routed in {"tweak_day", "tweak_poi"} and state.get("current_draft"):
        day_index = 2 if "第三" in state["prompt"] else 0
        relaxed = "轻松" in state["prompt"] or "悠闲" in state["prompt"]
        t2 = time.time()
        patch_data = await call_node_tool(
            "patch_route_day",
            {
                "draft": state["current_draft"],
                "dayIndex": day_index,
                "intent": state["intent"],
                "locale": state["locale"],
                "relaxed": relaxed,
                "prompt": state["prompt"],
            },
        )
        state["draft"] = patch_data.get("draft")
        state["tool_trace"].append(
            {"tool": "patch_route_day", "ok": True, "ms": int((time.time() - t2) * 1000)}
        )
        state["assistant_hint"] = "已局部调整指定天行程"
    else:
        t2 = time.time()
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
        state["tool_trace"].append(
            {"tool": "retrieve_attractions", "ok": True, "ms": int((time.time() - t2) * 1000)}
        )

        t3 = time.time()
        gen_data = await call_node_tool(
            "generate_route_draft",
            {
                "prompt": state["prompt"],
                "days": state["days"],
                "budget": state["budget"],
                "provider": state["provider"],
                "locale": state["locale"],
                "intent": state["intent"],
                "ragCandidates": rag_data.get("candidates"),
                "userId": state["user_id"],
            },
        )
        draft = gen_data.get("draft")
        state["tool_trace"].append(
            {"tool": "generate_route_draft", "ok": True, "ms": int((time.time() - t3) * 1000)}
        )

        if draft:
            t4 = time.time()
            validated = await call_node_tool(
                "validate_route",
                {
                    "draft": draft,
                    "locale": state["locale"],
                    "ragCandidates": rag_data.get("candidates"),
                    "autoFix": True,
                },
            )
            state["draft"] = validated.get("draft", draft)
            state["tool_trace"].append(
                {"tool": "validate_route", "ok": True, "ms": int((time.time() - t4) * 1000)}
            )

    return {
        "draft": state.get("draft"),
        "toolTrace": state["tool_trace"],
        "routedIntent": state["routed_intent"],
        "assistantHint": state.get("assistant_hint"),
        "memories": memory_data.get("memories"),
    }
