"""W6 · LangGraph 流式执行与 Tool 事件推送。"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from typing import Any

import time

from app.tools.node_client import call_node_tool
from app.workflow.nodes.spans import append_node_span
from app.workflow.state import WorkflowContext

logger = logging.getLogger(__name__)

ToolStartCallback = Callable[[str], None]
ToolEndCallback = Callable[[dict[str, Any]], None]
NodeStatusCallback = Callable[[str, str, dict[str, Any] | None], None]


class WorkflowStreamCallback:
    """
    工作流 Tool 流式回调（供 SSE 端点与 Node 转发使用）。

    @param on_tool_start - Tool 开始执行时触发
    @param on_tool_end - Tool 完成并写入 span 后触发
    @param on_node_status - LangGraph 编排节点开始/完成时触发
    """

    def __init__(
        self,
        on_tool_start: ToolStartCallback | None = None,
        on_tool_end: ToolEndCallback | None = None,
        on_node_status: NodeStatusCallback | None = None,
    ) -> None:
        self.on_tool_start = on_tool_start
        self.on_tool_end = on_tool_end
        self.on_node_status = on_node_status


def attach_stream_callback(
    state: WorkflowContext,
    callback: WorkflowStreamCallback | None,
) -> WorkflowContext:
    """
    将流式回调挂载到工作流上下文（子图/分支共享同一 state 引用）。

    @param state - 工作流初始上下文
    @param callback - Tool 事件回调；None 时移除挂载
    @returns 同一 state 引用（便于链式调用）
    """
    if callback is not None:
        state["_stream_callback"] = callback
    else:
        state.pop("_stream_callback", None)
    return state


def _get_stream_callback(state: dict[str, Any]) -> WorkflowStreamCallback | None:
    """
    @param state - 工作流上下文
    @returns 已挂载的流式回调；未挂载时为 None
    """
    callback = state.get("_stream_callback")
    return callback if isinstance(callback, WorkflowStreamCallback) else None


def emit_tool_start(state: dict[str, Any], tool: str) -> None:
    """
    推送 Tool 开始事件（无挂载回调时无副作用）。

    @param state - 工作流上下文
    @param tool - Tool 名
    @returns None
    """
    callback = _get_stream_callback(state)
    if callback and callback.on_tool_start:
        callback.on_tool_start(tool)


def emit_tool_end(state: dict[str, Any], span: dict[str, Any]) -> None:
    """
    推送 Tool 结束事件（无挂载回调时无副作用）。

    @param state - 工作流上下文
    @param span - 刚写入 tool_trace 的 NodeSpan 条目
    @returns None
    """
    callback = _get_stream_callback(state)
    if callback and callback.on_tool_end:
        callback.on_tool_end(span)


# LangGraph 节点名 → 画布节点 id（plan_default 主图）
_LANGGRAPH_CANVAS_NODE_MAP: dict[str, str] = {
    "memory": "memory",
    "memory_recall": "memory",
    "parse_intent": "parse_intent",
    "apply_memory": "apply_memory",
    "tweak_branch": "tweak_branch",
    "budget_branch": "budget_branch",
    "lodging_branch": "lodging_branch",
    "qa_food_branch": "qa_food_branch",
    "select_variant_branch": "select_variant_branch",
    "plan_new_branch": "plan_new_branch",
    "__graph_end__": "end",
}


def emit_node_status(
    state: dict[str, Any],
    langgraph_node: str,
    status: str,
    *,
    extra: dict[str, Any] | None = None,
) -> None:
    """
    推送编排类画布节点状态（无挂载回调时无副作用）。

    @param state - 工作流上下文
    @param langgraph_node - LangGraph 节点名
    @param status - running / success / failed
    @param extra - 附加字段（如 routedIntent、ms）
    @returns None
    """
    canvas_node_id = _LANGGRAPH_CANVAS_NODE_MAP.get(langgraph_node)
    if not canvas_node_id:
        return
    callback = _get_stream_callback(state)
    if callback and callback.on_node_status:
        callback.on_node_status(canvas_node_id, status, extra)


async def call_node_tool_traced(
    state: dict[str, Any],
    tool_name: str,
    payload: dict[str, Any],
    *,
    trace_tool: str | None = None,
    **span_extra: Any,
) -> dict[str, Any]:
    """
    调用 Node Tool 并写入 NodeSpan，同时推送流式 start/end 事件。

    @param state - 工作流上下文
    @param tool_name - 实际调用的 Tool 名
    @param payload - Tool 入参
    @param trace_tool - 写入 tool_trace 的名称；默认与 tool_name 相同
    @param span_extra - 追加到 span 的扩展字段
    @returns Tool 返回的 data 字典
    @raises {Exception} Node Tool 失败时原样抛出
    """
    span_name = trace_tool or tool_name
    emit_tool_start(state, span_name)
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
        append_node_span(state, span_name, ok, int((time.time() - started) * 1000), **span_extra)


def span_to_tool_call_payload(span: dict[str, Any], *, status: str) -> dict[str, Any]:
    """
    将 NodeSpan 转为 SSE `tool_call` 载荷。

    @param span - tool_trace 条目
    @param status - running / done / failed
    @returns 可 JSON 序列化的 SSE 数据字典
    """
    payload: dict[str, Any] = {
        "tool": span.get("tool", ""),
        "status": status,
    }
    if status != "running":
        payload["ms"] = span.get("ms")
        payload["nodeId"] = span.get("nodeId")
        if span.get("inputDigest"):
            payload["inputDigest"] = span["inputDigest"]
        if span.get("outputDigest"):
            payload["outputDigest"] = span["outputDigest"]
    return payload


def format_sse_event(event: str, data: dict[str, Any]) -> str:
    """
    格式化为 SSE 文本帧。

    @param event - 事件名（tool_call / done / error）
    @param data - 事件数据
    @returns SSE 帧字符串
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def run_compiled_graph_streaming(
    app: Any,
    initial: WorkflowContext,
    *,
    stream_callback: WorkflowStreamCallback | None = None,
) -> WorkflowContext:
    """
    使用 LangGraph `astream_events` 流式执行已编译图，并在 Tool 回调中实时推送事件。

    @param app - CompiledStateGraph
    @param initial - 初始工作流上下文
    @param stream_callback - 可选 Tool 流式回调
    @returns 执行完成后的最终上下文
    @raises {Exception} 图执行失败时原样抛出
    """
    state_input = dict(initial)
    attach_stream_callback(state_input, stream_callback)

    final_state: WorkflowContext | None = None

    try:
        async for event in app.astream_events(state_input, version="v2"):
            event_type = event.get("event")
            metadata = event.get("metadata") or {}
            langgraph_node = metadata.get("langgraph_node")
            if isinstance(langgraph_node, str) and langgraph_node in _LANGGRAPH_CANVAS_NODE_MAP:
                if event_type == "on_chain_start":
                    emit_node_status(state_input, langgraph_node, "running")
                elif event_type == "on_chain_end":
                    routed_intent = state_input.get("routed_intent")
                    extra: dict[str, Any] | None = None
                    if langgraph_node == "apply_memory" and isinstance(routed_intent, str):
                        extra = {"routedIntent": routed_intent}
                        emit_node_status(
                            state_input,
                            "intent_router",
                            "success",
                            extra=extra,
                        )
                    emit_node_status(state_input, langgraph_node, "success", extra=extra)

            if event_type != "on_chain_end":
                continue

            output = event.get("data", {}).get("output")
            if not isinstance(output, dict):
                continue

            if event.get("name") == "LangGraph":
                final_state = output
                continue

            metadata = event.get("metadata") or {}
            if metadata.get("langgraph_node") and "tool_trace" in output:
                if final_state is None:
                    final_state = {**state_input, **output}
                else:
                    merged = dict(final_state)
                    merged.update(output)
                    final_state = merged
    except Exception:
        logger.exception("[streaming] astream_events 执行失败，回退 ainvoke")
        final_state = await app.ainvoke(state_input)
        return final_state

    if final_state is None:
        logger.warning("[streaming] astream_events 未产出最终状态，回退 ainvoke")
        final_state = await app.ainvoke(state_input)

    any_failed = any(
        not span.get("ok", True) for span in (final_state.get("tool_trace") or [])
    )
    emit_node_status(state_input, "__graph_end__", "failed" if any_failed else "success")

    return final_state


