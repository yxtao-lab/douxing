<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('marketplace.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('marketplace.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.colOrgType')">
          <a-select
            v-model:value="orgTypeFilter"
            :options="orgTypeOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.typeAll')"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
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
            name-key="web.marketplaceOrgs"
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
      :empty-text="t('marketplace.emptyOrgs')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'orgType'">
          {{ orgTypeLabel(record.orgType) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { BizOrgStatus, BizOrgType, type BizOrgSummary } from '@douxing/shared';
import { fetchMarketplaceOrgsPage } from '@/api/marketplace';
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

usePageTitle('web.marketplaceOrgs');

const { t } = useI18n();
const keyword = ref('');
const orgTypeFilter = ref<string | undefined>();
const statusFilter = ref<string | undefined>();

const orgTypeOptions = computed(() => [
  { label: t('marketplace.orgTypeTravelAgency'), value: BizOrgType.TRAVEL_AGENCY },
  { label: t('marketplace.orgTypePhotoStudio'), value: BizOrgType.PHOTO_STUDIO },
  { label: t('marketplace.orgTypeGuideStudio'), value: BizOrgType.GUIDE_STUDIO },
  { label: t('marketplace.orgTypeOutdoorClub'), value: BizOrgType.OUTDOOR_CLUB },
  { label: t('marketplace.orgTypeOther'), value: BizOrgType.OTHER },
]);

const statusOptions = computed(() => [
  { label: t('marketplace.statusPending'), value: BizOrgStatus.PENDING },
  { label: t('marketplace.statusActive'), value: BizOrgStatus.ACTIVE },
  { label: t('marketplace.statusRejected'), value: BizOrgStatus.REJECTED },
  { label: t('marketplace.statusFrozen'), value: BizOrgStatus.FROZEN },
]);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<BizOrgSummary>((page, pageSize) =>
    fetchMarketplaceOrgsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      orgType: orgTypeFilter.value,
    }),
  );

/**
 * 将组织类型 code 转为展示文案。
 *
 * @param orgType - 组织类型枚举值
 * @returns 本地化标签
 */
function orgTypeLabel(orgType: string) {
  const map: Record<string, string> = {
    [BizOrgType.TRAVEL_AGENCY]: t('marketplace.orgTypeTravelAgency'),
    [BizOrgType.PHOTO_STUDIO]: t('marketplace.orgTypePhotoStudio'),
    [BizOrgType.GUIDE_STUDIO]: t('marketplace.orgTypeGuideStudio'),
    [BizOrgType.OUTDOOR_CLUB]: t('marketplace.orgTypeOutdoorClub'),
    [BizOrgType.OTHER]: t('marketplace.orgTypeOther'),
  };
  return map[orgType] ?? orgType;
}

/**
 * 将状态 code 转为展示文案。
 *
 * @param status - 状态枚举值
 * @returns 本地化标签
 */
function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('marketplace.statusPending'),
    active: t('marketplace.statusActive'),
    rejected: t('marketplace.statusRejected'),
    frozen: t('marketplace.statusFrozen'),
  };
  return map[status] ?? status;
}

/**
 * 返回状态对应标签颜色。
 *
 * @param status - 状态枚举值
 * @returns Ant Design 标签颜色
 */
function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'orange',
    active: 'success',
    rejected: 'red',
    frozen: 'default',
  };
  return map[status] ?? 'default';
}

/**
 * 重置筛选条件。
 */
function resetSearch() {
  keyword.value = '';
  orgTypeFilter.value = undefined;
  statusFilter.value = undefined;
  reload();
}

const columns = computed<AdminExportColumn<BizOrgSummary>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: t('marketplace.colName'), dataIndex: 'name', ellipsis: true },
  {
    title: t('marketplace.colOrgType'),
    key: 'orgType',
    width: 120,
    exportValue: (record) => orgTypeLabel(record.orgType),
  },
  {
    title: t('marketplace.colLicenseNo'),
    dataIndex: 'licenseNo',
    width: 140,
    exportValue: (record) => formatAdminTableCell(record.licenseNo),
  },
  {
    title: t('marketplace.colContactPhone'),
    dataIndex: 'contactPhone',
    width: 130,
    exportValue: (record) => formatAdminTableCell(record.contactPhone),
  },
  {
    title: t('marketplace.colStatus'),
    key: 'status',
    width: 100,
    exportValue: (record) => statusLabel(record.status),
  },
  { title: t('marketplace.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchMarketplaceOrgsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      orgType: orgTypeFilter.value,
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

onMounted(load);
</script>
