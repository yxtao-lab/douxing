<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('membershipAdmin.colKeyword')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('membershipAdmin.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colSource')">
          <a-select
            v-model:value="sourceFilter"
            :options="sourceOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('membershipAdmin.allSources')"
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
            name-key="web.membershipLogs"
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
      :empty-text="t('membershipAdmin.emptyLogs')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { MembershipChangeSource, getMemberLevelI18nKey, type MembershipChangeLog } from '@douxing/shared';
import { fetchMembershipLogsPage } from '@/api/membership';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('web.membershipLogs');

const { t } = useI18n();
const keyword = ref('');
const sourceFilter = ref<string | undefined>(undefined);

const sourceOptions = computed(() => [
  { label: t('membershipAdmin.allSources'), value: undefined },
  { label: t('membershipChangeSource.purchase'), value: MembershipChangeSource.PURCHASE },
  { label: t('membershipChangeSource.admin'), value: MembershipChangeSource.ADMIN },
  { label: t('membershipChangeSource.expire'), value: MembershipChangeSource.EXPIRE },
  { label: t('membershipChangeSource.system'), value: MembershipChangeSource.SYSTEM },
]);

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<MembershipChangeLog>((page, pageSize) =>
    fetchMembershipLogsPage(page, pageSize, {
      keyword: keyword.value.trim() || undefined,
      source: sourceFilter.value,
    }),
  );

function memberLevelLabel(level: number) {
  return t(getMemberLevelI18nKey(level));
}

function sourceLabel(source: string) {
  return t(`membershipChangeSource.${source}`);
}

const columns = computed<TableColumnsType<MembershipChangeLog>>(() => [
  { title: t('membershipAdmin.colUser'), dataIndex: 'username', width: 110 },
  { title: t('membershipAdmin.colNickname'), dataIndex: 'nickname', width: 110 },
  {
    title: t('membershipAdmin.colFromLevel'),
    dataIndex: 'fromLevel',
    width: 100,
    customRender: ({ text }) => memberLevelLabel(Number(text)),
  },
  {
    title: t('membershipAdmin.colToLevel'),
    dataIndex: 'toLevel',
    width: 100,
    customRender: ({ text }) => memberLevelLabel(Number(text)),
  },
  {
    title: t('membershipAdmin.colSource'),
    dataIndex: 'source',
    width: 110,
    customRender: ({ text }) => sourceLabel(String(text)),
  },
  { title: t('membershipAdmin.colRemark'), dataIndex: 'remark', ellipsis: true },
  { title: t('membershipAdmin.colOrderId'), dataIndex: 'orderId', width: 90 },
  { title: t('membershipAdmin.colOperator'), dataIndex: 'operatorName', width: 100 },
  {
    title: t('membershipAdmin.colTime'),
    dataIndex: 'createdAt',
    width: 180,
  },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchMembershipLogsPage(page, pageSize, {
      keyword: keyword.value.trim() || undefined,
      source: sourceFilter.value,
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  sourceFilter.value = undefined;
  reload();
}

onMounted(load);
</script>
