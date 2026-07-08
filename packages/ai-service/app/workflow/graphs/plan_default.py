"""W1-4 · 默认规划工作流 LangGraph。"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph

from app.agent.memory_agent import apply_memory_context_to_intent
from app.tools.node_client import call_node_tool
from app.workflow.branches import (
    run_budget_tune_branch,
    run_lodging_tune_branch,
    run_plan_new_branch,
    run_qa_food_branch,
    run_select_variant_branch,
    run_tweak_branch,
)
from app.workflow.graphs.memory import build_memory_subgraph
from app.workflow.nodes.spans import append_node_span
from app.workflow.state import WorkflowContext

BranchName = Literal[
    "tweak_branch",
    "budget_branch",
    "lodging_branch",
    "qa_food_branch",
    "select_variant_branch",
    "plan_new_branch",
]


def _pick_intent_branch(state: WorkflowContext) -> BranchName:
    """
    按 routed_intent 与 current_draft 选择分支节点。

    @param state - 工作流上下文
    @returns 下一节点名
    """
    route = state.get("routed_intent", "unknown")
    has_draft = bool(state.get("current_draft"))
    if route in {"tweak_day", "tweak_poi"} and has_draft:
        return "tweak_branch"
    if route == "budget_tune" and has_draft:
        return "budget_branch"
    if route == "lodging_tune" and has_draft:
        return "lodging_branch"
    if route == "qa_food":
        return "qa_food_branch"
    if route == "select_variant":
        return "select_variant_branch"
    return "plan_new_branch"


@lru_cache(maxsize=1)
def build_plan_default_graph():
    """
    编译首句/追问规划主图（与 graph.py legacy 分支等价）。

    @returns CompiledStateGraph
    """
    memory_subgraph = build_memory_subgraph()
    graph = StateGraph(WorkflowContext)

    async def parse_intent_node(state: WorkflowContext) -> WorkflowContext:
        pre_intent = state.get("request_intent")
        if pre_intent:
            state["intent"] = pre_intent
            append_node_span(state, "parse_intent", True, 0)
            state["tool_trace"][-1]["source"] = "session"
            return state

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
        append_node_span(state, "parse_intent", True, int((time.time() - t1) * 1000))
        return state

    async def apply_memory_node(state: WorkflowContext) -> WorkflowContext:
        await apply_memory_context_to_intent(state)
        return state

    async def tweak_node(state: WorkflowContext) -> WorkflowContext:
        await run_tweak_branch(state, state.get("routed") or {})
        return state

    async def budget_node(state: WorkflowContext) -> WorkflowContext:
        await run_budget_tune_branch(state)
        return state

    async def lodging_node(state: WorkflowContext) -> WorkflowContext:
        await run_lodging_tune_branch(state)
        return state

    async def qa_node(state: WorkflowContext) -> WorkflowContext:
        await run_qa_food_branch(state)
        return state

    async def select_node(state: WorkflowContext) -> WorkflowContext:
        await run_select_variant_branch(state)
        return state

    async def plan_new_node(state: WorkflowContext) -> WorkflowContext:
        await run_plan_new_branch(state)
        return state

    graph.add_node("memory", memory_subgraph)
    graph.add_node("parse_intent", parse_intent_node)
    graph.add_node("apply_memory", apply_memory_node)
    graph.add_node("tweak_branch", tweak_node)
    graph.add_node("budget_branch", budget_node)
    graph.add_node("lodging_branch", lodging_node)
    graph.add_node("qa_food_branch", qa_node)
    graph.add_node("select_variant_branch", select_node)
    graph.add_node("plan_new_branch", plan_new_node)

    graph.add_edge(START, "memory")
    graph.add_edge("memory", "parse_intent")
    graph.add_edge("parse_intent", "apply_memory")
    graph.add_conditional_edges("apply_memory", _pick_intent_branch)
    for branch in (
        "tweak_branch",
        "budget_branch",
        "lodging_branch",
        "qa_food_branch",
        "select_variant_branch",
        "plan_new_branch",
    ):
        graph.add_edge(branch, END)

    return graph.compile()


def workflow_state_to_response(state: WorkflowContext) -> dict[str, Any]:
    """
    将 WorkflowContext 转为 AgentPlan API 响应体。

    @param state - 图执行结束后的状态
    @returns 与 legacy run_plan_agent 一致的 dict
    """
    return {
        "draft": state.get("draft"),
        "candidates": state.get("candidates"),
        "toolTrace": state.get("tool_trace") or [],
        "routedIntent": state.get("routed_intent"),
        "assistantHint": state.get("assistant_hint"),
        "assistantMessage": state.get("assistant_message"),
        "selectedRouteId": state.get("selected_route_id"),
        "memories": state.get("memories") or [],
        "memorySummary": state.get("memory_summary"),
        "recallExplain": state.get("recall_explain") or [],
    }


async def run_plan_default_langgraph(request: dict[str, Any], prompt: str) -> dict[str, Any]:
    """
    LangGraph 模式执行规划 Agent。

    @param request - AgentPlanRequest 字典
    @param prompt - 用户输入
    @returns Agent 规划结果
    """
    from app.tools.node_client import call_route_intent

    routed = await call_route_intent(prompt)
    route = routed.get("route", "unknown")

    initial: WorkflowContext = {
        "prompt": prompt,
        "user_id": int(request["userId"]),
        "session_id": request.get("sessionId"),
        "history": request.get("history") or [],
        "days": request.get("days"),
        "budget": request.get("budget"),
        "locale": request.get("locale") or "zh-CN",
        "provider": request.get("provider"),
        "current_draft": request.get("currentDraft"),
        "request_intent": request.get("intent"),
        "tool_trace": [],
        "routed": routed,
        "routed_intent": route,
    }

    app = build_plan_default_graph()
    final_state = await app.ainvoke(initial)
    return workflow_state_to_response(final_state)
