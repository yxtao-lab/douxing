import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_PAGE_SIZE, normalizePaginatedResult, type PaginatedResult } from '@douxing/shared';
import { createAdminPaginationConfig } from '@/utils/adminPagination';

export function useServerTablePagination<T>(
  fetchPage: (
    page: number,
    pageSize: number,
  ) => Promise<PaginatedResult<T> | T[] | null | undefined>,
  options?: { defaultPageSize?: number },
) {
  const { t } = useI18n();
  const items = ref([]) as Ref<T[]>;
  const loading = ref(false);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(options?.defaultPageSize ?? DEFAULT_PAGE_SIZE);

  function formatPaginationTotal(totalCount: number, range: [number, number]) {
    return t('common.paginationTotal', {
      start: range[0],
      end: range[1],
      total: totalCount,
    });
  }

  const pagination = computed(() =>
    createAdminPaginationConfig(
      {
        current: page.value,
        pageSize: pageSize.value,
        total: total.value,
      },
      formatPaginationTotal,
    ),
  );

  async function load() {
    loading.value = true;
    try {
      const raw = await fetchPage(page.value, pageSize.value);
      const result = normalizePaginatedResult(raw, {
        page: page.value,
        pageSize: pageSize.value,
      });
      items.value = result.items;
      total.value = result.total;
      page.value = result.page;
      pageSize.value = result.pageSize;
    } finally {
      loading.value = false;
    }
  }

  function handleTableChange(pag: { current?: number; pageSize?: number }) {
    page.value = pag.current ?? 1;
    if (pag.pageSize != null) {
      pageSize.value = pag.pageSize;
    }
    void load();
  }

  function reload() {
    page.value = 1;
    void load();
  }

  return {
    items,
    loading,
    total,
    page,
    pageSize,
    pagination,
    load,
    reload,
    handleTableChange,
  };
}
