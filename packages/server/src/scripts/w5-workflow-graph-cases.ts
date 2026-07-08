/**
 * W5 · 工作流图校验与默认图冒烟用例。
 *
 * 运行：
 *   pnpm --filter @douxing/server w5:workflow-graph-cases
 */
import {
  buildDefaultPlanDefaultGraph,
  validateWorkflowGraph,
  WORKFLOW_GRAPH_SCHEMA_VERSION,
} from '@douxing/shared';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runW5WorkflowGraphCases(): boolean {
  const defaultGraph = buildDefaultPlanDefaultGraph();
  assert(defaultGraph.schemaVersion === WORKFLOW_GRAPH_SCHEMA_VERSION, '默认图 schemaVersion');
  assert(defaultGraph.nodes.length >= 10, '默认图节点数');
  assert(defaultGraph.edges.length >= 10, '默认图边数');

  const defaultValidation = validateWorkflowGraph(defaultGraph);
  assert(defaultValidation.valid, `默认图应通过校验: ${JSON.stringify(defaultValidation.issues)}`);

  const cycleGraph = structuredClone(defaultGraph);
  cycleGraph.edges.push({
    id: 'e-cycle-test',
    source: 'plan_new_branch',
    target: 'memory',
  });
  const cycleValidation = validateWorkflowGraph(cycleGraph);
  assert(!cycleValidation.valid, '含环图应校验失败');
  assert(
    cycleValidation.issues.some((i) => i.code === 'CYCLE_DETECTED'),
    '应报告 CYCLE_DETECTED',
  );

  const emptyValidation = validateWorkflowGraph({ schemaVersion: 1, nodes: [], edges: [] });
  assert(!emptyValidation.valid, '空图应校验失败');

  console.info('[w5:workflow-graph-cases] 全部通过');
  return true;
}

runW5WorkflowGraphCases();
