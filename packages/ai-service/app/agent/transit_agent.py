"""H8 · Step 32 transit_agent：行中专家，调用 replan_segment Tool。"""

from __future__ import annotations

import time
from typing import Any

from app.tools.node_client import call_node_tool


async def run_transit_agent(request: dict[str, Any]) -> dict[str, Any]:
    """基于 GPS + 剩余 POI 重排当日剩余段（预览，不写回路线）。"""
    tool_trace: list[dict[str, Any]] = []
    tool_trace.append({"tool": "transit_agent", "ok": True, "ms": 0})

    replan_payload = {
        "routeId": int(request["routeId"]),
        "userId": int(request["userId"]),
        "locale": request.get("locale") or "zh-CN",
        "context": request["context"],
    }

    t0 = time.time()
    replan_data = await call_node_tool("replan_segment", replan_payload)
    tool_trace.append(
        {
            "tool": "replan_segment",
            "ok": True,
            "ms": int((time.time() - t0) * 1000),
        }
    )

    return {
        **replan_data,
        "toolTrace": tool_trace,
    }
