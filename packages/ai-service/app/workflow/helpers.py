"""规划工作流公共辅助函数。"""

from __future__ import annotations

from typing import Any

from app.workflow.state import WorkflowContext


def resolve_planning_city(intent: dict[str, Any]) -> str | None:
    """
    从结构化 intent 解析游玩目的地城市（非出发地）。

    @param intent - C2 意图快照
    @returns 规划城市名；无法解析时为 None
    """
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


def build_generate_route_draft_payload(
    state: WorkflowContext,
    rag_candidates: list[dict[str, Any]],
    *,
    variant_key: str | None = None,
    variant_hint: str | None = None,
    rag_variant_index: int | None = None,
) -> dict[str, Any]:
    """
    组装 generate_route_draft Tool 入参。

    @param state - 工作流上下文
    @param rag_candidates - RAG 候选 POI
    @param variant_key - 方案变体键
    @param variant_hint - 变体提示
    @param rag_variant_index - RAG 轮换索引
    @returns Node Tool API 请求体
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
