<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('marketplace.colDisplayName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('marketplace.providerSearchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('marketplace.colProviderType')">
          <a-select
            v-model:value="providerTypeFilter"
            :options="providerTypeOptions"
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
            name-key="web.marketplaceProvidersPending"
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
      :empty-text="t('marketplace.emptyPendingProviders')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'displayName'">
          {{ formatAdminTableCell(record.displayName || `#${record.userId}`) }}
        </template>
        <template v-else-if="column.key === 'providerType'">
          {{ providerTypeLabel(record.providerType) }}
        </template>
        <template v-else-if="column.key === 'categoryCodes'">
          {{ formatCategoryCodes(record.categoryCodes) }}
        </template>
        <template v-else-if="column.key === 'serviceRegions'">
          {{ formatRegions(record.serviceRegions) }}
        </template>
        <template v-else-if="column.key === 'certStatus'">
          <a-tag color="orange">{{ certStatusLabel(record.certStatus) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="success"
              :label="reviewingId === record.id ? t('marketplace.reviewing') : t('marketplace.approve')"
              :title="t('marketplace.approve')"
              @click="openReview(record, 'approve')"
            />
            <TableActionButton
              variant="delete"
              :label="t('marketplace.reject')"
              :title="t('marketplace.reject')"
              @click="openReview(record, 'reject')"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="reviewModalOpen"
      :title="reviewAction === 'approve' ? t('marketplace.providerApproveTitle') : t('marketplace.providerRejectTitle')"
      :confirm-loading="reviewingId != null"
      @ok="submitReview"
      @cancel="closeReviewModal"
    >
      <p v-if="reviewTarget" class="review-target">
        {{ t('marketplace.reviewTarget', { name: reviewDisplayName(reviewTarget) }) }}
      </p>
      <a-form-item :label="t('marketplace.reviewNote')">
        <a-textarea
          v-model:value="reviewNote"
          :rows="3"
          :placeholder="t('marketplace.reviewNotePlaceholder')"
        />
      </a-form-item>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { ProviderType, SERVICE_CATEGORY_TREE, type ServiceProviderSummary } from '@douxing/shared';
import {
  fetchPendingMarketplaceProvidersPage,
  reviewMarketplaceProvider,
} from '@/api/marketplace';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import { getAppErrorMessage } from '@/utils/error-message';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('web.marketplaceProvidersPending');

const { t } = useI18n();
const keyword = ref('');
const providerTypeFilter = ref<string | undefined>();
const error = ref('');
const reviewingId = ref<number | null>(null);
const reviewModalOpen = ref(false);
const reviewAction = ref<'approve' | 'reject'>('approve');
const reviewTarget = ref<ServiceProviderSummary | null>(null);
const reviewNote = ref('');

const providerTypeOptions = computed(() => [
  { label: t('marketplace.providerTypeGuide'), value: ProviderType.GUIDE },
  { label: t('marketplace.providerTypePhotographer'), value: ProviderType.PHOTOGRAPHER },
  { label: t('marketplace.providerTypeModel'), value: ProviderType.MODEL },
  { label: t('marketplace.providerTypeRetoucher'), value: ProviderType.RETOUCHER },
  { label: t('marketplace.providerTypeLeader'), value: ProviderType.LEADER },
]);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<ServiceProviderSummary>((page, pageSize) =>
    fetchPendingMarketplaceProvidersPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      providerType: providerTypeFilter.value,
    }),
  );

/**
 * 将服务者类型 code 转为展示文案。
 *
 * @param providerType - 服务者类型枚举值
 * @returns 本地化标签
 */
function providerTypeLabel(providerType: string) {
  const map: Record<string, string> = {
    [ProviderType.GUIDE]: t('marketplace.providerTypeGuide'),
    [ProviderType.PHOTOGRAPHER]: t('marketplace.providerTypePhotographer'),
    [ProviderType.MODEL]: t('marketplace.providerTypeModel'),
    [ProviderType.RETOUCHER]: t('marketplace.providerTypeRetoucher'),
    [ProviderType.LEADER]: t('marketplace.providerTypeLeader'),
  };
  return map[providerType] ?? providerType;
}

/**
 * 将认证状态 code 转为展示文案。
 *
 * @param status - 认证状态枚举值
 * @returns 本地化标签
 */
function certStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('marketplace.certStatusPending'),
    approved: t('marketplace.certStatusApproved'),
    rejected: t('marketplace.certStatusRejected'),
  };
  return map[status] ?? status;
}

