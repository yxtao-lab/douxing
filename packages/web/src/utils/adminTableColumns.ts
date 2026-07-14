import { formatDisplayDateTime, isDisplayDateTimeLike } from '@douxing/shared';
import type { Ref } from 'vue';
import type { ColumnType } from 'ant-design-vue/es/table';
import type { AdminExportColumn } from '@/utils/adminTableExport';

export const MIN_COLUMN_WIDTH = 60;
export const COLUMN_RESIZE_HANDLE_WIDTH = 8;

/** 管理端表格空值占位符 */
export const ADMIN_TABLE_EMPTY_PLACEHOLDER = '-';

const ACTION_COLUMN_KEYS = new Set(['action', 'actions']);

type AdminColumnWithEmptyOpt = ColumnType & {
  /** 关闭空值占位（极少用） */
  skipEmptyPlaceholder?: boolean;
};

/** 判断是否为表格空值（null / undefined / 空白字符串 / 空数组） */
export function isAdminTableEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** 格式化表格/导出单元格；空值统一为 `-`；时间值统一为 yyyy-mm-dd HH:mm:ss */
export function formatAdminTableCell(value: unknown): string {
  if (isAdminTableEmptyValue(value)) return ADMIN_TABLE_EMPTY_PLACEHOLDER;
  if (value instanceof Date) {
    return formatDisplayDateTime(value) || ADMIN_TABLE_EMPTY_PLACEHOLDER;
  }
  if (typeof value === 'string' && isDisplayDateTimeLike(value)) {
    return formatDisplayDateTime(value) || ADMIN_TABLE_EMPTY_PLACEHOLDER;
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatAdminTableCell(item)).join('; ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isActionColumn(col: ColumnType): boolean {
  const key = col.key != null ? String(col.key) : '';
  return ACTION_COLUMN_KEYS.has(key) || key.endsWith('Action');
}

/** 为列注入空值 `-` 占位（操作列除外；已有 customRender 的列会包装） */
export function withAdminTableEmptyPlaceholder(columns: ColumnType[] | undefined): ColumnType[] | undefined {
  if (!Array.isArray(columns)) return columns;

  return columns.map((col) => {
    const column = col as AdminColumnWithEmptyOpt;
    if (column.skipEmptyPlaceholder || isActionColumn(column)) {
      return column;
    }

    const original = column.customRender;
    if (typeof original === 'function') {
      return {
        ...column,
        customRender: (ctx: Parameters<NonNullable<ColumnType['customRender']>>[0]) => {
          const raw = ctx.value ?? ctx.text;
          if (isAdminTableEmptyValue(raw)) {
            return ADMIN_TABLE_EMPTY_PLACEHOLDER;
          }
          const result = original(ctx);
          if (typeof result === 'string' || typeof result === 'number') {
            return formatAdminTableCell(result);
          }
          return result;
        },
      };
    }

    if (column.dataIndex != null) {
      return {
        ...column,
        customRender: ({ text, value }: { text: unknown; value: unknown }) =>
          formatAdminTableCell(value ?? text),
      };
    }

    return column;
  });
}

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

/**
 * 服务端分页表格序号列（跨页连续编号）。
 */
export function createAdminRowIndexColumn<T>(
  title: string,
  page: Ref<number>,
  pageSize: Ref<number>,
): AdminExportColumn<T> {
  return {
    title,
    key: 'rowIndex',
    width: 72,
    align: 'center',
    resizable: false,
    skipEmptyPlaceholder: true,
    customRender: ({ index }: { index: number }) => (page.value - 1) * pageSize.value + index + 1,
    exportValue: (_record, index) => index + 1,
  } as AdminExportColumn<T>;
}
