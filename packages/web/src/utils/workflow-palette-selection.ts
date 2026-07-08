import type { WorkflowGraphNodeKind } from '@douxing/shared';

/** 左侧面板选中项 */
export interface WorkflowPaletteSelection {
  kind: WorkflowGraphNodeKind;
  /** kind=tool 时的 Tool 名 */
  toolName?: string;
  /** 编排节点或 start/end 的稳定 ID */
  nodeId?: string;
  /** 展示用 i18n 键（编排节点 labelKey） */
  labelKey?: string;
}

/**
 * 生成面板选中项的唯一键（用于高亮比对）。
 *
 * @param selection - 面板选中项
 * @returns 唯一键；无效选中时返回空字符串
 */
export function buildWorkflowPaletteSelectionKey(selection: WorkflowPaletteSelection | null): string {
  if (!selection) return '';
  if (selection.toolName) return `tool:${selection.toolName}`;
  if (selection.nodeId) return `node:${selection.nodeId}`;
  return `kind:${selection.kind}`;
}

/**
 * 判断两个面板选中项是否相同。
 *
 * @param a - 选中项 A
 * @param b - 选中项 B
 * @returns 是否相同
 */
export function isSameWorkflowPaletteSelection(
  a: WorkflowPaletteSelection | null,
  b: WorkflowPaletteSelection | null,
): boolean {
  return buildWorkflowPaletteSelectionKey(a) === buildWorkflowPaletteSelectionKey(b);
}

/**
 * 解析面板文档 i18n 前缀。
 *
 * @param selection - 面板选中项
 * @returns i18n 键前缀（如 workflowEditor.paletteDoc.tools.parse_intent）
 */
export function resolveWorkflowPaletteDocKeyPrefix(selection: WorkflowPaletteSelection): string {
  if (selection.toolName) {
    return `workflowEditor.paletteDoc.tools.${selection.toolName}`;
  }
  const docId = selection.nodeId ?? selection.kind;
  return `workflowEditor.paletteDoc.nodes.${docId}`;
}
