import type { ColumnType } from 'ant-design-vue/es/table';

export const MIN_COLUMN_WIDTH = 60;
export const COLUMN_RESIZE_HANDLE_WIDTH = 8;

/** 生成列宽状态键，用于拖动后持久化宽度 */
export function getAdminColumnKey(col: ColumnType, index: number): string {
  if (col.key != null && col.key !== '') return String(col.key);
  const dataIndex = col.dataIndex;
  if (Array.isArray(dataIndex)) return dataIndex.join('.');
  if (dataIndex != null && dataIndex !== '') return String(dataIndex);
  if (typeof col.title === 'string' && col.title) return col.title;
  return `col-${index}`;
}

export function isColumnResizeEdge(e: MouseEvent, cell: HTMLElement): boolean {
  const rect = cell.getBoundingClientRect();
  return e.clientX >= rect.right - COLUMN_RESIZE_HANDLE_WIDTH;
}
