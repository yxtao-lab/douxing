import { ADMIN_TABLE_EMPTY_PLACEHOLDER } from '@/utils/adminTableColumns';

/** 业务时区（与 DB_TIMEZONE / project.manifest 一致） */
export const APP_TIMEZONE = 'Asia/Shanghai';

/** 管理端表格/导出统一时间格式：yyyy-MM-dd HH:mm:ss */
export const ADMIN_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const SHANGHAI_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * 将 API 时间值格式化为管理端统一展示格式（东八区）。
 * 服务端已返回 `yyyy-MM-dd HH:mm:ss` 时直接展示，避免二次时区换算。
 */
export function formatAdminDateTime(value: unknown): string {
  if (value == null || value === '') return ADMIN_TABLE_EMPTY_PLACEHOLDER;

  const raw = String(value).trim();
  if (!raw) return ADMIN_TABLE_EMPTY_PLACEHOLDER;

  if (NAIVE_DATETIME_RE.test(raw)) {
    return raw;
  }

  const normalized = raw.replace('T', ' ').slice(0, 19);
  if (NAIVE_DATETIME_RE.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return normalized || ADMIN_TABLE_EMPTY_PLACEHOLDER;
  }

  return SHANGHAI_FORMATTER.format(parsed);
}
