import { computed, onUnmounted, ref, type ComputedRef } from 'vue';
import type { ColumnType } from 'ant-design-vue/es/table';

type ResizableColumnType = ColumnType & {
  onHeaderCell?: (column: ColumnType) => Record<string, unknown>;
  resizable?: boolean;
};
import {
  getAdminColumnKey,
  isColumnResizeEdge,
  MIN_COLUMN_WIDTH,
} from '@/utils/adminTableColumns';

type ColumnInput = ColumnType[] | undefined;

/** 为管理端表格列注入可拖动列宽能力（兼容 computed 列定义） */
export function useAdminResizableColumns(
  sourceColumns: ComputedRef<ColumnInput>,
  enabled = true,
) {
  const columnWidths = ref<Record<string, number>>({});
  let resizingKey: string | null = null;
  let startX = 0;
  let startWidth = 0;

  function stopResize() {
    resizingKey = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
  }

  function onMouseMove(e: MouseEvent) {
    if (!resizingKey) return;
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + (e.clientX - startX));
    columnWidths.value = { ...columnWidths.value, [resizingKey]: nextWidth };
  }

  function startResize(key: string, e: MouseEvent, currentWidth: number) {
    e.preventDefault();
    e.stopPropagation();
    resizingKey = key;
    startX = e.clientX;
    startWidth = currentWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  }

  const columns = computed(() => {
    const raw = sourceColumns.value;
    if (!Array.isArray(raw)) return raw;

    return raw.map((col, index) => {
      const column = col as ResizableColumnType;
      const key = getAdminColumnKey(column, index);
      const storedWidth = columnWidths.value[key];
      const width = storedWidth ?? column.width;

      if (!enabled || column.resizable === false) {
        return width != null ? { ...column, width } : column;
      }

      const existingOnHeaderCell = column.onHeaderCell;
      return {
        ...column,
        ...(width != null ? { width } : {}),
        onHeaderCell: (headerColumn: ColumnType) => {
          const base =
            typeof existingOnHeaderCell === 'function' ? existingOnHeaderCell(headerColumn) : {};
          return {
            ...base,
            class: [base.class, 'admin-table-col-resizable'].filter(Boolean).join(' ') || undefined,
            onMousedown: (e: MouseEvent) => {
              (base as { onMousedown?: (ev: MouseEvent) => void }).onMousedown?.(e);
              const cell = e.currentTarget as HTMLElement | null;
              if (!cell || !isColumnResizeEdge(e, cell)) return;
              const current =
                columnWidths.value[key] ??
                (typeof headerColumn.width === 'number' ? headerColumn.width : cell.offsetWidth);
              startResize(key, e, current);
            },
          };
        },
      };
    });
  });

  function resetColumnWidths() {
    columnWidths.value = {};
  }

  onUnmounted(stopResize);

  return { columns, columnWidths, resetColumnWidths };
}
