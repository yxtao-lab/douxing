<template>
  <div class="partner-page">
    <h1 class="partner-page-title">{{ t('partner.ordersTitle') }}</h1>
    <a-spin :spinning="loading">
      <a-empty v-if="items.length === 0" :description="t('partner.ordersEmpty')" />
      <a-table v-else :columns="columns" :data-source="items" row-key="id" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'demand'">
            {{ record.demandTitle || record.demandNo }}
          </template>
          <template v-else-if="column.key === 'status'">
            {{ orderStatusLabel(record.status) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" @click="$router.push({ name: 'partner-order-detail', params: { id: record.id } })">
              {{ t('partner.viewDetail') }}
            </a-button>
          </template>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ServiceOrderDetail } from '@douxing/shared';
import { fetchSellerMarketplaceOrders } from '@/api/marketplace-partner';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('partner.ordersTitle');
const { t } = useLocale();
const loading = ref(false);
const items = ref<ServiceOrderDetail[]>([]);

const columns = computed(() => [
  { title: t('partner.colDemand'), key: 'demand' },
  { title: t('partner.colAmount'), dataIndex: 'totalAmount', width: 120 },
  { title: t('partner.colOrderStatus'), key: 'status', width: 140 },
  { title: t('partner.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
  { title: t('partner.colAction'), key: 'action', width: 100 },
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

<style scoped>
.partner-page-title { margin: 0 0 16px; font-size: 22px; font-weight: 600; }
</style>
