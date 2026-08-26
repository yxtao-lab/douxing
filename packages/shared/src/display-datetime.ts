/** 业务时区（与 DB_TIMEZONE / project.manifest 一致） */
export const APP_TIMEZONE = 'Asia/Shanghai';

/** 全局用户可见时间格式：yyyy-mm-dd HH:mm:ss（东八区，24 小时制） */
export const DISPLAY_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/** 标准展示串：`2026-07-14 15:47:48` */
const DISPLAY_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
/** 历史两位年展示串（兼容升级前缓存/旧 API）：`26-07-14 15:47:48` */
const DISPLAY_DATETIME_2Y_RE = /^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const NAIVE_DATETIME_4Y_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TZ_OFFSET_RE = /[zZ]|[+-]\d{2}:?\d{2}$/;

/** 东八区相对 UTC 的固定偏移（毫秒）；上海无夏令时，不可用 `Intl`（微信小程序无该全局对象） */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Date.prototype.toString() 一类：`Tue Jul 14 2026 15:47:48 GMT+0800 (...)` */
const JS_DATE_TOSTRING_RE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}/i;

/**
 * 将历史两位年展示串扩成四位年（按 20xx 世纪）。
 *
 * @param raw - 形如 `26-07-14 15:47:48`
 * @returns 形如 `2026-07-14 15:47:48`
 */
function expandTwoDigitDisplayDateTime(raw: string): string {
  return `20${raw}`;
}

/**
 * 补零到两位。
 *
 * @param value - 数字
 * @returns 两位字符串
 */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 按 UTC 分量格式化为墙钟串（用于 mysql2 把北京墙钟误读成 UTC Instant 的场景）。
 *
 * @param date - Date 实例
 * @returns `yyyy-mm-dd HH:mm:ss`
 */
function formatUtcComponentsAsWallClock(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

/**
 * 将绝对时刻格式化为 Asia/Shanghai 墙钟串（不依赖 `Intl`，兼容微信小程序）。
 *
 * @param date - 有效 Date 实例
 * @returns `yyyy-mm-dd HH:mm:ss`（东八区）
 */
function formatShanghaiWallClock(date: Date): string {
  return formatUtcComponentsAsWallClock(new Date(date.getTime() + SHANGHAI_OFFSET_MS));
}

/**
 * 判断字符串是否像可展示的时间值（ISO、无时区 naive、已格式化、纯日期或 JS Date.toString）。
 *
 * @param value - 待检测字符串
 * @returns 为真时表示应走 `formatDisplayDateTime` 统一格式化
 */
export function isDisplayDateTimeLike(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  return (
    DISPLAY_DATETIME_RE.test(raw)
    || DISPLAY_DATETIME_2Y_RE.test(raw)
    || NAIVE_DATETIME_4Y_RE.test(raw)
    || DATE_ONLY_RE.test(raw)
    || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)
    || JS_DATE_TOSTRING_RE.test(raw)
  );
}

/**
 * 将 API / DB / Date 值格式化为全局统一展示字符串（东八区 yyyy-mm-dd HH:mm:ss）。
 *
 * - 无时区 naive 串：按墙钟原样展示，不做 UTC↔东八区换算（避免再 +8 小时）
 * - 带 `Z` / 偏移的 ISO：按绝对时刻转到 Asia/Shanghai
 * - `Date`：默认按 Asia/Shanghai；若调用方确认来自 MySQL DATETIME 误读，请用 `formatDbDateTimeForApi`
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

    if (DISPLAY_DATETIME_2Y_RE.test(raw)) {
      return expandTwoDigitDisplayDateTime(raw);
    }

    if (DATE_ONLY_RE.test(raw)) {
      return `${raw} 00:00:00`;
    }

    // 无时区 naive：库内/业务墙钟，禁止经 Date 再按上海时区换算（Node 在 UTC 下会 +8）
    if (NAIVE_DATETIME_4Y_RE.test(raw) && !HAS_TZ_OFFSET_RE.test(raw)) {
      return raw.replace('T', ' ').slice(0, 19);
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? raw.slice(0, 19).replace('T', ' ')
      : formatShanghaiWallClock(parsed);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatShanghaiWallClock(value);
  }

  return String(value).slice(0, 19).replace('T', ' ');
}

/**
 * 将数据库读出的时间格式化为 API 展示串。
 *
 * MySQL `DATETIME`/`TIMESTAMP` 经 mysql2 读出时，常把「北京墙钟」落成 UTC Instant
 *（`toISOString` 小时与墙钟相同）。若再按 Asia/Shanghai 格式化会多 +8 小时。
 * 因此对 `Date` 使用 UTC 分量还原墙钟；字符串仍走 {@link formatDisplayDateTime}。
 *
 * @param value - 数据库字段或已格式化串
 * @returns `yyyy-mm-dd HH:mm:ss`；空值返回 `''`
 */
export function formatDbDateTimeForApi(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatUtcComponentsAsWallClock(value);
  }
  return formatDisplayDateTime(value);
}
