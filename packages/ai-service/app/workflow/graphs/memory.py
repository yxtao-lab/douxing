"""W1-7 · memory 子图。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agent.memory_agent import run_memory_agent
from app.workflow.state import WorkflowContext


def build_memory_subgraph():
    """
    编译 memory 子图：recall_user_memory（memory_agent）。

    @returns 可嵌入主图的 CompiledStateGraph
    """
    graph = StateGraph(WorkflowContext)

    async def memory_recall_node(state: WorkflowContext) -> WorkflowContext:
        await run_memory_agent(state)
        return state

    graph.add_node("memory_recall", memory_recall_node)
    graph.add_edge(START, "memory_recall")
    graph.add_edge("memory_recall", END)
    return graph.compile()
