import {
  APP_TIMEZONE,
  DISPLAY_DATETIME_FORMAT,
  formatDisplayDateTime,
} from '@douxing/shared';
import { ADMIN_TABLE_EMPTY_PLACEHOLDER } from '@/utils/adminTableColumns';

/** 管理端表格/导出统一时间格式：yy-mm-dd HH:mm:ss */
export const ADMIN_DATETIME_FORMAT = DISPLAY_DATETIME_FORMAT;

export { APP_TIMEZONE };

/**
 * 将 API 时间值格式化为管理端统一展示格式（东八区 yy-mm-dd HH:mm:ss）。
 *
 * @param value - 时间值；空值返回表格占位符 `-`
 * @returns 格式化字符串或 `-`
 */
export function formatAdminDateTime(value: unknown): string {
  if (value == null || value === '') return ADMIN_TABLE_EMPTY_PLACEHOLDER;

  const raw = String(value).trim();
  if (!raw) return ADMIN_TABLE_EMPTY_PLACEHOLDER;

  const formatted = formatDisplayDateTime(raw);
  return formatted || ADMIN_TABLE_EMPTY_PLACEHOLDER;
}
