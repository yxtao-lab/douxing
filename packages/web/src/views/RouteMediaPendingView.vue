<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('routeMedia.colRoute')">
          <a-input
            v-model:value="routeKeyword"
            :placeholder="t('routeMedia.searchRouteKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="load"
          />
        </a-form-item>
        <a-form-item :label="t('routeMedia.colScope')">
          <a-select
            v-model:value="scopeFilter"
            :options="scopeOptions"
            allow-clear
            style="width: 140px"
            :placeholder="t('routeMedia.allScopes')"
          />
        </a-form-item>
        <a-form-item :label="t('routeMedia.listLimit')">
          <a-select v-model:value="listLimit" :options="limitOptions" style="width: 100px" />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="filteredItems"
            name-key="web.routeMediaPending"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <a-alert v-if="error" type="error" :message="error" show-icon closable class="mb-4" />

    <DouxingAdminTable
      :columns="columns"
      :data-source="filteredItems"
      :loading="loading"
      :empty-text="t('routeMedia.empty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'preview'">
          <button type="button" class="preview-thumb" @click="openPreview(record)">
            <img
              v-if="record.coverUrl"
              :src="record.coverUrl"
              :alt="t('routeMedia.preview')"
              class="preview-img"
            />
            <span v-else class="preview-placeholder">{{ t('routeMedia.preview') }}</span>
          </button>
        </template>
        <template v-else-if="column.key === 'route'">
          <div>{{ formatAdminTableCell(record.routeName) }}</div>
          <div class="sub">#{{ record.routeId }}</div>
        </template>
        <template v-else-if="column.key === 'uploader'">
          {{
            record.userNickname?.trim()
              ? record.userNickname
              : t('routeMedia.userIdFallback', { id: record.userId })
          }}
        </template>
        <template v-else-if="column.key === 'scope'">
          {{ scopeLabel(record) }}
        </template>
        <template v-else-if="column.key === 'duration'">
          {{ formatDuration(record.durationSec) }}
        </template>
        <template v-else-if="column.key === 'size'">
          {{ formatBytes(record.byteSize) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="info"
              :label="t('routeMedia.preview')"
              @click="openPreview(record)"
            />
            <TableActionButton
              variant="success"
              :label="
                reviewingId === record.id && reviewAction === 'approve'
                  ? t('routeMedia.approving')
                  : t('routeMedia.approve')
              "
              :title="t('routeMedia.approve')"
              @click="handleReview(record, 'approve')"
            />
            <TableActionButton
              variant="delete"
              :label="
                reviewingId === record.id && reviewAction === 'reject'
                  ? t('routeMedia.rejecting')
                  : t('routeMedia.reject')
              "
              :title="t('routeMedia.reject')"
              @click="handleReview(record, 'reject')"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="previewVisible"
      :title="previewTitle"
      width="720px"
      :footer="null"
      destroy-on-close
      @cancel="closePreview"
    >
      <video
        v-if="previewItem?.videoUrl"
        ref="previewVideoRef"
        :src="previewItem.videoUrl"
        :poster="previewItem.coverUrl ?? undefined"
        controls
        playsinline
        class="preview-video"
      />
      <dl v-if="previewItem" class="preview-meta">
        <div class="preview-meta-row">
          <dt>{{ t('routeMedia.colRoute') }}</dt>
          <dd>{{ previewItem.routeName }} (#{{ previewItem.routeId }})</dd>
        </div>
        <div class="preview-meta-row">
          <dt>{{ t('routeMedia.colScope') }}</dt>
          <dd>{{ scopeLabel(previewItem) }}</dd>
        </div>
        <div class="preview-meta-row">
          <dt>{{ t('routeMedia.colDuration') }}</dt>
          <dd>{{ formatDuration(previewItem.durationSec) }}</dd>
        </div>
      </dl>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { CheckInStatus, type RouteMediaPendingInfo } from '@douxing/shared';
import { fetchPendingRouteMedia, reviewRouteMedia } from '@/api/route-media';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage } from '@/utils/error-message';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('web.routeMediaPending');

const { t } = useI18n();

const loading = ref(false);
const error = ref('');
const items = ref<RouteMediaPendingInfo[]>([]);
const routeKeyword = ref('');
const scopeFilter = ref<'route' | 'poi' | undefined>();
const listLimit = ref(50);
const reviewingId = ref<number | null>(null);
const reviewAction = ref<'approve' | 'reject' | null>(null);
const previewVisible = ref(false);
const previewItem = ref<RouteMediaPendingInfo | null>(null);
const previewVideoRef = ref<HTMLVideoElement | null>(null);

const limitOptions = [
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
];

const scopeOptions = computed(() => [
  { label: t('routeMedia.scopeRoute'), value: 'route' },
  { label: t('routeMedia.scopePoi'), value: 'poi' },
]);

const filteredItems = computed(() => {
  const keyword = routeKeyword.value.trim().toLowerCase();
  return items.value.filter((item) => {
    if (scopeFilter.value && item.scope !== scopeFilter.value) return false;
    if (!keyword) return true;
    const routeText = `${item.routeName} ${item.routeId}`.toLowerCase();
    return routeText.includes(keyword);
  });
});

const previewTitle = computed(() =>
  previewItem.value
    ? t('routeMedia.previewTitle', { name: previewItem.value.routeName })
    : t('routeMedia.preview'),
);

const columns = computed<AdminExportColumn<RouteMediaPendingInfo>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 72 },
  {
    title: t('routeMedia.colPreview'),
    key: 'preview',
    width: 96,
    exportValue: () => t('routeMedia.preview'),
  },
  {
    title: t('routeMedia.colRoute'),
    key: 'route',
    dataIndex: 'routeName',
    ellipsis: true,
    exportValue: (record) => `${record.routeName} (#${record.routeId})`,
  },
  {
    title: t('routeMedia.colUploader'),
    key: 'uploader',
    width: 120,
    exportValue: (record) =>
      record.userNickname?.trim()
        ? record.userNickname
        : t('routeMedia.userIdFallback', { id: record.userId }),
  },
  {
    title: t('routeMedia.colScope'),
    key: 'scope',
    width: 160,
    exportValue: (record) => scopeLabel(record),
  },
  {
    title: t('routeMedia.colDuration'),
    key: 'duration',
    width: 88,
    exportValue: (record) => formatDuration(record.durationSec),
  },
  {
    title: t('routeMedia.colSize'),
    key: 'size',
    width: 96,
    exportValue: (record) => formatBytes(record.byteSize),
  },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'createdAt',
    width: 172,
  },
  { title: t('routeMedia.colAction'), key: 'action', width: 220, fixed: 'right' },
]);

