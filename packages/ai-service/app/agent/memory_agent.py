"""C7-c · memory_agent 节点：可解释记忆召回 + 注入规划 context。"""

from __future__ import annotations

import time
from typing import Any

from app.tools.node_client import call_node_tool


async def run_memory_agent(state: dict[str, Any]) -> dict[str, Any]:
    """召回用户长期记忆，写入 state 并返回 Tool 数据。"""
    prompt = (state.get("prompt") or "").strip()
    query = prompt[:120] if prompt else None

    t0 = time.time()
    memory_data = await call_node_tool(
        "recall_user_memory",
        {
            "userId": state["user_id"],
            "limit": 8,
            "query": query,
            "locale": state.get("locale") or "zh-CN",
        },
    )
    ms = int((time.time() - t0) * 1000)
    state.setdefault("tool_trace", []).append(
        {"tool": "memory_agent", "ok": True, "ms": ms}
    )

    state["memories"] = memory_data.get("memories") or []
    state["memory_summary"] = memory_data.get("memorySummary")
    state["memory_context"] = memory_data.get("context")
    state["recall_explain"] = memory_data.get("recallExplain") or []
    return memory_data


async def apply_memory_context_to_intent(state: dict[str, Any]) -> None:
    """将 memory_agent 结果合并进 intent（含 session 预填 intent）。"""
    intent = state.get("intent")
    if not intent:
        return

    t0 = time.time()
    merged_data = await call_node_tool(
        "apply_memory_context",
        {
            "intent": intent,
            "userId": state["user_id"],
            "memorySummary": state.get("memory_summary"),
            "context": state.get("memory_context"),
        },
    )
    state["intent"] = merged_data.get("intent", intent)
    state.setdefault("tool_trace", []).append(
        {
            "tool": "apply_memory_context",
            "ok": True,
            "ms": int((time.time() - t0) * 1000),
        }
    )
