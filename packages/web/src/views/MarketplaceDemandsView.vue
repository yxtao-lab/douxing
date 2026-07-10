<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('marketplace.demandColTitle')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('marketplace.demandSearchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.demandColStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.demandColDestination')">
          <a-input
            v-model:value="destinationFilter"
            :placeholder="t('marketplace.demandDestinationPlaceholder')"
            allow-clear
            style="width: 160px"
            @press-enter="reload"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.marketplaceDemands"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="reload">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <DouxingAdminTable
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :error="error"
      :empty-text="t('marketplace.demandEmpty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag>{{ demandStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'categoryCode'">
          {{ categoryLabel(record.categoryCode) }}
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { DemandStatus, SERVICE_CATEGORY_TREE, type ServiceDemandSummary } from '@douxing/shared';
import { fetchMarketplaceDemandsPage } from '@/api/marketplace';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('web.marketplaceDemands');

const { t } = useI18n();
const keyword = ref('');
const statusFilter = ref<string | undefined>();
const destinationFilter = ref('');
const error = ref('');

const statusOptions = computed(() =>
  Object.values(DemandStatus).map((value) => ({
    label: demandStatusLabel(value),
    value,
  })),
);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<ServiceDemandSummary>((page, pageSize) =>
    fetchMarketplaceDemandsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      destination: destinationFilter.value.trim() || undefined,
    }),
  );

/**
 * 将类目 code 转为展示文案。
 *
 * @param code - 点分类目 code
 * @returns 本地化标签
 */
function categoryLabel(code: string) {
  for (const node of SERVICE_CATEGORY_TREE) {
    if (node.code === code) return t(node.labelKey);
    for (const child of node.children ?? []) {
      if (child.code === code) return t(child.labelKey);
    }
  }
  return code;
}

/**
 * 将需求状态 code 转为展示文案。
 *
 * @param status - 状态枚举值
 * @returns 本地化标签
 */
function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}` as const;
  const translated = t(key);
  return translated !== key ? translated : status;
}

function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  destinationFilter.value = '';
  reload();
}

const columns = computed<AdminExportColumn<ServiceDemandSummary>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 72 },
  { title: t('marketplace.demandColNo'), dataIndex: 'demandNo', width: 160 },
  { title: t('marketplace.demandColTitle'), dataIndex: 'title', ellipsis: true },
  {
    title: t('marketplace.demandColCategory'),
    key: 'categoryCode',
    width: 120,
    exportValue: (record) => categoryLabel(record.categoryCode),
  },
  {
    title: t('marketplace.demandColDestination'),
    dataIndex: 'destination',
    width: 100,
    exportValue: (record) => formatAdminTableCell(record.destination),
  },
  {
    title: t('marketplace.demandColStatus'),
    key: 'status',
    width: 100,
    exportValue: (record) => demandStatusLabel(record.status),
  },
  { title: t('marketplace.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchMarketplaceDemandsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      destination: destinationFilter.value.trim() || undefined,
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

onMounted(load);
</script>
