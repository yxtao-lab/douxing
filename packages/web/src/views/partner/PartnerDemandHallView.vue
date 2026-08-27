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
        <template #left>
          <a-alert
            v-if="!canQuote"
            type="info"
            :message="t('partner.notQuotable')"
            show-icon
            class="partner-hall-alert"
          >
            <template #action>
              <a-button size="small" @click="$router.push({ name: 'partner-onboard' })">
                {{ t('partner.goOnboard') }}
              </a-button>
            </template>
          </a-alert>
        </template>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="partner.demandsTitle"
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
      :empty-text="t('common.noData')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag>{{ demandStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="info"
              :label="t('partner.viewDetail')"
              @click="goDetail(record.id)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { ServiceDemandSummary } from '@douxing/shared';
import { fetchPartnerDemandHallPage } from '@/api/marketplace-partner';
import { usePartnerContext } from '@/composables/usePartnerContext';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('partner.demandsTitle');
const { t } = useLocale();
const router = useRouter();
const { context, reload: reloadContext } = usePartnerContext();
const keyword = ref('');
const destinationFilter = ref('');
const error = ref('');

const canQuote = computed(() => {
  if (!context.value) return false;
  return context.value.canQuoteAsProvider || context.value.quotableOrgIds.length > 0;
});

const { items: list, loading, pagination, reload, handleTableChange } =
  useServerTablePagination<ServiceDemandSummary>((page, pageSize) =>
    fetchPartnerDemandHallPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      destination: destinationFilter.value.trim() || undefined,
    }),
  );

const columns = computed<AdminExportColumn<ServiceDemandSummary>[]>(() => [
  { title: t('marketplace.demandColTitle'), dataIndex: 'title', width: 220 },
  { title: t('marketplace.demandColDestination'), dataIndex: 'destination', width: 140 },
  { title: t('marketplace.demandColStatus'), key: 'status', width: 120, exportValue: (row) => demandStatusLabel(row.status) },
  { title: t('marketplace.demandColNo'), dataIndex: 'demandNo', width: 160 },
  { title: t('partner.colAction'), key: 'action', width: 100, resizable: false },
]);

/**
 * 解析需求状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 重置筛选条件并重新加载。
 */
function resetSearch() {
  keyword.value = '';
  destinationFilter.value = '';
  reload();
}

/**
 * 跳转需求详情。
 *
 * @param id - 需求 ID
 */
function goDetail(id: number) {
  router.push({ name: 'partner-demand-detail', params: { id } });
}

/**
 * 导出报表时拉取全量行。
 *
 * @returns 当前筛选条件下的全部需求
 */
async function fetchExportRows() {
  return fetchAllPaginatedRows((page, pageSize) =>
    fetchPartnerDemandHallPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      destination: destinationFilter.value.trim() || undefined,
    }),
  );
}

onMounted(async () => {
  await reloadContext();
  await reload();
});
</script>

<style scoped>
.partner-hall-alert {
  margin: 0;
  flex: 1;
  min-width: 0;
}
</style>
