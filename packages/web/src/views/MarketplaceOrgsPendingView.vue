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
            name-key="web.marketplaceOrgsPending"
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
      :empty-text="t('marketplace.emptyPending')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'orgType'">
          {{ orgTypeLabel(record.orgType) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag color="orange">{{ statusLabel(record.status) }}</a-tag>
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
      :title="reviewAction === 'approve' ? t('marketplace.approveTitle') : t('marketplace.rejectTitle')"
      :confirm-loading="reviewingId != null"
      @ok="submitReview"
      @cancel="closeReviewModal"
    >
      <p v-if="reviewTarget" class="review-target">
        {{ t('marketplace.reviewTarget', { name: reviewTarget.name }) }}
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
import { BizOrgType, type BizOrgSummary } from '@douxing/shared';
import {
  fetchPendingMarketplaceOrgsPage,
  reviewMarketplaceOrg,
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
import {
  formatAdminTableCell,
} from '@/utils/adminTableColumns';

usePageTitle('web.marketplaceOrgsPending');

const { t } = useI18n();
const keyword = ref('');
const orgTypeFilter = ref<string | undefined>();
const error = ref('');
const reviewingId = ref<number | null>(null);
const reviewModalOpen = ref(false);
const reviewAction = ref<'approve' | 'reject'>('approve');
const reviewTarget = ref<BizOrgSummary | null>(null);
const reviewNote = ref('');

const orgTypeOptions = computed(() => [
  { label: t('marketplace.orgTypeTravelAgency'), value: BizOrgType.TRAVEL_AGENCY },
  { label: t('marketplace.orgTypePhotoStudio'), value: BizOrgType.PHOTO_STUDIO },
  { label: t('marketplace.orgTypeGuideStudio'), value: BizOrgType.GUIDE_STUDIO },
  { label: t('marketplace.orgTypeOutdoorClub'), value: BizOrgType.OUTDOOR_CLUB },
  { label: t('marketplace.orgTypeOther'), value: BizOrgType.OTHER },
]);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<BizOrgSummary>((page, pageSize) =>
    fetchPendingMarketplaceOrgsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
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

function resetSearch() {
  keyword.value = '';
  orgTypeFilter.value = undefined;
  reload();
}

/**
 * 打开审核弹窗。
 *
 * @param record - 待审商户行
 * @param action - 审核动作
 */
function openReview(record: BizOrgSummary, action: 'approve' | 'reject') {
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
 * 提交商户审核结果。
 */
async function submitReview() {
  if (!reviewTarget.value) return;
  reviewingId.value = reviewTarget.value.id;
  error.value = '';
  try {
    await reviewMarketplaceOrg(reviewTarget.value.id, {
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
  { title: t('marketplace.colAction'), key: 'action', width: 180, fixed: 'right' },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchPendingMarketplaceOrgsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      orgType: orgTypeFilter.value,
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
