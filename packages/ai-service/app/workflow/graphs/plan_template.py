"""W6 · 模板图运行时：预选用模板 + 动态编译 graph_def。"""

from __future__ import annotations

import logging
from typing import Any

from app.tools.node_client import call_route_intent
from app.workflow.graph_compiler import compile_workflow_graph_cached
from app.workflow.graphs.plan_default import (
    build_plan_default_graph,
    workflow_state_to_response,
)
from app.workflow.state import WorkflowContext
from app.workflow.streaming import (
    WorkflowStreamCallback,
    attach_stream_callback,
    call_node_tool_traced,
    run_compiled_graph_streaming,
)

logger = logging.getLogger(__name__)


async def run_plan_template_langgraph(
    request: dict[str, Any],
    prompt: str,
    *,
    stream_callback: WorkflowStreamCallback | None = None,
) -> dict[str, Any]:
    """
    template 引擎：预选工作流模板，按已发布 graph_def 编译 LangGraph 执行。

    @param request - AgentPlanRequest 字典
    @param prompt - 用户输入
    @param stream_callback - 可选 Tool 流式回调
    @returns Agent 规划结果
    @raises {Exception} 编译或执行失败时抛出（由 engine 降级）
    """
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
    attach_stream_callback(initial, stream_callback)

    sel_data = await call_node_tool_traced(
        initial,
        "select_workflow_template",
        {
            "userId": initial["user_id"],
            "intent": initial.get("request_intent") or {},
            "routedIntent": route,
        },
    )
    trace = initial.get("tool_trace") or []
    if trace and trace[-1].get("tool") == "select_workflow_template":
        trace[-1]["inputDigest"] = sel_data.get("inputDigest")
        trace[-1]["outputDigest"] = sel_data.get("outputDigest")
    initial["template_id"] = sel_data.get("templateId")
    initial["template_config"] = sel_data.get("nodeConfig") or {}
    initial["_template_preselected"] = True

    graph_def = request.get("graphDefOverride") or sel_data.get("graphDef")
    if graph_def:
        if request.get("graphDefOverride"):
            logger.info(
                "[plan_template] 使用沙箱 graphDefOverride（草稿 debug） templateId=%s",
                sel_data.get("templateId"),
            )
        else:
            logger.info(
                "[plan_template] 使用模板 graph_def templateId=%s version=%s",
                sel_data.get("templateId"),
                sel_data.get("templateVersion"),
            )
        app = compile_workflow_graph_cached(graph_def)
    else:
        logger.info(
            "[plan_template] 模板无已发布 graph_def，回退 plan_default templateId=%s",
            sel_data.get("templateId"),
        )
        app = build_plan_default_graph()

    final_state = await run_compiled_graph_streaming(
        app,
        initial,
        stream_callback=stream_callback,
    )
    return workflow_state_to_response(final_state)
