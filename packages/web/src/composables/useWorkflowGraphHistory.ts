import { computed, ref } from 'vue';
import type { WorkflowGraphDefinition } from '@douxing/shared';

/** 历史栈最大深度（含当前会话基线前的可撤销步数） */
export const WORKFLOW_GRAPH_MAX_HISTORY_DEPTH = 20;

/** 变更历史动作类型 */
export type WorkflowGraphHistoryActionKind =
  | 'sessionStart'
  | 'nodeAdded'
  | 'nodeRemoved'
  | 'nodeMoved'
  | 'edgeConnected'
  | 'edgeRemoved'
  | 'configChanged'
  | 'graphReloaded';

/** 历史栈单步快照 */
interface WorkflowGraphHistoryStep {
  graph: WorkflowGraphDefinition;
  /** 离开该快照时执行的动作 */
  action: WorkflowGraphHistoryActionKind;
}

/** 变更历史时间线条目（供 UI 展示） */
export interface WorkflowGraphHistoryTimelineEntry {
  action: WorkflowGraphHistoryActionKind;
  /** 相对当前状态需撤销的步数；0 表示当前 */
  stepsBack: number;
  isCurrent: boolean;
}

/**
 * 深拷贝工作流图定义（用于历史快照）。
 *
 * @param graph - 源图
 * @returns 拷贝后的图
 */
function cloneWorkflowGraph(graph: WorkflowGraphDefinition): WorkflowGraphDefinition {
  return JSON.parse(JSON.stringify(graph)) as WorkflowGraphDefinition;
}

/**
 * 判断两幅图 JSON 是否等价。
 *
 * @param a - 图 A
 * @param b - 图 B
 * @returns 是否相同
 */
function isSameWorkflowGraph(
  a: WorkflowGraphDefinition,
  b: WorkflowGraphDefinition,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 工作流编排画布撤销 / 重做与变更历史。
 *
 * @returns 历史操作 API 与可撤销状态
 */
export function useWorkflowGraphHistory() {
  const past = ref<WorkflowGraphHistoryStep[]>([]);
  const future = ref<WorkflowGraphHistoryStep[]>([]);
  const present = ref<WorkflowGraphDefinition | null>(null);
  const presentAction = ref<WorkflowGraphHistoryActionKind>('sessionStart');

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  /**
   * 变更历史时间线（最新在前）。
   */
  const timelineEntries = computed((): WorkflowGraphHistoryTimelineEntry[] => {
    const items: WorkflowGraphHistoryTimelineEntry[] = [
      {
        action: presentAction.value,
        stepsBack: 0,
        isCurrent: true,
      },
    ];

    for (let stepsBack = 1; stepsBack <= past.value.length; stepsBack += 1) {
      items.push({
        action: resolveActionAtStepsBack(stepsBack),
        stepsBack,
        isCurrent: false,
      });
    }

    return items;
  });

  /**
   * 解析指定步数回退点对应的动作标签。
   *
   * @param stepsBack - 相对当前的撤销步数
   * @returns 动作类型
   */
  function resolveActionAtStepsBack(stepsBack: number): WorkflowGraphHistoryActionKind {
    if (stepsBack === 0) return presentAction.value;
    if (stepsBack >= past.value.length) return 'sessionStart';
    return past.value[past.value.length - stepsBack - 1].action;
  }

  /**
   * 初始化历史（加载模板或重置画布时调用）。
   *
   * @param graph - 当前图定义
   * @param action - 基线动作标签
   * @returns void
   */
  function initHistory(
    graph: WorkflowGraphDefinition,
    action: WorkflowGraphHistoryActionKind = 'sessionStart',
  ): void {
    present.value = cloneWorkflowGraph(graph);
    presentAction.value = action;
    past.value = [];
    future.value = [];
  }

  /**
   * 记录一次可撤销变更（与 present 不同时才入栈）。
   *
   * @param graph - 变更后的图
   * @param action - 本次变更动作
   * @returns void
   */
  function recordHistory(
    graph: WorkflowGraphDefinition,
    action: WorkflowGraphHistoryActionKind,
  ): void {
    if (!present.value || isSameWorkflowGraph(graph, present.value)) return;

    past.value.push({
      graph: cloneWorkflowGraph(present.value),
      action,
    });
    if (past.value.length > WORKFLOW_GRAPH_MAX_HISTORY_DEPTH) {
      past.value.shift();
    }
    present.value = cloneWorkflowGraph(graph);
    presentAction.value = action;
    future.value = [];
  }

  /**
   * 撤销一步。
   *
   * @returns 恢复后的图；无法撤销时为 null
   */
  function undo(): WorkflowGraphDefinition | null {
    if (!present.value || past.value.length === 0) return null;

    const previousStep = past.value.pop();
    if (!previousStep) return null;

    future.value.unshift({
      graph: cloneWorkflowGraph(present.value),
      action: presentAction.value,
    });
    present.value = cloneWorkflowGraph(previousStep.graph);
    presentAction.value =
      past.value.length === 0
        ? 'sessionStart'
        : past.value[past.value.length - 1].action;
    return present.value;
  }

  /**
   * 重做一步。
   *
   * @returns 恢复后的图；无法重做时为 null
   */
  function redo(): WorkflowGraphDefinition | null {
    if (!present.value || future.value.length === 0) return null;

    const nextStep = future.value.shift();
    if (!nextStep) return null;

    past.value.push({
      graph: cloneWorkflowGraph(present.value),
      action: presentAction.value,
    });
    if (past.value.length > WORKFLOW_GRAPH_MAX_HISTORY_DEPTH) {
      past.value.shift();
    }
    present.value = cloneWorkflowGraph(nextStep.graph);
    presentAction.value = nextStep.action;
    return present.value;
  }

  /**
   * 跳转到指定步数回退点（0 为当前状态）。
   *
   * @param stepsBack - 撤销步数
   * @returns 目标图；无效时为 null
   */
  function goToStepsBack(stepsBack: number): WorkflowGraphDefinition | null {
    if (!present.value) return null;
    if (stepsBack === 0) return cloneWorkflowGraph(present.value);
    if (stepsBack > past.value.length) return null;

    const targetPastLength = past.value.length - stepsBack;
    while (past.value.length > targetPastLength) {
      if (!undo()) return null;
    }
    return present.value ? cloneWorkflowGraph(present.value) : null;
  }

  /**
   * 清除可撤销/重做栈，保留当前画布为新的基线。
   *
   * @returns void
   */
  function clearHistory(): void {
    if (!present.value) return;
    past.value = [];
    future.value = [];
    presentAction.value = 'sessionStart';
  }

  return {
    canUndo,
    canRedo,
    timelineEntries,
    initHistory,
    recordHistory,
    undo,
    redo,
    goToStepsBack,
    clearHistory,
  };
}