async def iter_plan_agent_sse(
    request: dict[str, Any],
    *,
    engine_override: str | None = None,
) -> AsyncIterator[str]:
    """
    规划 Agent SSE 异步生成器：执行过程中逐帧 yield `tool_call`，结束时 yield `done`/`error`。

    @param request - AgentPlanRequest 字典
    @param engine_override - 可选引擎覆盖
    @yields SSE 文本帧
    """
    from app.agent.graph import run_plan_agent_streaming

    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def on_tool_start(tool: str) -> None:
        queue.put_nowait(
            {
                "kind": "sse",
                "event": "tool_call",
                "data": {"tool": tool, "status": "running"},
            }
        )

    def on_tool_end(span: dict[str, Any]) -> None:
        status = "done" if span.get("ok", True) else "failed"
        queue.put_nowait(
            {
                "kind": "sse",
                "event": "tool_call",
                "data": span_to_tool_call_payload(span, status=status),
            }
        )

    def on_node_status(node_id: str, status: str, extra: dict[str, Any] | None) -> None:
        payload: dict[str, Any] = {"nodeId": node_id, "status": status}
        if extra:
            payload.update(extra)
        queue.put_nowait(
            {
                "kind": "sse",
                "event": "node_status",
                "data": payload,
            }
        )

    callback = WorkflowStreamCallback(
        on_tool_start=on_tool_start,
        on_tool_end=on_tool_end,
        on_node_status=on_node_status,
    )

    async def worker() -> None:
        try:
            result = await run_plan_agent_streaming(
                request,
                engine_override=engine_override,
                stream_callback=callback,
            )
            queue.put_nowait({"kind": "done", "data": result})
        except Exception as exc:
            logger.exception("[streaming] 规划流式执行失败")
            queue.put_nowait({"kind": "error", "data": {"message": str(exc)}})
        finally:
            queue.put_nowait(None)

    task = asyncio.create_task(worker())

    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            if item["kind"] == "sse":
                yield format_sse_event(item["event"], item["data"])
                await asyncio.sleep(0)
            elif item["kind"] == "done":
                yield format_sse_event("done", item["data"])
                await asyncio.sleep(0)
            elif item["kind"] == "error":
                yield format_sse_event("error", item["data"])
                await asyncio.sleep(0)
    finally:
        await task
