"""W6 · Tool 入参构造：从 WorkflowContext 生成 payload，并合并节点 overrides。"""

from __future__ import annotations

from typing import Any

from app.workflow.helpers import build_generate_route_draft_payload, resolve_planning_city


def merge_payload_overrides(
    payload: dict[str, Any],
    overrides: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    浅合并节点静态 overrides（忽略 None）。

    @param payload - 默认 payload
    @param overrides - 编辑器 node.data.overrides
    @returns 合并后的 payload
    """
    if not overrides:
        return payload
    merged = dict(payload)
    for key, value in overrides.items():
        if value is not None:
            merged[key] = value
    return merged


def _template_config(state: dict[str, Any]) -> dict[str, Any]:
    """
    @param state - 工作流上下文
    @returns nodeConfig 字典
    """
    return state.get("template_config") or {}


def build_parse_intent_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 parse_intent Tool 入参。"""
    payload = {
        "prompt": state["prompt"],
        "history": state.get("history") or [],
        "days": state.get("days"),
        "budget": state.get("budget"),
        "userId": state["user_id"],
    }
    return merge_payload_overrides(payload, overrides)


def build_apply_memory_context_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 apply_memory_context Tool 入参。"""
    payload = {
        "intent": state.get("intent") or {},
        "userId": state["user_id"],
        "memorySummary": state.get("memory_summary"),
        "context": (state.get("memory_context") or {}).get("context"),
    }
    return merge_payload_overrides(payload, overrides)


def build_retrieve_attractions_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 retrieve_attractions Tool 入参。"""
    intent = state.get("intent") or {}
    tpl = _template_config(state)
    payload: dict[str, Any] = {
        "city": resolve_planning_city(intent),
        "themes": intent.get("themes"),
        "prompt": state.get("prompt"),
        "days": intent.get("days"),
        "userId": state["user_id"],
    }
    if tpl.get("topK") is not None:
        payload["limit"] = tpl.get("topK")
    if tpl.get("mmrLambda") is not None:
        payload["mmrLambda"] = tpl.get("mmrLambda")
    return merge_payload_overrides(payload, overrides)


def build_retrieve_playbooks_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 retrieve_playbooks Tool 入参。"""
    intent = state.get("intent") or {}
    tpl = _template_config(state)
    payload: dict[str, Any] = {
        "city": resolve_planning_city(intent),
        "themes": intent.get("themes"),
        "prompt": state.get("prompt"),
        "limit": tpl.get("playbookLimit"),
    }
    return merge_payload_overrides(payload, overrides)


def build_build_route_variants_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 build_route_variants Tool 入参。"""
    tpl = _template_config(state)
    payload: dict[str, Any] = {
        "intent": state.get("intent") or {},
        "locale": state.get("locale"),
        "userId": state["user_id"],
    }
    if tpl.get("variantCount") is not None:
        payload["candidateCount"] = tpl.get("variantCount")
    return merge_payload_overrides(payload, overrides)


def build_generate_route_draft_payload_from_state(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 generate_route_draft Tool 入参（单方案默认）。"""
    rag_candidates = state.get("_rag_candidates") or []
    payload = build_generate_route_draft_payload(state, rag_candidates)
    return merge_payload_overrides(payload, overrides)


def build_enrich_route_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 enrich_route Tool 入参。"""
    payload = {
        "draft": state.get("draft") or state.get("current_draft") or {},
        "intent": state.get("intent") or {},
        "locale": state.get("locale"),
        "playbooks": state.get("_playbooks") or [],
    }
    return merge_payload_overrides(payload, overrides)


def build_validate_route_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 validate_route Tool 入参。"""
    payload = {
        "draft": state.get("draft") or {},
        "locale": state.get("locale"),
        "ragCandidates": state.get("_rag_candidates") or [],
        "autoFix": True,
    }
    return merge_payload_overrides(payload, overrides)


def build_patch_route_day_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 patch_route_day Tool 入参。"""
    routed = state.get("routed") or {}
    payload: dict[str, Any] = {
        "draft": state.get("current_draft") or state.get("draft") or {},
        "intent": state.get("intent") or {},
        "locale": state.get("locale"),
        "relaxed": bool(routed.get("relaxed")),
        "prompt": state.get("prompt"),
    }
    day_index = routed.get("dayIndex")
    if day_index is not None:
        payload["dayIndex"] = day_index
    exclude_names = routed.get("excludePoiNames") or []
    if exclude_names:
        payload["excludeNames"] = exclude_names
    return merge_payload_overrides(payload, overrides)


def build_tune_route_budget_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 tune_route_budget Tool 入参。"""
    payload = {
        "draft": state.get("current_draft") or state.get("draft") or {},
        "intent": state.get("intent") or {},
        "locale": state.get("locale"),
    }
    return merge_payload_overrides(payload, overrides)


def build_answer_food_qa_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 answer_food_qa Tool 入参。"""
    payload = {
        "intent": state.get("intent") or {},
        "prompt": state.get("prompt"),
        "locale": state.get("locale"),
        "userId": state["user_id"],
    }
    return merge_payload_overrides(payload, overrides)


def build_select_plan_variant_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 select_plan_variant Tool 入参。"""
    payload = {
        "sessionId": state.get("session_id"),
        "userId": state["user_id"],
        "prompt": state.get("prompt"),
        "locale": state.get("locale"),
    }
    return merge_payload_overrides(payload, overrides)


def build_select_workflow_template_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 select_workflow_template Tool 入参。"""
    payload = {
        "userId": state["user_id"],
        "intent": state.get("intent") or state.get("request_intent") or {},
        "routedIntent": state.get("routed_intent"),
    }
    return merge_payload_overrides(payload, overrides)


def build_recall_user_memory_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 recall_user_memory Tool 入参。"""
    payload = {
        "userId": state["user_id"],
        "query": state.get("prompt"),
    }
    return merge_payload_overrides(payload, overrides)


def build_write_trip_memory_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 write_trip_memory Tool 入参。"""
    payload = {"userId": state["user_id"]}
    return merge_payload_overrides(payload, overrides)


def build_replan_segment_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 replan_segment Tool 入参。"""
    payload = {
        "routeId": state.get("route_id") or state.get("selected_route_id"),
        "userId": state["user_id"],
        "context": state.get("transit_context") or {},
    }
    return merge_payload_overrides(payload, overrides)


def build_detect_missed_pois_payload(
    state: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造 detect_missed_pois Tool 入参。"""
    payload = {
        "routeId": state.get("route_id") or state.get("selected_route_id"),
        "userId": state["user_id"],
        "dayIndex": (state.get("routed") or {}).get("dayIndex"),
    }
    return merge_payload_overrides(payload, overrides)


PAYLOAD_BUILDERS: dict[str, Any] = {
    "parse_intent": build_parse_intent_payload,
    "select_workflow_template": build_select_workflow_template_payload,
    "apply_memory_context": build_apply_memory_context_payload,
    "retrieve_attractions": build_retrieve_attractions_payload,
    "retrieve_playbooks": build_retrieve_playbooks_payload,
    "build_route_variants": build_build_route_variants_payload,
    "generate_route_draft": build_generate_route_draft_payload_from_state,
    "enrich_route": build_enrich_route_payload,
    "validate_route": build_validate_route_payload,
    "patch_route_day": build_patch_route_day_payload,
    "tune_route_budget": build_tune_route_budget_payload,
    "answer_food_qa": build_answer_food_qa_payload,
    "select_plan_variant": build_select_plan_variant_payload,
    "recall_user_memory": build_recall_user_memory_payload,
    "write_trip_memory": build_write_trip_memory_payload,
    "replan_segment": build_replan_segment_payload,
    "detect_missed_pois": build_detect_missed_pois_payload,
}
