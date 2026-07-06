<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('routes.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('routes.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('routes.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('routes.allStatuses')"
          />
        </a-form-item>
        <a-form-item :label="t('routes.colCreator')">
          <a-input-number
            v-model:value="creatorIdFilter"
            :min="1"
            :placeholder="t('routes.colCreator')"
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item :label="t('system.colCreatedAt')">
          <a-range-picker
            v-model:value="dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            :placeholder="[t('common.dateRangeStart'), t('common.dateRangeEnd')]"
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
            name-key="web.routes"
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
      :data-source="items"
      :loading="loading"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              v-if="canModerateComments"
              variant="info"
              :label="t('routes.moderateComments')"
              @click="openCommentModeration(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <RouteCommentsModerationModal
      :visible="commentModalVisible"
      :route="commentModalRoute"
      @close="closeCommentModeration"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchRoutesPage } from '@/api/routes';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import RouteCommentsModerationModal from '@/components/route/RouteCommentsModerationModal.vue';
import { usePermissions } from '@/composables/usePermissions';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('web.routes');

const { t } = useI18n();
const { hasPerm } = usePermissions();
const canModerateComments = computed(() => hasPerm('content:attractions:pending'));
const commentModalVisible = ref(false);
const commentModalRoute = ref<TravelRouteInfo | null>(null);
const keyword = ref('');
const statusFilter = ref<number | undefined>();
const creatorIdFilter = ref<number | undefined>();
const dateRange = ref<[string, string] | undefined>();

const statusOptions = computed(() => [
  { label: t('routeStatus.draft'), value: RouteStatus.DRAFT },
  { label: t('routeStatus.published'), value: RouteStatus.PUBLISHED },
  { label: t('routeStatus.archived'), value: RouteStatus.ARCHIVED },
]);

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<TravelRouteInfo>((page, pageSize) =>
    fetchRoutesPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      creatorId: creatorIdFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

function statusLabel(status: number) {
  if (status === RouteStatus.PUBLISHED) return t('routeStatus.published');
  if (status === RouteStatus.ARCHIVED) return t('routeStatus.archived');
  return t('routeStatus.draft');
}

function statusColor(status: number) {
  if (status === RouteStatus.PUBLISHED) return 'success';
  if (status === RouteStatus.ARCHIVED) return 'default';
  return 'processing';
}

const columns = computed<AdminExportColumn<TravelRouteInfo>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: t('routes.colName'), dataIndex: 'name', ellipsis: true },
  { title: t('routes.colDays'), dataIndex: 'days', width: 80 },
  {
    title: t('routes.colBudget'),
    dataIndex: 'budgetRange',
    width: 120,
  },
  {
    title: t('routes.colStatus'),
    key: 'status',
    dataIndex: 'status',
    width: 100,
    exportValue: (record) => statusLabel(record.status),
  },
  { title: t('routes.colViews'), dataIndex: 'viewCount', width: 90 },
  { title: t('routes.colLikes'), dataIndex: 'likeCount', width: 90 },
  { title: t('routes.colFavorites'), dataIndex: 'collectCount', width: 90 },
  { title: t('routes.colCreator'), dataIndex: 'creatorId', width: 100 },
  {
    title: t('routes.colAction'),
    key: 'action',
    width: 140,
    resizable: false,
  },
]);

/**
 * 打开路线评论精选弹窗。
 *
 * @param record - 路线行
 */
function openCommentModeration(record: TravelRouteInfo) {
  commentModalRoute.value = record;
  commentModalVisible.value = true;
}

/**
 * 关闭评论精选弹窗。
 */
function closeCommentModeration() {
  commentModalVisible.value = false;
  commentModalRoute.value = null;
}

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchRoutesPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      creatorId: creatorIdFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  creatorIdFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

onMounted(load);
</script>
