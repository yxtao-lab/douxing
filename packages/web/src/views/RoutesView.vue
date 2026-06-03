<template>
  <PageContainer :title="t('routes.title')" :description="t('routes.desc')">
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
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchRoutesPage } from '@/api/routes';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.routes');

const { t } = useI18n();
const { items, loading, pagination, load, handleTableChange } = useServerTablePagination<TravelRouteInfo>(
  fetchRoutesPage,
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

const columns = computed<TableColumnsType<TravelRouteInfo>>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: t('routes.colName'), dataIndex: 'name', ellipsis: true },
  { title: t('routes.colDays'), dataIndex: 'days', width: 80 },
  {
    title: t('routes.colBudget'),
    dataIndex: 'budgetRange',
    width: 120,
    customRender: ({ text }) => text || '-',
  },
  { title: t('routes.colStatus'), key: 'status', dataIndex: 'status', width: 100 },
  { title: t('routes.colViews'), dataIndex: 'viewCount', width: 90 },
  { title: t('routes.colLikes'), dataIndex: 'likeCount', width: 90 },
  { title: t('routes.colFavorites'), dataIndex: 'collectCount', width: 90 },
  { title: t('routes.colCreator'), dataIndex: 'creatorId', width: 100 },
]);

onMounted(load);
</script>
