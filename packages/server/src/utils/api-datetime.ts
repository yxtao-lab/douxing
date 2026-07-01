/** 业务时区（与 DB_TIMEZONE / project.manifest 一致） */
export const APP_TIMEZONE = 'Asia/Shanghai';

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

const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;

/**
 * 将 MySQL 读出的时间格式化为 API 响应用的东八区本地字符串（yyyy-MM-dd HH:mm:ss）。
 * 不对无时区字符串做 ISO 转换，避免 UTC 环境误把北京时间当作 UTC 再 +8 小时。
 */
export function formatDbDateTimeForApi(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '';

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return '';
    if (NAIVE_DATETIME_RE.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      return raw.replace('T', ' ').slice(0, 19);
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw.slice(0, 19).replace('T', ' ') : SHANGHAI_FORMATTER.format(parsed);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return SHANGHAI_FORMATTER.format(value);
  }

  return String(value).slice(0, 19).replace('T', ' ');
}

/** @deprecated 日志等管理端展示请使用 formatDbDateTimeForApi */
export function toApiIsoDateTime(value: Date | string | null | undefined): string {
  return formatDbDateTimeForApi(value);
}
