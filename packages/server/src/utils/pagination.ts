import { normalizePagination, type PaginationQuery } from '@douxing/shared';

export function parsePaginationQuery(
  query: Record<string, unknown>,
  defaults?: { pageSize?: number; maxPageSize?: number },
) {
  const page = query.page != null ? Number(query.page) : undefined;
  const pageSize = query.pageSize != null ? Number(query.pageSize) : undefined;
  return normalizePagination({ page, pageSize }, defaults);
}

export function paginationQueryFromExpress(query: Record<string, unknown>): PaginationQuery {
  return {
    page: query.page != null ? Number(query.page) : undefined,
    pageSize: query.pageSize != null ? Number(query.pageSize) : undefined,
  };
}
