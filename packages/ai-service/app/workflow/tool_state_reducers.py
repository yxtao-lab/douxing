"""W6 · Tool 执行结果写回 WorkflowContext（动态编译图用）。"""

from __future__ import annotations

from typing import Any, Callable

from app.agent.memory_agent import apply_memory_context_to_intent


Reducer = Callable[[dict[str, Any], dict[str, Any], dict[str, Any]], None]


def _reduce_parse_intent(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """parse_intent 结果写入 intent。"""
    if data.get("intent") is not None:
        state["intent"] = data.get("intent")


async def _reduce_apply_memory_context(
    state: dict[str, Any],
    _data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """apply_memory_context 合并记忆上下文到 intent。"""
    await apply_memory_context_to_intent(state)


def _reduce_retrieve_attractions(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """retrieve_attractions 缓存 RAG 候选。"""
    state["_rag_candidates"] = data.get("candidates") or []


def _reduce_retrieve_playbooks(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """retrieve_playbooks 缓存玩法动线。"""
    state["_playbooks"] = data.get("playbooks") or []


def _reduce_build_route_variants(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """build_route_variants 缓存候选方案键。"""
    state["_variants"] = data.get("variants") or []


def _reduce_generate_route_draft(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """generate_route_draft 写入 draft。"""
    draft = data.get("draft")
    if draft is not None:
        state["draft"] = draft


def _reduce_enrich_route(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """enrich_route 更新 draft。"""
    draft = data.get("draft")
    if draft is not None:
        state["draft"] = draft


def _reduce_validate_route(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """validate_route 更新 draft。"""
    draft = data.get("draft")
    if draft is not None:
        state["draft"] = draft


def _reduce_patch_route_day(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """patch_route_day 更新 draft 与提示。"""
    draft = data.get("draft")
    if draft is not None:
        state["draft"] = draft
    state["assistant_hint"] = "已局部调整指定天行程"


def _reduce_tune_route_budget(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """tune_route_budget 更新 draft。"""
    draft = data.get("draft")
    if draft is not None:
        state["draft"] = draft
    state["assistant_hint"] = "已按新预算调整方案"


def _reduce_answer_food_qa(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """answer_food_qa 写入 assistant_message。"""
    if data.get("assistantMessage") is not None:
        state["assistant_message"] = data.get("assistantMessage")


def _reduce_select_plan_variant(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """select_plan_variant 写入 routeId 与 assistant_message。"""
    route_id = data.get("routeId")
    if isinstance(route_id, int):
        state["selected_route_id"] = route_id
    if data.get("assistantMessage") is not None:
        state["assistant_message"] = data.get("assistantMessage")


def _reduce_select_workflow_template(
    state: dict[str, Any],
    data: dict[str, Any],
    _payload: dict[str, Any],
) -> None:
    """select_workflow_template 写入 template 配置。"""
    if data.get("templateId"):
        state["template_id"] = data.get("templateId")
    if data.get("nodeConfig") is not None:
        state["template_config"] = data.get("nodeConfig") or {}


def _reduce_recall_user_memory(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """recall_user_memory 写入记忆字段。"""
    if data.get("memories") is not None:
        state["memories"] = data.get("memories") or []
    if data.get("memorySummary") is not None:
        state["memory_summary"] = data.get("memorySummary")
    if data.get("recallExplain") is not None:
        state["recall_explain"] = data.get("recallExplain") or []


def _reduce_replan_segment(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """replan_segment 写入 replan 结果。"""
    if data:
        state["replan_result"] = data


def _reduce_detect_missed_pois(state: dict[str, Any], data: dict[str, Any], _payload: dict[str, Any]) -> None:
    """detect_missed_pois 写入漏点列表。"""
    if data.get("missedPois") is not None:
        state["missed_pois"] = data.get("missedPois") or []


TOOL_STATE_REDUCERS: dict[str, Reducer | Any] = {
    "parse_intent": _reduce_parse_intent,
    "apply_memory_context": _reduce_apply_memory_context,
    "retrieve_attractions": _reduce_retrieve_attractions,
    "retrieve_playbooks": _reduce_retrieve_playbooks,
    "build_route_variants": _reduce_build_route_variants,
    "generate_route_draft": _reduce_generate_route_draft,
    "enrich_route": _reduce_enrich_route,
    "validate_route": _reduce_validate_route,
    "patch_route_day": _reduce_patch_route_day,
    "tune_route_budget": _reduce_tune_route_budget,
    "answer_food_qa": _reduce_answer_food_qa,
    "select_plan_variant": _reduce_select_plan_variant,
    "select_workflow_template": _reduce_select_workflow_template,
    "recall_user_memory": _reduce_recall_user_memory,
    "replan_segment": _reduce_replan_segment,
    "detect_missed_pois": _reduce_detect_missed_pois,
}
