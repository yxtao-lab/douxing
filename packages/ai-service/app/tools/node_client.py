"""Node Tool API 客户端（C7-a）。"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

from app.observability.langfuse_client import (
    record_route_intent_observation,
    record_tool_observation,
)

NODE_API_BASE = os.getenv("NODE_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
AGENT_TOOL_SECRET = os.getenv("AGENT_TOOL_SECRET", "")


def _is_api_response_success(body: dict[str, Any]) -> bool:
    """
    判断 Node `ApiResponse` 是否表示成功。

    Node 统一返回 `{ code, message, data }`，`code === 0` 为成功；
    兼容历史字段 `success: true`。

    @param body - Node HTTP 响应 JSON 体
    @returns `True` 表示业务成功；无法识别格式时按失败处理
    """
    if "code" in body:
        return body.get("code") == 0
    return bool(body.get("success"))


def _omit_none(payload: dict[str, Any]) -> dict[str, Any]:
    """
    移除 JSON 体中的 `None`，避免 Node Zod `.optional()` 将 `null` 判为非法。

    @param payload - 待发送的工具入参
    @returns 不含值为 `None` 的键的新字典（浅拷贝）
    """
    return {key: value for key, value in payload.items() if value is not None}


def _api_error_message(body: dict[str, Any], fallback: str) -> str:
    """
    从 Node 失败响应中提取可读错误信息。

    @param body - Node HTTP 响应 JSON 体
    @param fallback - `message` 缺失时的默认文案
    @returns 面向日志/异常的短错误描述
    """
    return str(body.get("message") or fallback)


async def call_route_intent(message: str) -> dict[str, Any]:
    """
    调用 Node 权威意图路由（与 agent-intent-router.service.ts 一致）。

    @param message - 用户自然语言输入
    @returns 路由结果，含 `route` 等字段
    @throws {ValueError} Node 返回非零 `code` 或 HTTP 失败时
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if AGENT_TOOL_SECRET:
        headers["x-agent-tool-secret"] = AGENT_TOOL_SECRET

    url = f"{NODE_API_BASE}/api/agent/route-intent"
    timeout = float(os.getenv("AGENT_TOOL_TIMEOUT_MS", "120000")) / 1000.0

    started = time.time()
    ok = True
    routed: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json={"message": message}, headers=headers)
            response.raise_for_status()
            body = response.json()
            if not _is_api_response_success(body):
                raise ValueError(_api_error_message(body, "route-intent failed"))
            routed = body.get("data") or {}
            return routed
    except Exception:
        ok = False
        raise
    finally:
        duration_ms = int((time.time() - started) * 1000)
        if ok:
            record_route_intent_observation(message, routed, duration_ms)


async def call_node_tool(tool_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """
    调用 Node Agent Tool API 并返回 `data` 字段。

    @param tool_name - 工具名，对应 `/api/agent/tools/{tool_name}`
    @param payload - 工具入参 JSON
    @returns 工具执行结果（`ApiResponse.data`）
    @throws {ValueError} Node 返回非零 `code` 或 HTTP 失败时
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if AGENT_TOOL_SECRET:
        headers["x-agent-tool-secret"] = AGENT_TOOL_SECRET

    url = f"{NODE_API_BASE}/api/agent/tools/{tool_name}"
    timeout = float(os.getenv("AGENT_TOOL_TIMEOUT_MS", "120000")) / 1000.0

    started = time.time()
    ok = True
    data: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=_omit_none(payload), headers=headers)
            response.raise_for_status()
            body = response.json()
            if not _is_api_response_success(body):
                raise ValueError(_api_error_message(body, f"Tool {tool_name} failed"))
            data = body.get("data") or {}
            return data
    except Exception:
        ok = False
        raise
    finally:
        duration_ms = int((time.time() - started) * 1000)
        record_tool_observation(tool_name, payload, data if ok else None, duration_ms, ok=ok)
