/** 解析管理端列表筛选查询参数 */

export function parseOptionalString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseOptionalInt(
  query: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = query[key];
  if (value == null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseDateRangeFilter(query: Record<string, unknown>) {
  return {
    dateStart: parseOptionalString(query, 'dateStart'),
    dateEnd: parseOptionalString(query, 'dateEnd'),
  };
}

export function parseDayStart(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function parseOptionalBoolean(
  query: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = query[key];
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return undefined;
}