/**
 * 将类目 code 列表格式化为展示文案。
 *
 * @param codes - 类目 code 数组
 * @returns 逗号分隔的本地化标签；空数组返回 `-`
 */
function formatCategoryCodes(codes: string[]) {
  if (!codes.length) return formatAdminTableCell(null);
  const labelByCode = new Map(
    SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []).map((cat) => [
      cat.code,
      t(cat.labelKey),
    ]),
  );
  return codes.map((code) => labelByCode.get(code) ?? code).join(', ');
}

/**
 * 将服务区域列表格式化为展示文案。
 *
 * @param regions - 区域数组；`null` 表示未填
 * @returns 逗号分隔字符串或 `-`
 */
function formatRegions(regions: string[] | null) {
  if (!regions?.length) return formatAdminTableCell(null);
  return regions.join(', ');
}

/**
 * 解析审核弹窗展示名称。
 *
 * @param record - 服务者行
 * @returns 展示名或用户 ID 占位
 */
function reviewDisplayName(record: ServiceProviderSummary) {
  return record.displayName?.trim() || `#${record.userId}`;
}

function resetSearch() {
  keyword.value = '';
  providerTypeFilter.value = undefined;
  reload();
}

/**
 * 打开服务者审核弹窗。
 *
 * @param record - 待审服务者行
 * @param action - 审核动作
 */
function openReview(record: ServiceProviderSummary, action: 'approve' | 'reject') {
  reviewTarget.value = record;
  reviewAction.value = action;
  reviewNote.value = '';
  reviewModalOpen.value = true;
}

function closeReviewModal() {
  reviewModalOpen.value = false;
  reviewTarget.value = null;
  reviewNote.value = '';
}

/**
 * 提交个人服务者审核结果。
 */
async function submitReview() {
  if (!reviewTarget.value) return;
  reviewingId.value = reviewTarget.value.id;
  error.value = '';
  try {
    await reviewMarketplaceProvider(reviewTarget.value.id, {
      action: reviewAction.value,
      reviewNote: reviewNote.value.trim() || undefined,
    });
    closeReviewModal();
    await load();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('marketplace.reviewFailed'));
  } finally {
    reviewingId.value = null;
  }
}

const columns = computed<AdminExportColumn<ServiceProviderSummary>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  {
    title: t('marketplace.colDisplayName'),
    key: 'displayName',
    ellipsis: true,
    exportValue: (record) => reviewDisplayName(record),
  },
  {
    title: t('marketplace.colProviderType'),
    key: 'providerType',
    width: 110,
    exportValue: (record) => providerTypeLabel(record.providerType),
  },
  {
    title: t('marketplace.colCategories'),
    key: 'categoryCodes',
    width: 180,
    ellipsis: true,
    exportValue: (record) => formatCategoryCodes(record.categoryCodes),
  },
  {
    title: t('marketplace.colRegions'),
    key: 'serviceRegions',
    width: 140,
    ellipsis: true,
    exportValue: (record) => formatRegions(record.serviceRegions),
  },
  {
    title: t('marketplace.colStatus'),
    key: 'certStatus',
    width: 100,
    exportValue: (record) => certStatusLabel(record.certStatus),
  },
  { title: t('marketplace.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
  { title: t('marketplace.colAction'), key: 'action', width: 180, fixed: 'right' },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchPendingMarketplaceProvidersPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      providerType: providerTypeFilter.value,
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

onMounted(load);
</script>

<style scoped>
.review-target {
  margin-bottom: 12px;
  color: #374151;
}
</style>
