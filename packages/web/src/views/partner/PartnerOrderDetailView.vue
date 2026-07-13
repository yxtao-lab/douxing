<template>
  <div class="partner-page">
    <a-button type="link" class="back-link" @click="$router.push({ name: 'partner-orders' })">← {{ t('partner.ordersTitle') }}</a-button>
    <h1 class="partner-page-title">{{ t('partner.orderDetailTitle') }}</h1>

    <a-spin :spinning="loading">
      <a-card v-if="order">
        <p>{{ order.orderNo }}</p>
        <h2>{{ order.demandTitle }}</h2>
        <p class="amount">¥{{ order.totalAmount }}</p>
        <p>{{ orderStatusLabel(order.status) }}</p>
        <a-button
          v-if="nextStatus"
          type="primary"
          class="mt-4"
          :loading="advancing"
          @click="handleAdvance"
        >
          {{ t('partner.advanceOrder', { status: orderStatusLabel(nextStatus) }) }}
        </a-button>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ServiceOrderStatus, type ServiceOrderDetail } from '@douxing/shared';
import { advanceSellerMarketplaceOrder, fetchMarketplaceOrderDetail } from '@/api/marketplace-partner';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import { message } from 'ant-design-vue';

usePageTitle('partner.orderDetailTitle');
const { t } = useLocale();
const route = useRoute();

const orderId = computed(() => Number(route.params.id));
const loading = ref(true);
const advancing = ref(false);
const order = ref<ServiceOrderDetail | null>(null);

const NEXT_STATUS: Partial<Record<string, string>> = {
  [ServiceOrderStatus.PAID]: ServiceOrderStatus.IN_PROGRESS,
  [ServiceOrderStatus.IN_PROGRESS]: ServiceOrderStatus.DELIVERED,
  [ServiceOrderStatus.DELIVERED]: ServiceOrderStatus.CONFIRMED,
};

const nextStatus = computed(() => (order.value ? NEXT_STATUS[order.value.status] : undefined));

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
 * 加载订单详情。
 */
async function load() {
  loading.value = true;
  try {
    order.value = await fetchMarketplaceOrderDetail(orderId.value);
  } finally {
    loading.value = false;
  }
}

/**
 * 推进履约状态至下一合法节点。
 */
async function handleAdvance() {
  if (!order.value || !nextStatus.value) return;
  advancing.value = true;
  try {
    order.value = await advanceSellerMarketplaceOrder(orderId.value, {
      status: nextStatus.value as ServiceOrderDetail['status'],
    });
    message.success(t('partner.advanceSuccess'));
  } finally {
    advancing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.partner-page-title { margin: 0 0 16px; font-size: 22px; font-weight: 600; }
.back-link { padding-left: 0; margin-bottom: 8px; }
.amount { font-size: 24px; font-weight: 700; color: #1677ff; }
.mt-4 { margin-top: 16px; }
</style>
