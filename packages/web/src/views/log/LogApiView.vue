<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('system.colOperUrl')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchApiKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('system.colMethod')">
          <a-select
            v-model:value="methodFilter"
            :options="methodOptions"
            allow-clear
            style="width: 140px"
            :placeholder="t('system.searchMethod')"
          />
        </a-form-item>
        <a-form-item :label="t('system.colApiModule')">
          <a-select
            v-model:value="moduleFilter"
            :options="moduleOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.filterAll')"
          />
        </a-form-item>
        <a-form-item :label="t('system.colOperName')">
          <a-input
            v-model:value="operName"
            :placeholder="t('system.colOperName')"
            allow-clear
            style="width: 160px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('system.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
          />
        </a-form-item>
        <a-form-item :label="t('system.colRequestTime')">
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
            name-key="web.logApi"
          />
          <a-tooltip :title="t('system.refresh')">
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
      :empty-text="t('system.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'error'">
            {{ record.status === 1 ? t('system.statusNormal') : t('common.failed') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'statusCode'">
          <a-tag :color="record.statusCode >= 200 && record.statusCode < 400 ? 'success' : 'error'">
            {{ record.statusCode }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="info"
              :label="t('system.viewDetail')"
              @click="openDetail(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="detailOpen"
      :title="t('system.apiLogDetail')"
      width="720px"
      :footer="null"
    >
      <a-descriptions v-if="detailRow" bordered :column="1" size="small">
        <a-descriptions-item :label="t('system.colApiModule')">
          {{ formatApiLogModule(t, detailRow.apiModuleKey) }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colOperUrl')">
          {{ detailRow.requestUrl }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colMethod')">
          {{ detailRow.method }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colOperName')">
          {{ detailRow.operName }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colOperIp')">
          {{ formatOperIp(detailRow.operIp) }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colStatusCode')">
          {{ detailRow.statusCode }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colCostTime')">
          {{ detailRow.costTime }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.colRequestTime')">
          {{ formatAdminDateTime(detailRow.requestTime) }}
        </a-descriptions-item>
        <a-descriptions-item v-if="detailRow.errorMsg" :label="t('system.colMsg')">
          {{ detailRow.errorMsg }}
        </a-descriptions-item>
      </a-descriptions>
      <a-alert
        v-if="detailRow && isTruncated(detailRow)"
        type="info"
        show-icon
        class="api-log-truncated-hint"
        :message="t('system.bodyTruncated')"
      />
      <div v-if="detailRow" class="api-log-payload-block">
        <div class="api-log-payload-title">{{ t('system.colRequestParams') }}</div>
        <pre class="api-log-payload-content">{{ formatPayload(detailRow.requestParams) }}</pre>
      </div>
      <div v-if="detailRow" class="api-log-payload-block">
        <div class="api-log-payload-title">{{ t('system.colResponseBody') }}</div>
        <pre class="api-log-payload-content">{{ formatPayload(detailRow.responseBody) }}</pre>
      </div>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchApiLogsPage, type ApiLogRow } from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';
import { ADMIN_TABLE_EMPTY_PLACEHOLDER, createAdminRowIndexColumn } from '@/utils/adminTableColumns';
import { formatAdminDateTime } from '@/utils/adminDateTime';
import { formatApiLogModule } from '@/utils/apiLogLabels';
import { normalizeIpv4Address, API_LOG_MODULE_KEYS } from '@douxing/shared';

usePageTitle('web.logApi');

const { t } = useI18n();
const keyword = ref('');
const operName = ref('');
const methodFilter = ref<string | undefined>();
const moduleFilter = ref<string | undefined>();
const statusFilter = ref<number | undefined>();
const dateRange = ref<[string, string] | undefined>();
const detailOpen = ref(false);
const detailRow = ref<ApiLogRow | null>(null);

const methodOptions = computed(() =>
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ label: value, value })),
);

const moduleOptions = computed(() =>
  API_LOG_MODULE_KEYS.map((key) => ({
    label: formatApiLogModule(t, key),
    value: key,
  })),
);

const statusOptions = computed(() => [
  { label: t('system.statusNormal'), value: 1 },
  { label: t('common.failed'), value: 0 },
]);

const { items, loading, pagination, page, pageSize, load, reload, handleTableChange } =
  useServerTablePagination<ApiLogRow>((page, pageSize) =>
    fetchApiLogsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      operName: operName.value.trim() || undefined,
      method: methodFilter.value,
      moduleKey: moduleFilter.value,
      status: statusFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

const columns = computed<AdminExportColumn<ApiLogRow>[]>(() => [
  createAdminRowIndexColumn<ApiLogRow>(t('system.colRowIndex'), page, pageSize),
  {
    title: t('system.colApiModule'),
    dataIndex: 'apiModuleKey',
    width: 110,
    customRender: ({ text }) => formatApiLogModule(t, String(text)),
    exportValue: (record) => formatApiLogModule(t, record.apiModuleKey),
  },
  { title: t('system.colOperUrl'), dataIndex: 'requestUrl', ellipsis: true },
  { title: t('system.colMethod'), dataIndex: 'method', width: 90 },
  { title: t('system.colOperName'), dataIndex: 'operName', width: 110 },
  {
    title: t('system.colStatusCode'),
    key: 'statusCode',
    dataIndex: 'statusCode',
    width: 100,
  },
  {
    title: t('system.colCostTime'),
    dataIndex: 'costTime',
    width: 100,
    exportValue: (record) => `${record.costTime}`,
  },
  { title: t('system.colOperIp'), dataIndex: 'operIp', width: 130,
    customRender: ({ text }) => formatOperIp(text),
    exportValue: (record) => formatOperIp(record.operIp),
  },
  {
    title: t('system.colStatus'),
    key: 'status',
    width: 90,
    exportValue: (record) =>
      record.status === 1 ? t('system.statusNormal') : t('common.failed'),
  },
  {
    title: t('system.colRequestTime'),
    dataIndex: 'requestTime',
    width: 170,
    customRender: ({ text }) => formatAdminDateTime(text),
    exportValue: (record) => formatAdminDateTime(record.requestTime),
  },
  { title: t('system.colAction'), key: 'action', width: 120, resizable: false },
]);

function formatOperIp(value: unknown) {
  const normalized = normalizeIpv4Address(value == null ? '' : String(value));
  return normalized || ADMIN_TABLE_EMPTY_PLACEHOLDER;
}

function formatPayload(value: string | null) {
  if (!value) return ADMIN_TABLE_EMPTY_PLACEHOLDER;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function isTruncated(record: ApiLogRow) {
  return (
    record.requestParams?.includes('[truncated]') ||
    record.responseBody?.includes('[truncated]') ||
    false
  );
}

function openDetail(record: ApiLogRow) {
  detailRow.value = record;
  detailOpen.value = true;
}

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchApiLogsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      operName: operName.value.trim() || undefined,
      method: methodFilter.value,
      moduleKey: moduleFilter.value,
      status: statusFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  operName.value = '';
  methodFilter.value = undefined;
  moduleFilter.value = undefined;
  statusFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

onMounted(load);
</script>

<style scoped>
.api-log-truncated-hint {
  margin-top: 16px;
}

.api-log-payload-block {
  margin-top: 16px;
}

.api-log-payload-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.api-log-payload-content {
  max-height: 240px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
