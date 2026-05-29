<template>
  <view class="page" :class="themeClass">
    <view class="tabs">
      <text
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </text>
    </view>

    <DouxingEmptyState v-if="loading" loading />
    <DouxingEmptyState
      v-else-if="filteredList.length === 0"
      variant="orders"
      :title="emptyHint"
      :description="t('emptyState.ordersDesc')"
      :action-label="activeTab === 'all' ? t('routes.goPlan') : undefined"
      @action="goPlan"
    />

    <view v-for="item in filteredList" :key="item.id" class="card">
      <view class="card-head">
        <text class="product">{{ item.productName }}</text>
        <text class="status" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</text>
      </view>
      <text class="meta">{{ orderNoText(item.orderNo) }}</text>
      <text class="meta">{{ amountLineText(item) }}</text>

      <view v-if="item.status === OrderStatus.PENDING" class="actions">
        <button class="btn-primary" size="mini" :loading="payingId === item.id" @click="handleContinuePay(item)">
          {{ continuePayLabel }}
        </button>
        <button class="btn-outline" size="mini" :loading="cancellingId === item.id" @click="handleCancel(item)">
          {{ t('orders.cancelOrder') }}
        </button>
      </view>
      <view v-else-if="item.orderType === OrderType.ROUTE && canViewRoute(item.status)" class="actions">
        <button class="btn-outline" size="mini" @click="goRouteDetail(item.productId)">{{ t('orders.viewRoute') }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { OrderInfo } from '@douxing/shared';
import { OrderStatus, OrderType, getOrderStatusI18nKey } from '@douxing/shared';
import { fetchOrders, cancelOrder } from '@/api/orders';
import { continuePayForOrder, getContinuePayButtonLabel } from '@/utils/order-payment';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';

type OrderTab = 'all' | 'pending' | 'done';

usePageTitle('nav.orders');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const tabs = computed(() => [
  { key: 'all' as OrderTab, label: t('orders.tabAll') },
  { key: 'pending' as OrderTab, label: t('orders.tabPending') },
  { key: 'done' as OrderTab, label: t('orders.tabDone') },
]);

const activeTab = ref<OrderTab>('all');
const list = ref<OrderInfo[]>([]);
const loading = ref(false);
const payingId = ref<number | null>(null);
const cancellingId = ref<number | null>(null);
const continuePayLabel = computed(() => getContinuePayButtonLabel());

const filteredList = computed(() => {
  if (activeTab.value === 'pending') {
    return list.value.filter((o) => o.status === OrderStatus.PENDING);
  }
  if (activeTab.value === 'done') {
    return list.value.filter(
      (o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.PAID,
    );
  }
  return list.value;
});

const emptyHint = computed(() => {
  if (activeTab.value === 'pending') return t('orders.emptyPending');
  if (activeTab.value === 'done') return t('orders.emptyDone');
  return t('orders.emptyAll');
});

function statusLabel(status: number) {
  return t(getOrderStatusI18nKey(status));
}

function statusClass(status: number) {
  if (status === OrderStatus.PENDING) return 'pending';
  if (status === OrderStatus.CANCELLED) return 'cancelled';
  if (status === OrderStatus.COMPLETED || status === OrderStatus.PAID) return 'done';
  return '';
}

function canViewRoute(status: number) {
  return status === OrderStatus.COMPLETED || status === OrderStatus.PAID;
}

function orderNoText(orderNo: string) {
  return tf('orders.orderNo', { no: orderNo });
}

function amountLineText(item: OrderInfo) {
  return tf('orders.amountLine', {
    amount: item.totalAmount,
    time: formatTime(item.createdAt),
  });
}

function formatTime(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}

function goRouteDetail(routeId: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${routeId}` });
}

function goPlan() {
  uni.switchTab({ url: '/pages/plan/plan' });
}

async function loadOrders() {
  loading.value = true;
  try {
    list.value = await fetchOrders();
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleContinuePay(item: OrderInfo) {
  payingId.value = item.id;
  try {
    await continuePayForOrder(item.id);
    uni.showToast({ title: t('orders.paySuccess'), icon: 'success' });
    await loadOrders();
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('routes.payFailed');
    if (msg !== t('routes.payCancelled')) {
      uni.showToast({ title: msg, icon: 'none' });
    }
  } finally {
    payingId.value = null;
  }
}

async function handleCancel(item: OrderInfo) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: t('orders.cancelModalTitle'),
      content: t('orders.cancelModalContent'),
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;

  cancellingId.value = item.id;
  try {
    await cancelOrder(item.id);
    uni.showToast({ title: t('orders.cancelSuccess'), icon: 'success' });
    await loadOrders();
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : t('orders.cancelFailed'), icon: 'none' });
  } finally {
    cancellingId.value = null;
  }
}

onShow(async () => {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  await loadOrders();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx;
  padding-bottom: 48rpx;
}
.tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #6b7280;
  background: #fff;
  border-radius: 12rpx;
}
.tab.active {
  color: #1677ff;
  font-weight: 600;
  background: #e6f4ff;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 12rpx;
}
.product {
  flex: 1;
  font-size: 30rpx;
  font-weight: 500;
}
.status {
  font-size: 24rpx;
  flex-shrink: 0;
}
.status.pending {
  color: #d97706;
}
.status.done {
  color: #059669;
}
.status.cancelled {
  color: #9ca3af;
}
.meta {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
  margin-top: 6rpx;
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
.btn-primary {
  background: #1677ff;
  color: #fff;
}
.btn-outline {
  background: #fff;
  color: #374151;
  border: 1rpx solid #e5e7eb;
}
</style>
