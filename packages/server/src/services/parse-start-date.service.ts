import { extractIsoCalendarDate } from '@douxing/shared';

const CN_WEEKDAY: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function atNoon(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = atNoon(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** 以周一为一周起点 */
function startOfWeekMonday(date: Date): Date {
  const copy = atNoon(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function weekdayOffsetFromMonday(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

function resolveWeekdayDate(
  weekday: number,
  scope: 'this' | 'next' | 'upcoming',
  referenceDate: Date,
): Date {
  const monday = startOfWeekMonday(referenceDate);
  if (scope === 'next') {
    monday.setDate(monday.getDate() + 7);
  }
  const candidate = addDays(monday, weekdayOffsetFromMonday(weekday));

  if (scope === 'upcoming') {
    const ref = atNoon(referenceDate);
    if (candidate.getTime() < ref.getTime()) {
      return addDays(candidate, 7);
    }
  }
  return candidate;
}

function parseMonthDay(text: string, referenceDate: Date): string | null {
  const match = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/);
  if (!match) return null;

  const year = match[1] ? parseInt(match[1], 10) : referenceDate.getFullYear();
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let resolvedYear = year;
  if (!match[1]) {
    const tentative = atNoon(new Date(`${resolvedYear}-${pad2(month)}-${pad2(day)}T12:00:00`));
    if (tentative.getTime() < atNoon(referenceDate).getTime()) {
      resolvedYear += 1;
    }
  }

  const iso = `${resolvedYear}-${pad2(month)}-${pad2(day)}`;
  return extractIsoCalendarDate(iso);
}

function parseRelativeDay(text: string, referenceDate: Date): string | null {
  if (/大后天/.test(text)) return toIsoDate(addDays(referenceDate, 3));
  if (/后天/.test(text)) return toIsoDate(addDays(referenceDate, 2));
  if (/明天/.test(text)) return toIsoDate(addDays(referenceDate, 1));
  if (/今天|今日/.test(text)) return toIsoDate(referenceDate);
  return null;
}

function parseWeekdayPhrase(text: string, referenceDate: Date): string | null {
  const patterns: Array<{ regex: RegExp; scope: 'this' | 'next' | 'upcoming' }> = [
    { regex: /下(?:个)?(?:周|星期|礼拜)([一二三四五六日天])/, scope: 'next' },
    { regex: /下([一二三四五六日天])/, scope: 'next' },
    { regex: /(?:本(?:个)?|这(?:个)?)(?:周|星期|礼拜)([一二三四五六日天])/, scope: 'this' },
    { regex: /(?:周|星期|礼拜)([一二三四五六日天])/, scope: 'upcoming' },
  ];

  for (const { regex, scope } of patterns) {
    const match = text.match(regex);
    const token = match?.[1];
    if (!token) continue;
    const weekday = CN_WEEKDAY[token];
    if (weekday == null) continue;
    return toIsoDate(resolveWeekdayDate(weekday, scope, referenceDate));
  }
  return null;
}

function parseExplicitIso(text: string): string | null {
  const isoMatch = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/);
  if (!isoMatch) return null;
  const iso = `${isoMatch[1]}-${pad2(parseInt(isoMatch[2]!, 10))}-${pad2(parseInt(isoMatch[3]!, 10))}`;
  return extractIsoCalendarDate(iso);
}

/** H9+-4：从自然语言解析出发日 ISO（YYYY-MM-DD） */
export function parseStartDateFromText(
  text: string,
  referenceDate: Date = new Date(),
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    parseExplicitIso(trimmed)
    ?? parseMonthDay(trimmed, referenceDate)
    ?? parseRelativeDay(trimmed, referenceDate)
    ?? parseWeekdayPhrase(trimmed, referenceDate)
  );
}

/** 当前句是否包含可解析的出发日期 */
export function hasExplicitStartDateInPrompt(text: string, referenceDate?: Date): boolean {
  return parseStartDateFromText(text, referenceDate ?? new Date()) != null;
}
