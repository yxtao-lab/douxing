"""Node Tool API 客户端（C7-a）。"""

from __future__ import annotations

import os
from typing import Any

import httpx

NODE_API_BASE = os.getenv("NODE_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
AGENT_TOOL_SECRET = os.getenv("AGENT_TOOL_SECRET", "")


async def call_node_tool(tool_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if AGENT_TOOL_SECRET:
        headers["x-agent-tool-secret"] = AGENT_TOOL_SECRET

    url = f"{NODE_API_BASE}/api/agent/tools/{tool_name}"
    timeout = float(os.getenv("AGENT_TOOL_TIMEOUT_MS", "120000")) / 1000.0

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
        if not body.get("success"):
            raise ValueError(body.get("message") or f"Tool {tool_name} failed")
        return body.get("data") or {}
