import ExcelJS from 'exceljs';
import type { ColumnType } from 'ant-design-vue/es/table';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

export type AdminExportColumn<T = Record<string, unknown>> = ColumnType<T> & {
  /** 设为 false 时跳过该列 */
  exportable?: boolean;
  /** 导出单元格文案（须与表格展示一致，含 i18n） */
  exportValue?: (record: T, index: number) => string | number | null | undefined;
};

const ACTION_COLUMN_KEYS = new Set(['action', 'actions']);
const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 100;

function isActionColumn<T>(col: ColumnType<T>): boolean {
  const key = col.key != null ? String(col.key) : '';
  return ACTION_COLUMN_KEYS.has(key) || key.endsWith('Action');
}

export function isExportableColumn<T>(col: ColumnType<T>): boolean {
  const exportCol = col as AdminExportColumn<T>;
  if (exportCol.exportable === false) return false;
  if (isActionColumn(col)) return false;
  return Boolean(col.dataIndex || exportCol.exportValue || (col.key && !isActionColumn(col)));
}

function getNestedValue(record: Record<string, unknown>, dataIndex: ColumnType['dataIndex']): unknown {
  if (dataIndex == null) return undefined;
  if (Array.isArray(dataIndex)) {
    return dataIndex.reduce<unknown>((obj, key) => {
      if (obj == null || typeof obj !== 'object') return undefined;
      return (obj as Record<string, unknown>)[key];
    }, record);
  }
  return record[String(dataIndex)];
}

function formatCellValue(value: unknown): string {
  return formatAdminTableCell(value);
}

/** 估算 Excel 列宽（CJK 按双宽计） */
export function getCellDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 255 ? 2 : 1;
  }
  return width;
}

export function getColumnExportTitle(col: ColumnType): string {
  const title = col.title;
  if (typeof title === 'string') return title;
  return '';
}

export function getCellExportValue<T extends Record<string, unknown>>(
  col: ColumnType<T>,
  record: T,
  index: number,
): string {
  const exportCol = col as AdminExportColumn<T>;
  if (exportCol.exportValue) {
    return formatCellValue(exportCol.exportValue(record, index));
  }
  if (typeof col.customRender === 'function') {
    const text = getNestedValue(record, col.dataIndex);
    const rendered = col.customRender({
      value: text,
      text,
      record,
      index,
      renderIndex: index,
      column: col,
    });
    if (typeof rendered === 'string' || typeof rendered === 'number') {
      return formatAdminTableCell(rendered);
    }
  }
  const raw =
    col.dataIndex != null
      ? getNestedValue(record, col.dataIndex)
      : col.key != null
        ? record[String(col.key)]
        : undefined;
  return formatAdminTableCell(raw);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 导出文件名时间戳：YYYY-MM-DD-HHmmss（本地时区） */
export function formatExportDatetime(date = new Date()): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-') + `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function sanitizeFilenamePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'report';
}

/** 报表文件名：{功能名称}-{时间}.xlsx */
export function formatExportFilename(reportName: string): string {
  return `${sanitizeFilenamePart(reportName)}-${formatExportDatetime()}.xlsx`;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '-').trim();
  return cleaned.slice(0, 31) || 'Sheet1';
}

function downloadBlobFile(filename: string, buffer: ArrayBuffer, mimeType: string): void {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function applyAutoColumnWidths(
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  dataRows: string[][],
): void {
  headers.forEach((header, colIndex) => {
    let maxWidth = getCellDisplayWidth(header);
    for (const row of dataRows) {
      maxWidth = Math.max(maxWidth, getCellDisplayWidth(String(row[colIndex] ?? '')));
    }
    const column = worksheet.getColumn(colIndex + 1);
    column.width = Math.min(Math.max(maxWidth + 2, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
  });
}

export function flattenTreeRows<T>(
  nodes: T[],
  getChildren: (node: T) => T[] | undefined = (node) => (node as { children?: T[] }).children,
): T[] {
  const result: T[] = [];
  for (const node of nodes) {
    result.push(node);
    const children = getChildren(node);
    if (children?.length) {
      result.push(...flattenTreeRows(children, getChildren));
    }
  }
  return result;
}

export async function exportAdminTableXlsx<T extends Record<string, unknown>>(
  columns: ColumnType<T>[],
  rows: T[],
  reportName: string,
): Promise<void> {
  const exportColumns = columns.filter(isExportableColumn);
  const headers = exportColumns.map(getColumnExportTitle);
  const dataRows = rows.map((record, index) =>
    exportColumns.map((col) => getCellExportValue(col, record, index)),
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sanitizeSheetName(reportName));

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  for (const row of dataRows) {
    const dataRow = worksheet.addRow(row);
    dataRow.alignment = { vertical: 'top', wrapText: true };
  }

  applyAutoColumnWidths(worksheet, headers, dataRows);

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlobFile(
    formatExportFilename(reportName),
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
