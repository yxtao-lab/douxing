import type { PaginatedResult } from '@douxing/shared';

const EXPORT_PAGE_SIZE = 200;

/** 按当前筛选条件拉取全部分页数据，供报表导出使用 */
export async function fetchAllPaginatedRows<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  pageSize = EXPORT_PAGE_SIZE,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await fetchPage(page, pageSize);
    items.push(...result.items);
    if (!result.hasMore) break;
    page += 1;
  }
  return items;
}
