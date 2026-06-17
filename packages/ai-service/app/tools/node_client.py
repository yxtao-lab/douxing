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


async def call_route_intent(message: str) -> dict[str, Any]:
    """调用 Node 权威意图路由（与 agent-intent-router.service.ts 一致）。"""
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
            if not body.get("success"):
                raise ValueError(body.get("message") or "route-intent failed")
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
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()
            if not body.get("success"):
                raise ValueError(body.get("message") or f"Tool {tool_name} failed")
            data = body.get("data") or {}
            return data
    except Exception:
        ok = False
        raise
    finally:
        duration_ms = int((time.time() - started) * 1000)
        record_tool_observation(tool_name, payload, data if ok else None, duration_ms, ok=ok)
