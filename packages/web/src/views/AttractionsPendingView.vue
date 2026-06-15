<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('attractions.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('attractions.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('attractions.colCity')">
          <a-input
            v-model:value="cityFilter"
            :placeholder="t('attractions.colCity')"
            allow-clear
            style="width: 140px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('attractions.colType')">
          <a-select
            v-model:value="categoryFilter"
            :options="categoryOptions"
            allow-clear
            style="width: 140px"
            :placeholder="t('attractions.allTypes')"
          />
        </a-form-item>
        <a-form-item :label="t('attractions.colSource')">
          <a-select
            v-model:value="sourceFilter"
            :options="sourceOptions"
            allow-clear
            style="width: 140px"
            :placeholder="t('attractions.allSources')"
          />
        </a-form-item>
        <a-form-item :label="t('attractions.colCoord')">
          <a-select
            v-model:value="missingCoordFilter"
            :options="coordOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('attractions.allCoords')"
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
            name-key="web.attractionsPending"
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
      :empty-text="t('attractions.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div>{{ formatAdminTableCell(record.name) }}</div>
          <div v-if="record.description" class="sub">{{ record.description }}</div>
        </template>
        <template v-else-if="column.key === 'coord'">
          <template v-if="hasCoords(record)">
            {{ formatCoord(record.latitude!) }}, {{ formatCoord(record.longitude!) }}
          </template>
          <template v-else>{{ ADMIN_TABLE_EMPTY_PLACEHOLDER }}</template>
        </template>
        <template v-else-if="column.key === 'category'">
          {{ categoryLabel(record.category) }}
        </template>
        <template v-else-if="column.key === 'source'">
          {{ sourceLabel(record.source) }}
        </template>
        <template v-else-if="column.key === 'price'">
          {{ record.ticketPrice > 0 ? `¥${record.ticketPrice}` : ADMIN_TABLE_EMPTY_PLACEHOLDER }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="success"
              :label="approvingId === record.id ? t('attractions.approving') : t('attractions.approve')"
              :title="t('attractions.approve')"
              @click="handleApprove(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { Modal } from 'ant-design-vue';
import type { AttractionInfo } from '@douxing/shared';
import { approveAttraction, fetchPendingAttractionsPage } from '@/api/attractions';
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
  ADMIN_TABLE_EMPTY_PLACEHOLDER,
  formatAdminTableCell,
} from '@/utils/adminTableColumns';

usePageTitle('web.attractionsPending');

const { t } = useI18n();
const keyword = ref('');
const cityFilter = ref('');
const categoryFilter = ref<string | undefined>();
const sourceFilter = ref<string | undefined>();
const missingCoordFilter = ref<'complete' | 'missing' | undefined>();
const dateRange = ref<[string, string] | undefined>();

const categoryOptions = computed(() => [
  { label: t('attractions.typeAttraction'), value: 'attraction' },
  { label: t('attractions.typeRestaurant'), value: 'restaurant' },
  { label: t('attractions.typeHotel'), value: 'hotel' },
]);

const sourceOptions = computed(() => [
  { label: t('attractions.sourceSeed'), value: 'seed' },
  { label: t('attractions.sourceLlm'), value: 'llm' },
  { label: t('attractions.sourceManual'), value: 'manual' },
  { label: t('attractions.sourceAmap'), value: 'amap' },
]);

const coordOptions = computed(() => [
  { label: t('attractions.coordComplete'), value: 'complete' },
  { label: t('attractions.coordMissing'), value: 'missing' },
]);

const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<AttractionInfo>((page, pageSize) =>
    fetchPendingAttractionsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      city: cityFilter.value.trim() || undefined,
      category: categoryFilter.value,
      source: sourceFilter.value,
      missingCoord:
        missingCoordFilter.value === 'missing'
          ? true
          : missingCoordFilter.value === 'complete'
            ? false
            : undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
const error = ref('');
const approvingId = ref<number | null>(null);

function categoryLabel(category: string) {
  if (!category) return ADMIN_TABLE_EMPTY_PLACEHOLDER;
  const map: Record<string, string> = {
    attraction: t('attractions.typeAttraction'),
    restaurant: t('attractions.typeRestaurant'),
    hotel: t('attractions.typeHotel'),
  };
  return map[category] ?? category;
}

function sourceLabel(source: string) {
  if (!source) return ADMIN_TABLE_EMPTY_PLACEHOLDER;
  const map: Record<string, string> = {
    seed: t('attractions.sourceSeed'),
    llm: t('attractions.sourceLlm'),
    manual: t('attractions.sourceManual'),
    amap: t('attractions.sourceAmap'),
  };
  return map[source] ?? source;
}

function hasCoords(item: AttractionInfo) {
  return item.latitude != null && item.longitude != null;
}

function formatCoord(value: number) {
  return value.toFixed(4);
}

function resetSearch() {
  keyword.value = '';
  cityFilter.value = '';
  categoryFilter.value = undefined;
  sourceFilter.value = undefined;
  missingCoordFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

async function handleApprove(item: AttractionInfo) {
  if (!hasCoords(item)) {
    Modal.confirm({
      title: t('attractions.approve'),
      content: t('attractions.approveConfirm', { name: item.name }),
      onOk: () => doApprove(item),
    });
    return;
  }
  await doApprove(item);
}

async function doApprove(item: AttractionInfo) {
  approvingId.value = item.id;
  error.value = '';
  try {
    await approveAttraction(item.id);
    await load();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.approveFailed'));
  } finally {
    approvingId.value = null;
  }
}

const columns = computed<AdminExportColumn<AttractionInfo>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  {
    title: t('attractions.colName'),
    key: 'name',
    dataIndex: 'name',
    ellipsis: true,
    exportValue: (record) =>
      record.description ? `${record.name}\n${record.description}` : record.name,
  },
  { title: t('attractions.colCity'), dataIndex: 'city', width: 100 },
  {
    title: t('attractions.colType'),
    key: 'category',
    width: 100,
    exportValue: (record) => categoryLabel(record.category),
  },
  {
    title: t('attractions.colCoord'),
    key: 'coord',
    width: 180,
    exportValue: (record) =>
      hasCoords(record)
        ? `${formatCoord(record.latitude!)}, ${formatCoord(record.longitude!)}`
        : ADMIN_TABLE_EMPTY_PLACEHOLDER,
  },
  {
    title: t('attractions.colSource'),
    key: 'source',
    width: 100,
    exportValue: (record) => sourceLabel(record.source),
  },
  {
    title: t('attractions.colPrice'),
    key: 'price',
    width: 100,
    exportValue: (record) =>
      record.ticketPrice > 0 ? `¥${record.ticketPrice}` : ADMIN_TABLE_EMPTY_PLACEHOLDER,
  },
  { title: t('attractions.colAction'), key: 'action', width: 120, fixed: 'right' },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchPendingAttractionsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      city: cityFilter.value.trim() || undefined,
      category: categoryFilter.value,
      source: sourceFilter.value,
      missingCoord:
        missingCoordFilter.value === 'missing'
          ? true
          : missingCoordFilter.value === 'complete'
            ? false
            : undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

onMounted(load);
</script>

<style scoped>
.sub {
  color: #6b7280;
  font-size: 12px;
}
</style>
