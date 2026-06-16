/** H9-3：景点开放时长窗口（单段） */
import { parseWeekdayFromCalendarDate } from './route-day-dates.js';

export interface AttractionOpenHoursWindow {
  /** 如 08:30 */
  open: string;
  /** 如 17:00 */
  close: string;
  /** 0=周日 … 6=周六；省略表示每日相同 */
  weekdays?: number[];
}

/** H9-3：景点开放时长 */
export interface AttractionOpenHours {
  windows: AttractionOpenHoursWindow[];
  /** 固定闭馆日（0=周日 … 6=周六） */
  closedWeekdays?: number[];
}

export type OpenHoursConflictKind = 'closed_day' | 'before_open' | 'after_close';

export interface OpenHoursCheckResult {
  conflict: boolean;
  kind?: OpenHoursConflictKind;
  openMinutes?: number;
  closeMinutes?: number;
}

/** 将 HH:mm 解析为当日分钟数 */
export function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 从路线 date / calendarDate 字段解析星期（优先 ISO） */
export function parseWeekdayFromRouteDate(date: string | undefined | null): number | null {
  return parseWeekdayFromCalendarDate(date);
}

function windowApplies(window: AttractionOpenHoursWindow, weekday: number | null): boolean {
  if (!window.weekdays?.length) return true;
  if (weekday == null) return true;
  return window.weekdays.includes(weekday);
}

/** 检测游玩时段是否与开放时长冲突 */
export function checkVisitOpenHours(
  visitStartMinutes: number,
  visitEndMinutes: number,
  openHours: AttractionOpenHours,
  weekday?: number | null,
): OpenHoursCheckResult {
  const hasWindows = (openHours.windows?.length ?? 0) > 0;
  const hasClosedDays = (openHours.closedWeekdays?.length ?? 0) > 0;
  if (!hasWindows && !hasClosedDays) {
    return { conflict: false };
  }

  const wd = weekday ?? null;
  if (wd != null && openHours.closedWeekdays?.includes(wd)) {
    return { conflict: true, kind: 'closed_day' };
  }

  const applicableWindows = (openHours.windows ?? []).filter((w) => windowApplies(w, wd));
  if (applicableWindows.length === 0) {
    return { conflict: false };
  }

  for (const window of applicableWindows) {
    const open = parseTimeToMinutes(window.open);
    const close = parseTimeToMinutes(window.close);
    if (open == null || close == null) continue;
    if (visitStartMinutes >= open && visitEndMinutes <= close) {
      return { conflict: false };
    }
  }

  let earliestOpen = Number.POSITIVE_INFINITY;
  let latestClose = Number.NEGATIVE_INFINITY;
  for (const window of applicableWindows) {
    const open = parseTimeToMinutes(window.open);
    const close = parseTimeToMinutes(window.close);
    if (open == null || close == null) continue;
    earliestOpen = Math.min(earliestOpen, open);
    latestClose = Math.max(latestClose, close);
  }

  if (!Number.isFinite(earliestOpen) || !Number.isFinite(latestClose)) {
    return { conflict: false };
  }

  if (visitStartMinutes < earliestOpen) {
    return {
      conflict: true,
      kind: 'before_open',
      openMinutes: earliestOpen,
      closeMinutes: latestClose,
    };
  }
  if (visitEndMinutes > latestClose) {
    return {
      conflict: true,
      kind: 'after_close',
      openMinutes: earliestOpen,
      closeMinutes: latestClose,
    };
  }

  return {
    conflict: true,
    kind: 'after_close',
    openMinutes: earliestOpen,
    closeMinutes: latestClose,
  };
}

/** 分钟数格式化为 HH:mm */
export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
