import type { LocaleCode } from './i18n/types.js';
import { DEFAULT_LOCALE } from './i18n/constants.js';
import { formatRouteDayDate } from './i18n/plan-route-names.js';
import type { RouteDayPlan } from './types.js';

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** 是否为 ISO 日历日（YYYY-MM-DD） */
export function isIsoCalendarDate(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return ISO_DATE_PREFIX.test(value.trim());
}

/** 从字符串提取 ISO 日历日前缀 */
export function extractIsoCalendarDate(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(ISO_DATE_PREFIX);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 由出发日与 dayIndex 推算 ISO 日历日 */
export function resolveCalendarDateFromStart(
  dayIndex: number,
  startDate?: string | null,
): string {
  const iso = extractIsoCalendarDate(startDate);
  if (iso) {
    const base = new Date(`${iso}T12:00:00`);
    if (!Number.isNaN(base.getTime())) {
      base.setDate(base.getDate() + dayIndex);
      return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
    }
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + dayIndex + 1);
  return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
}

/** 解析路线日的 ISO 日历日期（Enricher / 班次 / 开放时长） */
export function resolveRouteDayCalendarDate(
  day: Pick<RouteDayPlan, 'date' | 'calendarDate'>,
  dayIndex: number,
  startDate?: string | null,
): string {
  const fromCalendarField = extractIsoCalendarDate(day.calendarDate);
  if (fromCalendarField) return fromCalendarField;

  const legacyIsoInDate = extractIsoCalendarDate(day.date);
  if (legacyIsoInDate) return legacyIsoInDate;

  return resolveCalendarDateFromStart(dayIndex, startDate);
}

/** 从 ISO 日历日解析星期（0=周日 … 6=周六） */
export function parseWeekdayFromCalendarDate(calendarDate: string | undefined | null): number | null {
  const iso = extractIsoCalendarDate(calendarDate);
  if (!iso) return null;
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
}

/** 从路线日解析星期（优先 calendarDate） */
export function parseWeekdayFromRouteDay(
  day: Pick<RouteDayPlan, 'date' | 'calendarDate'>,
  dayIndex: number,
  startDate?: string | null,
): number | null {
  return parseWeekdayFromCalendarDate(resolveRouteDayCalendarDate(day, dayIndex, startDate));
}

/**
 * 统一 UI 展示日与系统日历日：
 * - `date`：第 N 天 / Day N（UI 主文案）
 * - `calendarDate`：YYYY-MM-DD（Enricher / 班次 / 开放时长）
 */
export function normalizeRouteDayPlans(
  days: RouteDayPlan[],
  options?: { startDate?: string | null; locale?: LocaleCode },
): RouteDayPlan[] {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  return days.map((day, index) => {
    const calendarDate = resolveRouteDayCalendarDate(day, index, options?.startDate);
    const displayDate = isIsoCalendarDate(day.date)
      ? formatRouteDayDate(index, locale)
      : day.date?.trim() || formatRouteDayDate(index, locale);

    return {
      ...day,
      date: displayDate,
      calendarDate,
    };
  });
}
