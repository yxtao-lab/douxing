"""W1-2 · WorkflowContext 状态模型（覆盖 PlanAgentState）。"""

from __future__ import annotations

from typing import Any, TypedDict


class WorkflowContext(TypedDict, total=False):
    """LangGraph / legacy 共享的规划 Agent 上下文。"""

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
    # Node 预填 intent（追问会话）
    request_intent: dict[str, Any] | None
    template_id: str | None
    template_config: dict[str, Any] | None


# legacy 别名，与 graph.PlanAgentState 一致
PlanAgentState = WorkflowContext
