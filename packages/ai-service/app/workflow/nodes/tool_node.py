"""W1-3 · Tool 节点工厂：包装 call_node_tool 并自动记录 NodeSpan。"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.tools.node_client import call_node_tool
from app.workflow.nodes.spans import append_node_span
from app.workflow.streaming import emit_tool_start


async def call_tool_with_span(
    state: dict[str, Any],
    tool_name: str,
    payload: dict[str, Any],
    *,
    span_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    调用 Node Tool 并写入 NodeSpan。

    @param state - 工作流上下文（含 tool_trace）
    @param tool_name - Tool 名
    @param payload - Tool 入参
    @param span_extra - 追加到 span 的字段（如 ragMatchedIds）
    @returns Tool 返回的 data 字典
    @raises {ValueError} Node Tool 失败时
    """
    emit_tool_start(state, tool_name)
    started = time.time()
    ok = True
    data: dict[str, Any] = {}
    try:
        data = await call_node_tool(tool_name, payload)
        return data
    except Exception:
        ok = False
        raise
    finally:
        ms = int((time.time() - started) * 1000)
        extra = dict(span_extra or {})
        append_node_span(state, tool_name, ok, ms, **extra)


def make_tool_node(
    tool_name: str,
    payload_builder: Callable[[dict[str, Any]], dict[str, Any]],
    *,
    span_extra_from_result: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    state_reducer: Callable[[dict[str, Any], dict[str, Any], dict[str, Any]], Any] | None = None,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """
    生成 LangGraph 节点：按 state 构造 payload 并调用 Tool。

    @param tool_name - Tool 名
    @param payload_builder - 从 state 生成 Tool 入参
    @param span_extra_from_result - 从 Tool 结果提取 span 扩展字段
    @param state_reducer - Tool 结果写回 state（sync 或 async）
    @returns 可注册到 StateGraph 的 async 节点函数
    """

    async def node(state: dict[str, Any]) -> dict[str, Any]:
        payload = payload_builder(state)
        data = await call_tool_with_span(state, tool_name, payload)
        if span_extra_from_result:
            # call_tool_with_span 已写入基础 span；补写扩展字段到最后一条
            trace = state.get("tool_trace") or []
            if trace and trace[-1].get("tool") == tool_name:
                trace[-1].update(span_extra_from_result(data))
        if state_reducer:
            result = state_reducer(state, data, payload)
            if hasattr(result, "__await__"):
                await result
        return state

    node.__name__ = f"tool_{tool_name}"
    return node
