export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MOBILE_DEFAULT_PAGE_SIZE = 20;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function normalizePagination(
  query: PaginationQuery,
  defaults?: { pageSize?: number; maxPageSize?: number },
): { page: number; pageSize: number; offset: number } {
  const maxPageSize = defaults?.maxPageSize ?? MAX_PAGE_SIZE;
  const defaultPageSize = defaults?.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageRaw = query.page ?? DEFAULT_PAGE;
  const pageSizeRaw = query.pageSize ?? defaultPageSize;
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : DEFAULT_PAGE;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), maxPageSize)
      : defaultPageSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export function appendPaginationQuery(params: URLSearchParams, page: number, pageSize: number) {
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
}
