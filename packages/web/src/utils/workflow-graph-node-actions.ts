/**
 * 判断节点是否可删除（start/end 保留，避免图结构瞬间失效）。
 *
 * @param kind - 节点种类
 * @returns 是否允许删除
 */
export function isWorkflowNodeDeletable(kind: string): boolean {
  return kind !== 'start' && kind !== 'end';
}
