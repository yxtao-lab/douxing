import { ref, type Ref } from 'vue';
import {
  MOBILE_DEFAULT_PAGE_SIZE,
  normalizePaginatedResult,
  type PaginatedResult,
} from '@douxing/shared';

export function useInfiniteList<T>(
  fetchPage: (
    page: number,
    pageSize: number,
  ) => Promise<PaginatedResult<T> | T[] | null | undefined>,
  options?: { pageSize?: number },
) {
  const pageSize = options?.pageSize ?? MOBILE_DEFAULT_PAGE_SIZE;
  const items = ref([]) as Ref<T[]>;
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const total = ref(0);
  const page = ref(0);

  async function loadInitial() {
    loading.value = true;
    page.value = 0;
    hasMore.value = true;
    items.value = [];
    try {
      const raw = await fetchPage(1, pageSize);
      const result = normalizePaginatedResult(raw, { page: 1, pageSize });
      items.value = result.items;
      total.value = result.total;
      hasMore.value = result.hasMore;
      page.value = result.page;
    } finally {
      loading.value = false;
    }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      const nextPage = page.value + 1;
      const raw = await fetchPage(nextPage, pageSize);
      const result = normalizePaginatedResult(raw, { page: nextPage, pageSize });
      items.value = [...items.value, ...result.items];
      total.value = result.total;
      hasMore.value = result.hasMore;
      page.value = result.page;
    } finally {
      loadingMore.value = false;
    }
  }

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    total,
    loadInitial,
    loadMore,
  };
}
