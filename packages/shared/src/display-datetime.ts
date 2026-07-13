/** 业务时区（与 DB_TIMEZONE / project.manifest 一致） */
export const APP_TIMEZONE = 'Asia/Shanghai';

/** 全局用户可见时间格式：yy-mm-dd HH:mm:ss（东八区，24 小时制） */
export const DISPLAY_DATETIME_FORMAT = 'YY-MM-DD HH:mm:ss';

const DISPLAY_DATETIME_RE = /^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const NAIVE_DATETIME_4Y_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const SHANGHAI_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIMEZONE,
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * 判断字符串是否像可展示的时间值（ISO、无时区 naive、已格式化或纯日期）。
 *
 * @param value - 待检测字符串
 * @returns 为真时表示应走 `formatDisplayDateTime` 统一格式化
 */
export function isDisplayDateTimeLike(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  return (
    DISPLAY_DATETIME_RE.test(raw)
    || NAIVE_DATETIME_4Y_RE.test(raw)
    || DATE_ONLY_RE.test(raw)
    || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)
  );
}

/**
 * 将 API / DB / Date 值格式化为全局统一展示字符串（东八区 yy-mm-dd HH:mm:ss）。
 * 不对无时区 naive 字符串做 UTC 偏移，避免环境误把北京时间当作 UTC 再 +8 小时。
 *
 * @param value - 时间值；`null` / `undefined` / 空字符串返回 `''`
 * @returns 格式化后的展示字符串；无法解析时回退为去 `T` 后的前 19 位或原串截断
 */
export function formatDisplayDateTime(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '';

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return '';

    if (DISPLAY_DATETIME_RE.test(raw)) {
      return raw;
    }

    if (DATE_ONLY_RE.test(raw)) {
      return `${raw.slice(2)} 00:00:00`;
    }

    if (NAIVE_DATETIME_4Y_RE.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      const normalized = raw.replace('T', ' ').slice(0, 19);
      const parsed = new Date(normalized.replace(' ', 'T'));
      return Number.isNaN(parsed.getTime())
        ? `${normalized.slice(2)}`
        : SHANGHAI_FORMATTER.format(parsed);
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? raw.slice(0, 19).replace('T', ' ')
      : SHANGHAI_FORMATTER.format(parsed);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return SHANGHAI_FORMATTER.format(value);
  }

  return String(value).slice(0, 19).replace('T', ' ');
}
