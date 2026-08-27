<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="items"
            name-key="partner.ordersTitle"
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
      :empty-text="t('partner.ordersEmpty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'demand'">
          {{ record.demandTitle || record.demandNo }}
        </template>
        <template v-else-if="column.key === 'status'">
          {{ orderStatusLabel(record.status) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="info"
              :label="t('partner.viewDetail')"
              @click="$router.push({ name: 'partner-order-detail', params: { id: record.id } })"
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
import type { ServiceOrderDetail } from '@douxing/shared';
import { fetchSellerMarketplaceOrders } from '@/api/marketplace-partner';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('partner.ordersTitle');
const { t } = useLocale();
const loading = ref(false);
const items = ref<ServiceOrderDetail[]>([]);

const columns = computed<AdminExportColumn<ServiceOrderDetail>[]>(() => [
  { title: t('partner.colDemand'), key: 'demand', width: 220, exportValue: (row) => formatAdminTableCell(row.demandTitle || row.demandNo) },
  { title: t('partner.colAmount'), dataIndex: 'totalAmount', width: 120 },
  { title: t('partner.colOrderStatus'), key: 'status', width: 140, exportValue: (row) => orderStatusLabel(row.status) },
  { title: t('partner.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
  { title: t('partner.colAction'), key: 'action', width: 100, resizable: false },
]);

/**
 * 解析订单状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function orderStatusLabel(status: string) {
  const key = `marketplace.orderStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 加载卖方订单列表。
 */
async function load() {
  loading.value = true;
  try {
    items.value = await fetchSellerMarketplaceOrders();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
