<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🧾</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.orders') }}</text>
            <text class="hero-desc">{{ t('orders.pageDesc') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="filter-panel">
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
      </view>

      <DouxingEmptyState v-if="loading" loading embedded compact />

      <DouxingEmptyState
        v-else-if="items.length === 0"
        variant="orders"
        embedded
        :title="emptyHint"
        :description="t('emptyState.ordersDesc')"
        :action-label="activeTab === 'all' ? t('routes.goPlan') : undefined"
        @action="goPlan"
      />

      <view v-else class="order-list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card-head">
            <text class="product">{{ item.productName }}</text>
            <text class="status" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</text>
          </view>
          <text class="meta">{{ orderNoText(item.orderNo) }}</text>
          <text class="meta">{{ amountLineText(item) }}</text>

          <view v-if="item.status === OrderStatus.PENDING" class="actions">
            <button
              class="btn-primary"
              size="mini"
              :loading="payingId === item.id"
              @click="handleContinuePay(item)"
            >
              {{ continuePayLabel }}
            </button>
            <button
              class="btn-outline"
              size="mini"
              :loading="cancellingId === item.id"
              @click="handleCancel(item)"
            >
              {{ t('orders.cancelOrder') }}
            </button>
          </view>
          <view v-else-if="item.orderType === OrderType.ROUTE && canViewRoute(item.status)" class="actions">
            <button class="btn-outline" size="mini" @click="goRouteDetail(item.productId)">
              {{ t('orders.viewRoute') }}
            </button>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="list-footer">{{ t('common.loadMore') }}</view>
      <view v-else-if="!hasMore && items.length > 0" class="list-footer muted">{{ t('common.noMore') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import type { OrderInfo, OrderListTab } from '@douxing/shared';
import { OrderStatus, OrderType, getOrderStatusI18nKey } from '@douxing/shared';
import { fetchOrdersPage, cancelOrder } from '@/api/orders';
import { useInfiniteList } from '@/composables/useInfiniteList';
import { continuePayForOrder, getContinuePayButtonLabel } from '@/utils/order-payment';
import { getStoredUser, getAppErrorMessage } from '@/utils/request';
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
const payingId = ref<number | null>(null);
const cancellingId = ref<number | null>(null);
const continuePayLabel = computed(() => getContinuePayButtonLabel());

const { items, loading, loadingMore, hasMore, loadInitial, loadMore } = useInfiniteList(
  (page, pageSize) => fetchOrdersPage(page, pageSize, activeTab.value as OrderListTab),
);

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
  await loadInitial();
}

async function handleContinuePay(item: OrderInfo) {
  payingId.value = item.id;
  try {
    await continuePayForOrder(item.id);
    uni.showToast({ title: t('orders.paySuccess'), icon: 'success' });
    await loadOrders();
  } catch (e) {
    const msg = getAppErrorMessage(e, t('routes.payFailed'));
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
    uni.showToast({ title: getAppErrorMessage(e, t('orders.cancelFailed')), icon: 'none' });
  } finally {
    cancellingId.value = null;
  }
}

watch(activeTab, () => {
  void loadInitial();
});

onReachBottom(() => {
  void loadMore();
});

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
  --page-gutter: 32rpx;
  min-height: 100vh;
  background: var(--dx-bg);
  box-sizing: border-box;
}

.page-hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 28rpx;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}

.hero-content {
  position: relative;
  z-index: 1;
}

.header-brand {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.logo-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-emoji {
  font-size: 32rpx;
  line-height: 1;
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}

.hero-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}

.page-body {
  padding: 0 var(--page-gutter) 32rpx;
}

.filter-panel {
  margin-bottom: 20rpx;
  padding: 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}

.tabs {
  display: flex;
  background: var(--dx-bg);
  padding: 8rpx;
  border-radius: var(--dx-radius-lg);
  gap: 8rpx;
}

.tab {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  padding: 12rpx 8rpx;
  border-radius: var(--dx-radius-md);
}

.tab.active {
  background: var(--dx-surface);
  color: var(--dx-primary);
  font-weight: 600;
  box-shadow: var(--dx-shadow-sm);
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
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
  font-weight: 600;
  color: var(--dx-text);
}

.status {
  font-size: 24rpx;
  flex-shrink: 0;
  font-weight: 500;
}

.status.pending {
  color: #d97706;
}

.status.done {
  color: #059669;
}

.status.cancelled {
  color: var(--dx-text-muted);
}

.meta {
  display: block;
  color: var(--dx-text-secondary);
  font-size: 24rpx;
  margin-top: 6rpx;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.btn-primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}

.btn-primary::after {
  border: none;
}

.btn-outline {
  background: var(--dx-surface);
  color: var(--dx-text);
  border: 2rpx solid var(--dx-border);
}

.btn-outline::after {
  border: none;
}

.list-footer {
  padding: 24rpx 0 8rpx;
  text-align: center;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}

.list-footer.muted {
  color: var(--dx-text-muted, #9ca3af);
}
</style>
