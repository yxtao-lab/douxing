"""W1-7 · transit 子图（行中 replan）。"""

from __future__ import annotations

import time
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.tools.node_client import call_node_tool
from app.workflow.nodes.spans import append_node_span


def build_transit_subgraph():
    """
    编译 transit 子图：transit_agent 标记 → replan_segment。

    @returns CompiledStateGraph；invoke 入参含 routeId/userId/context/locale
    """

    async def transit_marker_node(state: dict[str, Any]) -> dict[str, Any]:
        state.setdefault("tool_trace", [])
        append_node_span(state, "transit_agent", True, 0)
        return state

    async def replan_node(state: dict[str, Any]) -> dict[str, Any]:
        t0 = time.time()
        replan_data = await call_node_tool(
            "replan_segment",
            {
                "routeId": int(state["routeId"]),
                "userId": int(state["userId"]),
                "locale": state.get("locale") or "zh-CN",
                "context": state["context"],
            },
        )
        append_node_span(state, "replan_segment", True, int((time.time() - t0) * 1000))
        state["replan_result"] = replan_data
        return state

    graph = StateGraph(dict)
    graph.add_node("transit_marker", transit_marker_node)
    graph.add_node("replan_segment", replan_node)
    graph.add_edge(START, "transit_marker")
    graph.add_edge("transit_marker", "replan_segment")
    graph.add_edge("replan_segment", END)
    return graph.compile()
