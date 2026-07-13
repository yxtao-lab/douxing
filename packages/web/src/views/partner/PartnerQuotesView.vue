<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="items"
            name-key="partner.quotesTitle"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="load">
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
      :empty-text="t('partner.quotesEmpty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'demand'">
          <router-link :to="{ name: 'partner-demand-detail', params: { id: record.demandId } }">
            {{ record.demandTitle || record.demandNo }}
          </router-link>
        </template>
        <template v-else-if="column.key === 'status'">
          {{ quoteStatusLabel(record.status) }}
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { PartnerQuoteListItem } from '@douxing/shared';
import { fetchMyPartnerQuotes } from '@/api/marketplace-partner';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('partner.quotesTitle');
const { t } = useLocale();
const loading = ref(false);
const items = ref<PartnerQuoteListItem[]>([]);

const columns = computed<AdminExportColumn[]>(() => [
  { title: t('partner.colDemand'), key: 'demand', width: 220, exportValue: (row) => formatAdminTableCell(row.demandTitle || row.demandNo) },
  { title: t('partner.colAmount'), dataIndex: 'amount', width: 120 },
  { title: t('partner.colQuoteStatus'), key: 'status', width: 120, exportValue: (row) => quoteStatusLabel(row.status) },
  { title: t('partner.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
]);

/**
 * 解析报价状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function quoteStatusLabel(status: string) {
  const key = `marketplace.quoteStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 加载我的报价列表。
 */
async function load() {
  loading.value = true;
  try {
    items.value = await fetchMyPartnerQuotes();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
