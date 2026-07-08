"""
W1-6 · legacy vs LangGraph 规划 Agent 等价率脚本。

用法（ai-service 目录，需 Node API + 可选 LLM）：
  python -m app.scripts.workflow_equivalence
  WORKFLOW_ENGINE=legacy python -m app.scripts.workflow_equivalence --compare
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from typing import Any

import app.config  # noqa: F401 — 加载根目录 .env（AGENT_TOOL_SECRET 等）

from app.agent.graph import run_plan_agent_legacy_core
from app.workflow.graphs.plan_default import run_plan_default_langgraph

MIN_EQUIVALENCE_RATE = 0.95

CASES: list[dict[str, Any]] = [
    {
        "prompt": "杭州3天文化之旅，预算3000左右",
        "userId": 1,
        "locale": "zh-CN",
        "intent": {
            "city": "杭州",
            "days": 3,
            "budget": "3000",
            "themes": ["文化", "自然"],
            "confidence": "medium",
            "cities": ["杭州"],
            "suggestedDestinations": ["杭州"],
        },
    },
    {
        "prompt": "北京5天亲子游，故宫长城",
        "userId": 1,
        "locale": "zh-CN",
        "intent": {
            "city": "北京",
            "days": 5,
            "themes": ["亲子", "历史"],
            "confidence": "medium",
            "cities": ["北京"],
            "suggestedDestinations": ["北京"],
        },
    },
    {
        "prompt": "成都2天美食休闲",
        "userId": 1,
        "locale": "zh-CN",
        "intent": {
            "city": "成都",
            "days": 2,
            "themes": ["美食"],
            "confidence": "medium",
            "cities": ["成都"],
            "suggestedDestinations": ["成都"],
        },
    },
]


def _tool_chain(result: dict[str, Any]) -> list[str]:
    return [entry.get("tool", "?") for entry in result.get("toolTrace") or []]


def _compare_case(legacy: dict[str, Any], langgraph: dict[str, Any]) -> tuple[bool, str]:
    if legacy.get("routedIntent") != langgraph.get("routedIntent"):
        return False, f"routedIntent {legacy.get('routedIntent')} != {langgraph.get('routedIntent')}"
    legacy_tools = _tool_chain(legacy)
    lg_tools = _tool_chain(langgraph)
    if legacy_tools != lg_tools:
        return False, f"toolChain {legacy_tools} != {lg_tools}"
    legacy_has = legacy.get("draft") is not None
    lg_has = langgraph.get("draft") is not None
    if legacy_has != lg_has:
        return False, f"hasDraft {legacy_has} != {lg_has}"
    return True, "ok"


async def run_compare() -> dict[str, Any]:
    """
    逐条对比 legacy 与 LangGraph 输出。

    @returns 等价率报告 dict
    """
    results: list[dict[str, Any]] = []
    equivalent = 0

    for index, case in enumerate(CASES):
        prompt = case["prompt"]
        t0 = time.time()
        legacy = await run_plan_agent_legacy_core(case, prompt)
        lg = await run_plan_default_langgraph(case, prompt)
        ok, detail = _compare_case(legacy, lg)
        if ok:
            equivalent += 1
        results.append(
            {
                "index": index,
                "prompt": prompt[:60],
                "equivalent": ok,
                "detail": detail,
                "legacyTools": _tool_chain(legacy),
                "langgraphTools": _tool_chain(lg),
                "ms": int((time.time() - t0) * 1000),
            }
        )

    total = len(CASES)
    rate = equivalent / total if total else 1.0
    report = {
        "totalCases": total,
        "equivalentCases": equivalent,
        "equivalenceRate": rate,
        "threshold": MIN_EQUIVALENCE_RATE,
        "passed": rate >= MIN_EQUIVALENCE_RATE,
        "cases": results,
    }
    return report


def main() -> None:
    """CLI 入口。"""
    report = asyncio.run(run_compare())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
