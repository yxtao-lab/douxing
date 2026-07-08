"""W6 · 从 WorkflowGraphDefinition JSON 动态编译 LangGraph。"""

from __future__ import annotations

import hashlib
import json
import logging
from functools import lru_cache
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.workflow.graphs.memory import build_memory_subgraph
from app.workflow.graphs.plan_default import _pick_intent_branch
from app.workflow.nodes.tool_node import make_tool_node
from app.workflow.payload_builders import PAYLOAD_BUILDERS
from app.workflow.state import WorkflowContext
from app.workflow.tool_state_reducers import TOOL_STATE_REDUCERS

logger = logging.getLogger(__name__)

BranchName = str


async def _passthrough_node(state: WorkflowContext) -> WorkflowContext:
    """条件路由占位节点（无副作用）。"""
    return state


def _wrap_branch_runner(runner):
    """
    将 branches.run_* 包装为 LangGraph 节点。

    @param runner - async (state) -> None
    @returns async 节点函数
    """

    async def node(state: WorkflowContext) -> WorkflowContext:
        await runner(state)
        return state

    return node


def _get_node_overrides(node: dict[str, Any]) -> dict[str, Any]:
    """
    @param node - 图节点 JSON
    @returns overrides 字典
    """
    data = node.get("data") or {}
    overrides = data.get("overrides")
    return overrides if isinstance(overrides, dict) else {}


def _compile_branch_registry() -> dict[str, Any]:
    """
    延迟导入 branches，避免循环依赖。

    @returns branchId → run 函数
    """
    from app.workflow import branches

    return {
        "tweak_branch": branches.run_tweak_branch,
        "budget_branch": branches.run_budget_tune_branch,
        "lodging_branch": branches.run_lodging_tune_branch,
        "qa_food_branch": branches.run_qa_food_branch,
        "select_variant_branch": branches.run_select_variant_branch,
        "plan_new_branch": branches.run_plan_new_branch,
    }


def compile_workflow_graph(graph_def: dict[str, Any] | None):
    """
    将 DAG JSON 编译为 LangGraph CompiledStateGraph。

    @param graph_def - WorkflowGraphDefinition 字典；None 时抛出 ValueError
    @returns CompiledStateGraph
    @raises {ValueError} 图结构非法或含未知节点
    """
    if not graph_def or not isinstance(graph_def.get("nodes"), list):
        raise ValueError("graph_def 为空或缺少 nodes")

    nodes: list[dict[str, Any]] = graph_def["nodes"]
    edges: list[dict[str, Any]] = graph_def.get("edges") or []
    nodes_by_id = {n["id"]: n for n in nodes if n.get("id")}

    if "start" not in nodes_by_id or "end" not in nodes_by_id:
        raise ValueError("图必须包含 start 与 end 节点")

    branch_registry = _compile_branch_registry()
    graph = StateGraph(WorkflowContext)

    for node in nodes:
        node_id = node["id"]
        kind = node.get("kind")
        if kind in ("start", "end"):
            continue

        if kind == "tool":
            tool_name = node.get("toolName")
            if not tool_name or tool_name not in PAYLOAD_BUILDERS:
                raise ValueError(f"未知或未支持的 Tool 节点: {node_id}/{tool_name}")
            overrides = _get_node_overrides(node)
            builder = PAYLOAD_BUILDERS[tool_name]

            def _payload_builder(state, _builder=builder, _overrides=overrides):
                return _builder(state, _overrides)

            graph.add_node(
                node_id,
                make_tool_node(
                    tool_name,
                    _payload_builder,
                    state_reducer=TOOL_STATE_REDUCERS.get(tool_name),
                ),
            )

        elif kind == "branch":
            runner = branch_registry.get(node_id)
            if not runner:
                raise ValueError(f"未知 branch 节点: {node_id}")
            graph.add_node(node_id, _wrap_branch_runner(runner))

        elif kind == "subgraph":
            data = node.get("data") or {}
            ref = data.get("subgraphRef") or node_id
            if ref == "memory" or node_id == "memory":
                graph.add_node(node_id, build_memory_subgraph())
            else:
                raise ValueError(f"未知 subgraph: {node_id}/{ref}")

        elif kind == "condition":
            graph.add_node(node_id, _passthrough_node)

        else:
            raise ValueError(f"未知节点 kind: {node_id}/{kind}")

    # 解析边：start → * ; * → end
    start_targets = [e["target"] for e in edges if e.get("source") == "start"]
    if len(start_targets) != 1:
        raise ValueError("start 节点必须有且仅有一条出边")

    end_sources = {e["source"] for e in edges if e.get("target") == "end"}

    graph.add_edge(START, start_targets[0])

    conditional_sources: set[str] = set()
    for node in nodes:
        if node.get("kind") == "condition":
            conditional_sources.add(node["id"])

    branch_targets = {name: name for name in branch_registry.keys()}

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if not source or not target:
            continue
        if source == "start" or target == "end":
            continue
        if source in conditional_sources:
            continue

        if target == "end":
            graph.add_edge(source, END)
        elif source not in conditional_sources:
            graph.add_edge(source, target)

    for cond_id in conditional_sources:
        graph.add_conditional_edges(cond_id, _pick_intent_branch, branch_targets)

    for branch_id in branch_registry:
        if branch_id in nodes_by_id and branch_id in end_sources:
            graph.add_edge(branch_id, END)

    return graph.compile()


def _graph_cache_key(graph_def: dict[str, Any]) -> str:
    """
    @param graph_def - 图定义
    @returns 缓存键
    """
    raw = json.dumps(graph_def, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


@lru_cache(maxsize=16)
def get_compiled_workflow_graph(cache_key: str, graph_json: str):
    """
    带 LRU 缓存的图编译。

    @param cache_key - 哈希键
    @param graph_json - 图 JSON 字符串（cache 参数参与 key）
    @returns CompiledStateGraph
    """
    graph_def = json.loads(graph_json)
    logger.info("[graph_compiler] 编译模板图 cache_key=%s", cache_key)
    return compile_workflow_graph(graph_def)


def compile_workflow_graph_cached(graph_def: dict[str, Any]):
    """
    编译并缓存工作流图。

    @param graph_def - DAG 定义
    @returns CompiledStateGraph
    """
    graph_json = json.dumps(graph_def, sort_keys=True, ensure_ascii=False)
    cache_key = _graph_cache_key(graph_def)
    return get_compiled_workflow_graph(cache_key, graph_json)
