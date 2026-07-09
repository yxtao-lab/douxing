"""LangGraph Supervisor 规划 Agent（C7-a/b）；legacy 与 LangGraph 双轨。"""

from __future__ import annotations

import time
from typing import Any

from app.tools.node_client import call_node_tool, call_route_intent
from app.agent.memory_agent import apply_memory_context_to_intent, run_memory_agent
from app.workflow.branches import (
    run_budget_tune_branch,
    run_lodging_tune_branch,
    run_plan_new_branch,
    run_qa_food_branch,
    run_select_variant_branch,
    run_tweak_branch,
)
from app.workflow.graphs.plan_default import workflow_state_to_response
from app.workflow.state import PlanAgentState, WorkflowContext
from app.workflow.streaming import WorkflowStreamCallback


async def run_plan_agent_legacy_core(request: dict[str, Any], prompt: str) -> dict[str, Any]:
    """
    legacy 手写编排（与 LangGraph 图行为对齐）。

    @param request - AgentPlanRequest 字典
    @param prompt - 用户输入
    @returns Agent 规划结果
    """
    routed = await call_route_intent(prompt)
    route = routed.get("route", "unknown")

    state: WorkflowContext = {
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

    await run_memory_agent(state)

    pre_intent = state.get("request_intent")
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

    await apply_memory_context_to_intent(state)

    routed = state["routed"]
    route = state["routed_intent"]

    if route in {"tweak_day", "tweak_poi"} and state.get("current_draft"):
        await run_tweak_branch(state, routed)
    elif route == "budget_tune" and state.get("current_draft"):
        await run_budget_tune_branch(state)
    elif route == "lodging_tune" and state.get("current_draft"):
        await run_lodging_tune_branch(state)
    elif route == "qa_food":
        await run_qa_food_branch(state)
    elif route == "select_variant":
        await run_select_variant_branch(state)
    else:
        await run_plan_new_branch(state)

    return workflow_state_to_response(state)


async def run_plan_agent(
    request: dict[str, Any],
    *,
    engine_override: str | None = None,
    stream_callback: WorkflowStreamCallback | None = None,
) -> dict[str, Any]:
    """
    规划 Agent 入口：WORKFLOW_ENGINE=langgraph 时走 LangGraph，失败降级 legacy。

    @param request - AgentPlanRequest 字典
    @param engine_override - 可选引擎覆盖
    @param stream_callback - 可选 Tool 流式回调
    @returns Agent 规划结果
    """
    from app.observability.langfuse_client import NOOP, agent_plan_trace
    from app.workflow.engine import run_plan_with_engine

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
        result = await run_plan_with_engine(
            request,
            prompt,
            engine_override=engine_override,
            stream_callback=stream_callback,
        )
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


async def run_plan_agent_streaming(
    request: dict[str, Any],
    *,
    engine_override: str | None = None,
    stream_callback: WorkflowStreamCallback | None = None,
) -> dict[str, Any]:
    """
    规划 Agent 流式入口（供 SSE 端点调用）。

    @param request - AgentPlanRequest 字典
    @param engine_override - 可选引擎覆盖
    @param stream_callback - Tool 流式回调
    @returns Agent 规划结果
    """
    return await run_plan_agent(
        request,
        engine_override=engine_override,
        stream_callback=stream_callback,
    )


# 向后兼容导出
__all__ = [
    "PlanAgentState",
    "run_plan_agent",
    "run_plan_agent_streaming",
    "run_plan_agent_legacy_core",
]
