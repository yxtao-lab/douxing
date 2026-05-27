<template>
  <div class="orders-page">
    <h2>{{ t('orders.title') }}</h2>
    <p class="desc">{{ t('orders.desc') }}</p>
    <table class="table" v-if="orders.length">
      <thead>
        <tr>
          <th>{{ t('orders.colOrderNo') }}</th>
          <th>{{ t('orders.colProduct') }}</th>
          <th>{{ t('orders.colAmount') }}</th>
          <th>{{ t('orders.colStatus') }}</th>
          <th>{{ t('orders.colUser') }}</th>
          <th>{{ t('orders.colTime') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in orders" :key="o.id">
          <td>{{ o.orderNo }}</td>
          <td>{{ o.productName }}</td>
          <td>¥{{ o.totalAmount }}</td>
          <td>{{ orderStatusLabel(o.status) }}</td>
          <td>{{ o.userId }}</td>
          <td>{{ o.createdAt.slice(0, 16).replace('T', ' ') }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">{{ t('orders.empty') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OrderInfo } from '@douxing/shared';
import { getOrderStatusI18nKey } from '@douxing/shared';
import { fetchAllOrders } from '@/api/orders';

const { t } = useI18n();
const orders = ref<OrderInfo[]>([]);

function orderStatusLabel(status: number) {
  return t(getOrderStatusI18nKey(status));
}

onMounted(async () => {
  try {
    orders.value = await fetchAllOrders();
  } catch {
    orders.value = [];
  }
});
</script>

<style scoped>
.orders-page {
  max-width: 960px;
}
.desc {
  color: #6b7280;
  margin-bottom: 24px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
th,
td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}
th {
  background: #f9fafb;
  font-weight: 600;
}
.empty {
  color: #9ca3af;
}
</style>
