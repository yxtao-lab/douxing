<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="onSearch" @reset="onReset">
        <a-form-item v-if="activeTab === 'reports'" :label="t('ugcModeration.colStatus')">
          <a-select
            v-model:value="reportStatus"
            :options="reportStatusOptions"
            style="width: 160px"
          />
        </a-form-item>
        <a-form-item v-else :label="t('ugcModeration.spotLimit')">
          <a-select v-model:value="spotLimit" :options="spotLimitOptions" style="width: 120px" />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-radio-group v-model:value="activeTab" button-style="solid" @change="onTabChange">
            <a-radio-button value="reports">{{ t('ugcModeration.tabReports') }}</a-radio-button>
            <a-radio-button value="spot">{{ t('ugcModeration.tabSpotCheck') }}</a-radio-button>
          </a-radio-group>
        </template>
        <template #right>
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="onSearch">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <a-alert v-if="error" type="error" :message="error" show-icon closable class="mb-4" />

    <DouxingAdminTable
      v-if="activeTab === 'reports'"
      :columns="reportColumns"
      :data-source="reportList"
      :loading="loading"
      :empty-text="t('ugcModeration.reportEmpty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'reason'">
          {{ reasonLabel(record.reason) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag>{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'reporter'">
          {{
            record.reporterNickname?.trim()
              ? record.reporterNickname
              : t('ugcModeration.userFallback', { id: record.reporterUserId })
          }}
        </template>
        <template v-else-if="column.key === 'route'">
          <div>{{ formatAdminTableCell(record.routeName) }}</div>
          <div class="sub">#{{ record.routeId }}</div>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatAdminDateTime(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar v-if="record.status === 'open'" :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="success"
              :label="t('ugcModeration.accept')"
              @click="openResolve(record, 'accept')"
            />
            <TableActionButton
              variant="delete"
              :label="t('ugcModeration.reject')"
              @click="openResolve(record, 'reject')"
            />
          </TableActionBar>
          <span v-else class="muted">{{ formatAdminTableCell(record.resolveNote) }}</span>
        </template>
      </template>
    </DouxingAdminTable>

    <DouxingAdminTable
      v-else
      :columns="spotColumns"
      :data-source="spotList"
      :loading="loading"
      :empty-text="t('ugcModeration.spotEmpty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'route'">
          <div>{{ formatAdminTableCell(record.name) }}</div>
          <div class="sub">#{{ record.id }}</div>
        </template>
        <template v-else-if="column.key === 'tier'">
          {{ tierLabel(record.contentTier) }}
        </template>
        <template v-else-if="column.key === 'reasons'">
          <a-tag v-for="r in record.spotReasons" :key="r" class="mb-1">{{ spotReasonLabel(r) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ formatAdminDateTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="warning"
              :label="t('ugcModeration.demote')"
              @click="handleModeration(record.id, 'demote')"
            />
            <TableActionButton
              variant="delete"
              :label="t('ugcModeration.hide')"
              @click="handleModeration(record.id, 'hide')"
            />
            <TableActionButton
              variant="info"
              :label="t('ugcModeration.restore')"
              @click="handleModeration(record.id, 'restore')"
            />
            <TableActionButton
              variant="success"
              :label="t('ugcModeration.crown')"
              @click="handleModeration(record.id, 'crown')"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="resolveOpen"
      :title="
        resolveMode === 'accept'
          ? t('ugcModeration.acceptTitle')
          : t('ugcModeration.rejectTitle')
      "
      :confirm-loading="resolving"
      @ok="handleResolve"
      @cancel="closeResolve"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('ugcModeration.resolveNote')">
          <a-textarea
            v-model:value="resolveNote"
            :rows="3"
            :maxlength="512"
            :placeholder="t('ugcModeration.resolveNotePlaceholder')"
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
import { message } from 'ant-design-vue';
import {
  RouteReportReason,
  RouteReportStatus,
  type RouteModerationActionValue,
  type RouteReportInfo,
  type RouteSpotCheckItem,
} from '@douxing/shared';
import {
  acceptUgcReport,
  applyRouteModeration,
  fetchUgcReportsPage,
  fetchUgcSpotCheck,
  rejectUgcReport,
} from '@/api/routes';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { formatAdminTableCell } from '@/utils/adminTableColumns';
import { formatAdminDateTime } from '@/utils/adminDateTime';
import { getAppErrorMessage } from '@/utils/error-message';
import type { AdminExportColumn } from '@/utils/adminTableExport';

usePageTitle('web.ugcModeration');

const { t } = useI18n();
const activeTab = ref<'reports' | 'spot'>('reports');
const reportStatus = ref<'open' | 'accepted' | 'rejected'>('open');
const spotLimit = ref(50);
const spotList = ref<RouteSpotCheckItem[]>([]);
const error = ref('');
const resolveOpen = ref(false);
const resolveMode = ref<'accept' | 'reject'>('accept');
const resolveTarget = ref<RouteReportInfo | null>(null);
const resolveNote = ref('');
const resolving = ref(false);
const spotLoading = ref(false);

const reportStatusOptions = computed(() => [
  { value: RouteReportStatus.OPEN, label: t('ugcModeration.statusOpen') },
  { value: RouteReportStatus.ACCEPTED, label: t('ugcModeration.statusAccepted') },
  { value: RouteReportStatus.REJECTED, label: t('ugcModeration.statusRejected') },
]);

const spotLimitOptions = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

const reportColumns = computed(
  () =>
    [
      { title: t('ugcModeration.colRoute'), key: 'route', width: 200 },
      { title: t('ugcModeration.colReporter'), key: 'reporter', width: 140 },
      { title: t('ugcModeration.colReason'), key: 'reason', width: 120 },
      {
        title: t('ugcModeration.colDetail'),
        dataIndex: 'detail',
        key: 'detail',
        width: 220,
        ellipsis: true,
        customRender: ({ record }: { record: RouteReportInfo }) =>
          formatAdminTableCell(record.detail),
      },
      { title: t('ugcModeration.colStatus'), key: 'status', width: 100 },
      { title: t('ugcModeration.colCreatedAt'), key: 'createdAt', width: 180 },
      { title: t('common.action'), key: 'action', width: 180 },
    ] as AdminExportColumn[],
);

const spotColumns = computed(
  () =>
    [
      { title: t('ugcModeration.colRoute'), key: 'route', width: 200 },
      { title: t('ugcModeration.colTier'), key: 'tier', width: 110 },
      { title: t('ugcModeration.colTrust'), dataIndex: 'trustScore', key: 'trustScore', width: 90 },
      { title: t('ugcModeration.colHeat'), dataIndex: 'heatScore', key: 'heatScore', width: 90 },
      {
        title: t('ugcModeration.colOpenReports'),
        dataIndex: 'openReportCount',
        key: 'openReportCount',
        width: 100,
      },
      { title: t('ugcModeration.colSpotReasons'), key: 'reasons', width: 200 },
      { title: t('ugcModeration.colUpdatedAt'), key: 'updatedAt', width: 180 },
      { title: t('common.action'), key: 'action', width: 280 },
    ] as AdminExportColumn[],
);

const {
  items: reportList,
  loading: reportLoading,
  pagination,
  load,
  reload,
  handleTableChange,
} = useServerTablePagination<RouteReportInfo>((page, pageSize) =>
  fetchUgcReportsPage({
    page,
    pageSize,
    status: reportStatus.value,
  }),
);

const loading = computed(() =>
  activeTab.value === 'reports' ? reportLoading.value : spotLoading.value,
);

/**
 * 报错原因文案。
 *
 * @param reason - 原因码
 * @returns 本地化标签
 */
function reasonLabel(reason: string) {
  const map: Record<string, string> = {
    [RouteReportReason.OUTDATED]: t('ugcModeration.reasonOutdated'),
    [RouteReportReason.DANGEROUS]: t('ugcModeration.reasonDangerous'),
    [RouteReportReason.PLAGIARISM]: t('ugcModeration.reasonPlagiarism'),
    [RouteReportReason.AD]: t('ugcModeration.reasonAd'),
    [RouteReportReason.OTHER]: t('ugcModeration.reasonOther'),
  };
  return map[reason] ?? reason;
}

/**
 * 工单状态文案。
 *
 * @param status - 状态码
 * @returns 本地化标签
 */
function statusLabel(status: string) {
  const map: Record<string, string> = {
    [RouteReportStatus.OPEN]: t('ugcModeration.statusOpen'),
    [RouteReportStatus.ACCEPTED]: t('ugcModeration.statusAccepted'),
    [RouteReportStatus.REJECTED]: t('ugcModeration.statusRejected'),
  };
  return map[status] ?? status;
}

/**
 * 内容层级文案。
 *
 * @param tier - 层级
 * @returns 本地化标签
 */
function tierLabel(tier: string) {
  if (tier === 'travel_ready') return t('ugcModeration.tierTravelReady');
  return t('ugcModeration.tierInspiration');
}

/**
 * 抽检原因文案。
 *
 * @param reason - 原因码
 * @returns 本地化标签
 */
function spotReasonLabel(reason: string) {
  const map: Record<string, string> = {
    open_reports: t('ugcModeration.spotOpenReports'),
    stale_travel_ready: t('ugcModeration.spotStaleTravelReady'),
    hot_low_trust: t('ugcModeration.spotHotLowTrust'),
  };
  return map[reason] ?? reason;
}

/**
 * 加载抽检队列。
 */
async function loadSpotCheck() {
  spotLoading.value = true;
  error.value = '';
  try {
    spotList.value = await fetchUgcSpotCheck(spotLimit.value);
  } catch (err) {
    error.value = getAppErrorMessage(err, t('ugcModeration.loadFailed'));
    spotList.value = [];
  } finally {
    spotLoading.value = false;
  }
}

/**
 * 搜索 / 刷新当前 Tab。
 */
function onSearch() {
  if (activeTab.value === 'reports') {
    void reload();
    return;
  }
  void loadSpotCheck();
}

/**
 * 重置筛选。
 */
function onReset() {
  reportStatus.value = 'open';
  spotLimit.value = 50;
  onSearch();
}

/**
 * Tab 切换时按需加载。
 */
function onTabChange() {
  error.value = '';
  onSearch();
}

/**
 * 打开采纳/驳回确认。
 *
 * @param record - 工单
 * @param mode - accept | reject
 */
function openResolve(record: RouteReportInfo, mode: 'accept' | 'reject') {
  resolveTarget.value = record;
  resolveMode.value = mode;
  resolveNote.value = '';
  resolveOpen.value = true;
}

/**
 * 关闭处理弹窗。
 */
function closeResolve() {
  if (resolving.value) return;
  resolveOpen.value = false;
  resolveTarget.value = null;
}

/**
 * 提交采纳或驳回。
 */
async function handleResolve() {
  const target = resolveTarget.value;
  if (!target) return;
  resolving.value = true;
  try {
    if (resolveMode.value === 'accept') {
      await acceptUgcReport(target.id, resolveNote.value.trim() || null);
      message.success(t('ugcModeration.acceptSuccess'));
    } else {
      await rejectUgcReport(target.id, resolveNote.value.trim() || null);
      message.success(t('ugcModeration.rejectSuccess'));
    }
    resolveOpen.value = false;
    resolveTarget.value = null;
    await reload();
  } catch (err) {
    message.error(getAppErrorMessage(err, t('ugcModeration.resolveFailed')));
  } finally {
    resolving.value = false;
  }
}

/**
 * 对抽检路线执行处置。
 *
 * @param routeId - 路线 ID
 * @param action - 处置动作
 */
async function handleModeration(routeId: number, action: RouteModerationActionValue) {
  try {
    await applyRouteModeration(routeId, action);
    message.success(t('ugcModeration.moderationSuccess'));
    await loadSpotCheck();
  } catch (err) {
    message.error(getAppErrorMessage(err, t('ugcModeration.moderationFailed')));
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
