<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('marketplace.disputeColOrderNo')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('marketplace.disputeSearchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.disputeColStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.disputeColType')">
          <a-select
            v-model:value="typeFilter"
            :options="typeOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.typeAll')"
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
            name-key="web.marketplaceDisputes"
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
      :empty-text="t('marketplace.disputeEmpty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag>{{ disputeStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'type'">
          {{ disputeTypeLabel(record.type) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar>
            <TableActionButton
              variant="primary"
              :label="t('marketplace.disputeResolve')"
              @click="openResolve(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="resolveModalOpen"
      :title="t('marketplace.disputeResolveTitle')"
      :confirm-loading="resolving"
      @ok="handleResolve"
      @cancel="closeResolve"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('marketplace.disputeColStatus')">
          <a-select
            v-model:value="resolveStatus"
            :options="resolveStatusOptions"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.disputePlatformNote')">
          <a-textarea
            v-model:value="resolvePlatformNote"
            :rows="4"
            :placeholder="t('marketplace.disputePlatformNotePlaceholder')"
            :maxlength="2000"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  ServiceOrderDisputeStatus,
  ServiceOrderDisputeType,
  type ServiceOrderDisputeSummary,
} from '@douxing/shared';
import {
  fetchMarketplaceDisputesPage,
  resolveMarketplaceDispute,
} from '@/api/marketplace';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';
import { formatAdminTableCell } from '@/utils/adminTableColumns';
import { formatAdminDateTime } from '@/utils/adminDateTime';
import { message } from 'ant-design-vue';
import { getAppErrorMessage } from '@/utils/error-message';

usePageTitle('web.marketplaceDisputes');

const { t } = useI18n();
const keyword = ref('');
const statusFilter = ref<string | undefined>();
const typeFilter = ref<string | undefined>();
const error = ref('');
const resolveModalOpen = ref(false);
const resolving = ref(false);
const resolveTarget = ref<ServiceOrderDisputeSummary | null>(null);
const resolveStatus = ref<string>(ServiceOrderDisputeStatus.PLATFORM_PROCESSING);
const resolvePlatformNote = ref('');

const statusOptions = computed(() =>
  Object.values(ServiceOrderDisputeStatus).map((value) => ({
    label: disputeStatusLabel(value),
    value,
  })),
);

const typeOptions = computed(() =>
  Object.values(ServiceOrderDisputeType).map((value) => ({
    label: disputeTypeLabel(value),
    value,
  })),
);

const resolveStatusOptions = computed(() =>
  [
    ServiceOrderDisputeStatus.PLATFORM_PROCESSING,
    ServiceOrderDisputeStatus.RESOLVED_BUYER,
    ServiceOrderDisputeStatus.RESOLVED_SELLER,
    ServiceOrderDisputeStatus.CLOSED,
  ].map((value) => ({
    label: disputeStatusLabel(value),
    value,
  })),
);

const columns = computed(() => [
  {
    title: t('marketplace.disputeColOrderNo'),
    dataIndex: 'orderNo',
    key: 'orderNo',
    width: 180,
  },
  {
    title: t('marketplace.disputeColInitiator'),
    key: 'initiator',
    width: 140,
    customRender: ({ record }: { record: ServiceOrderDisputeSummary }) =>
      record.initiatorNickname || record.initiatorUsername || formatAdminTableCell(record.initiatorUserId),
  },
  {
    title: t('marketplace.disputeColType'),
    dataIndex: 'type',
    key: 'type',
    width: 120,
  },
  {
    title: t('marketplace.disputeColReason'),
    dataIndex: 'reason',
    key: 'reason',
    width: 240,
    ellipsis: true,
  },
  {
    title: t('marketplace.disputeColStatus'),
    dataIndex: 'status',
    key: 'status',
    width: 120,
  },
  {
    title: t('marketplace.disputeColCreatedAt'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ record }: { record: ServiceOrderDisputeSummary }) =>
      formatAdminDateTime(record.createdAt),
  },
  {
    title: t('common.action'),
    key: 'action',
    width: 120,
  },
] as AdminExportColumn[]);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<ServiceOrderDisputeSummary>((page, pageSize) =>
    fetchMarketplaceDisputesPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      type: typeFilter.value,
    }),
  );

/**
 * 将争议类型转为展示文案。
 *
 * @param type - 争议类型值
 * @returns 本地化标签
 */
function disputeTypeLabel(type: string) {
  const key = `marketplace.disputeType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 将争议状态转为展示文案。
 *
 * @param status - 争议状态值
 * @returns 本地化标签
 */
function disputeStatusLabel(status: string) {
  const key = `marketplace.disputeStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 重置筛选条件。
 */
function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  typeFilter.value = undefined;
  reload();
}

/**
 * 导出全量争议列表。
 *
 * @returns 全量数据
 */
async function fetchExportRows() {
  return fetchAllPaginatedRows(
    (page, pageSize) =>
      fetchMarketplaceDisputesPage({
        page,
        pageSize,
        keyword: keyword.value.trim() || undefined,
        status: statusFilter.value,
        type: typeFilter.value,
      }),
    100,
  );
}

/**
 * 打开争议仲裁弹窗。
 *
 * @param record - 争议记录
 */
function openResolve(record: ServiceOrderDisputeSummary) {
  resolveTarget.value = record;
  resolveStatus.value = record.status === ServiceOrderDisputeStatus.PENDING
    ? ServiceOrderDisputeStatus.PLATFORM_PROCESSING
    : record.status;
  resolvePlatformNote.value = record.platformNote ?? '';
  resolveModalOpen.value = true;
}

/**
 * 关闭仲裁弹窗。
 */
function closeResolve() {
  resolveModalOpen.value = false;
  resolveTarget.value = null;
  resolvePlatformNote.value = '';
}

/**
 * 提交仲裁结果。
 */
async function handleResolve() {
  if (!resolveTarget.value) return;
  resolving.value = true;
  try {
    await resolveMarketplaceDispute(resolveTarget.value.id, {
      status: resolveStatus.value as ServiceOrderDisputeSummary['status'],
      platformNote: resolvePlatformNote.value.trim() || undefined,
    });
    message.success(t('marketplace.disputeResolveSuccess'));
    closeResolve();
    reload();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('marketplace.disputeResolveFailed')));
  } finally {
    resolving.value = false;
  }
}

onMounted(load);
</script>
