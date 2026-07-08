"""W1-5 · 工作流引擎选择与降级。"""

from __future__ import annotations

import logging
from typing import Any, Literal

from app.config import get_workflow_engine

logger = logging.getLogger(__name__)

WorkflowEngineMode = Literal["legacy", "langgraph", "template"]


async def run_plan_with_engine(
    request: dict[str, Any],
    prompt: str,
    *,
    engine_override: str | None = None,
) -> dict[str, Any]:
    """
    按 WORKFLOW_ENGINE 运行规划 Agent；langgraph/template 失败时降级。

    @param request - AgentPlanRequest 字典
    @param prompt - 用户 prompt
    @param engine_override - 请求级覆盖（如 X-Workflow-Engine 头）
    @returns Agent 规划结果
    """
    engine = get_workflow_engine(engine_override)
    if engine == "template":
        try:
            from app.workflow.graphs.plan_template import run_plan_template_langgraph

            return await run_plan_template_langgraph(request, prompt)
        except Exception as exc:
            logger.warning(
                "[workflow] template 失败，降级 langgraph: %s",
                exc,
                exc_info=True,
            )
            engine = "langgraph"
    if engine == "langgraph":
        try:
            from app.workflow.graphs.plan_default import run_plan_default_langgraph

            return await run_plan_default_langgraph(request, prompt)
        except Exception as exc:
            logger.warning(
                "[workflow] langgraph 失败，降级 legacy: %s",
                exc,
                exc_info=True,
            )
    from app.agent.graph import run_plan_agent_legacy_core

    return await run_plan_agent_legacy_core(request, prompt)


async def run_transit_with_engine(
    request: dict[str, Any],
    *,
    engine_override: str | None = None,
) -> dict[str, Any]:
    """
    按 WORKFLOW_ENGINE 运行行中 Agent；langgraph 失败时降级 legacy。

    @param request - AgentTransitRequest 字典
    @param engine_override - 请求级引擎覆盖
    @returns replan 结果 + toolTrace
    """
    engine = get_workflow_engine(engine_override)
    if engine == "langgraph":
        try:
            from app.workflow.graphs.transit import build_transit_subgraph

            app = build_transit_subgraph()
            final = await app.ainvoke(
                {
                    "routeId": request["routeId"],
                    "userId": request["userId"],
                    "locale": request.get("locale") or "zh-CN",
                    "context": request["context"],
                    "tool_trace": [],
                }
            )
            replan = final.get("replan_result") or {}
            return {
                **replan,
                "toolTrace": final.get("tool_trace") or [],
            }
        except Exception as exc:
            logger.warning(
                "[workflow] transit langgraph 失败，降级 legacy: %s",
                exc,
                exc_info=True,
            )
    from app.agent.transit_agent import run_transit_agent

    return await run_transit_agent(request)