/**
 * 格式化视频时长（秒 → m:ss）。
 *
 * @param seconds - 时长（秒）
 * @returns 可读时长字符串
 */
function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 格式化文件大小。
 *
 * @param bytes - 字节数
 * @returns 可读大小；无效时为 `-`
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 生成绑定范围展示文案。
 *
 * @param item - 待审媒体行
 * @returns 范围标签
 */
function scopeLabel(item: RouteMediaPendingInfo): string {
  if (item.scope === 'route') return t('routeMedia.scopeRoute');
  const day =
    item.dayIndex != null ? t('routeMedia.scopePoiDay', { day: item.dayIndex + 1 }) : '';
  const poi = item.poiName?.trim() || (item.attractionId ? `#${item.attractionId}` : '');
  if (day && poi) return t('routeMedia.scopePoiDetail', { day, poi });
  if (poi) return poi;
  return t('routeMedia.scopePoi');
}

/**
 * 加载待审视频列表。
 */
async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await fetchPendingRouteMedia(listLimit.value);
  } catch (e) {
    items.value = [];
    error.value = getAppErrorMessage(e, t('routeMedia.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 重置筛选并重新加载。
 */
function resetSearch() {
  routeKeyword.value = '';
  scopeFilter.value = undefined;
  listLimit.value = 50;
  void load();
}

/**
 * 打开视频预览弹窗。
 *
 * @param item - 待审媒体
 */
function openPreview(item: RouteMediaPendingInfo) {
  previewItem.value = item;
  previewVisible.value = true;
}

/**
 * 关闭预览并停止播放。
 */
function closePreview() {
  previewVideoRef.value?.pause();
  previewVisible.value = false;
  previewItem.value = null;
}

/**
 * 审核通过或拒绝待审视频。
 *
 * @param item - 待审媒体
 * @param action - 审核动作
 */
async function handleReview(item: RouteMediaPendingInfo, action: 'approve' | 'reject') {
  const isApprove = action === 'approve';
  const status = isApprove ? CheckInStatus.APPROVED : CheckInStatus.REJECTED;
  const confirmKey = isApprove ? 'routeMedia.approveConfirm' : 'routeMedia.rejectConfirm';

  Modal.confirm({
    title: isApprove ? t('routeMedia.approve') : t('routeMedia.reject'),
    content: t(confirmKey, { name: item.routeName }),
    okType: isApprove ? 'primary' : 'danger',
    onOk: async () => {
      reviewingId.value = item.id;
      reviewAction.value = action;
      try {
        await reviewRouteMedia(item.id, status);
        message.success(isApprove ? t('routeMedia.approveSuccess') : t('routeMedia.rejectSuccess'));
        if (previewItem.value?.id === item.id) closePreview();
        await load();
      } catch (e) {
        message.error(getAppErrorMessage(e, t('routeMedia.reviewFailed')));
      } finally {
        reviewingId.value = null;
        reviewAction.value = null;
      }
    },
  });
}

onMounted(load);
</script>

<style scoped>
.sub {
  color: #6b7280;
  font-size: 12px;
}

.preview-thumb {
  display: block;
  width: 72px;
  height: 48px;
  padding: 0;
  border: 1px solid var(--dx-border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  cursor: pointer;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 11px;
  color: #6b7280;
}

.preview-video {
  display: block;
  width: 100%;
  max-height: 420px;
  border-radius: 12px;
  background: #000;
}

.preview-meta {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.preview-meta-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  font-size: 13px;
}

.preview-meta-row dt {
  color: #6b7280;
}

.preview-meta-row dd {
  margin: 0;
  color: #111827;
  word-break: break-word;
}
</style>
