"""W0/W1 · NodeSpan 写入辅助。"""

from __future__ import annotations

from typing import Any


def append_node_span(
    state: dict[str, Any],
    tool: str,
    ok: bool,
    ms: int,
    **extra: Any,
) -> None:
    """
    向 tool_trace 追加 NodeSpan 条目（含 nodeId 序号）。

    @param state - 含 tool_trace 列表的工作流状态
    @param tool - Tool 名
    @param ok - 是否成功
    @param ms - 耗时毫秒
    @param extra - ragMatchedIds、matchedPlaybookIds 等扩展字段
    @returns None
    """
    trace = state.setdefault("tool_trace", [])
    seq = sum(1 for entry in trace if entry.get("tool") == tool) + 1
    trace.append(
        {
            "nodeId": f"{tool}-{seq}",
            "tool": tool,
            "ok": ok,
            "ms": ms,
            "durationMs": ms,
            **extra,
        }
    )
