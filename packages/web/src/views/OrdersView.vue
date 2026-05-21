<template>
  <div class="orders-page">
    <h2>订单管理</h2>
    <p class="desc">路线解锁订单（MVP 模拟支付）</p>
    <table class="table" v-if="orders.length">
      <thead>
        <tr>
          <th>订单号</th>
          <th>商品</th>
          <th>金额</th>
          <th>状态</th>
          <th>用户</th>
          <th>时间</th>
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
    <p v-else class="empty">暂无订单</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { OrderInfo } from '@douxing/shared';
import { getOrderStatusLabel } from '@douxing/shared';
import { fetchAllOrders } from '@/api/orders';

const orders = ref<OrderInfo[]>([]);

const orderStatusLabel = getOrderStatusLabel;

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
