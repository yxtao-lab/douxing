<template>
  <view class="page" :class="themeClass">
    <DouxingEmptyState v-if="loading" loading embedded />

    <view v-else-if="demand" class="content">
      <view class="card">
        <text class="title">{{ demand.title }}</text>
        <text class="meta">{{ demand.demandNo }}</text>
        <text class="meta">{{ demand.destination || t('common.unknownPlace') }}</text>
        <text class="status">{{ demandStatusLabel(demand.status) }}</text>
        <text v-if="demand.description" class="desc">{{ demand.description }}</text>
      </view>

      <view v-if="isOwner" class="section">
        <text class="section-title">{{ t('marketplaceUi.quotesTitle') }}</text>
        <DouxingEmptyState v-if="quotes.length === 0" :title="t('marketplaceUi.emptyQuotes')" embedded compact />
        <view v-for="quote in quotes" :key="quote.id" class="quote-card">
          <text class="quote-amount">¥{{ quote.amount }}</text>
          <text class="meta">{{ quote.orgName || quote.providerDisplayName || '-' }}</text>
          <text v-if="quote.proposalText" class="desc">{{ quote.proposalText }}</text>
          <button
            v-if="canSelectQuote"
            class="btn-primary"
            size="mini"
            :loading="selectingId === quote.id"
            @click="handleSelectQuote(quote.id)"
          >
            {{ t('marketplace.selectQuote') }}
          </button>
        </view>
      </view>

      <view v-if="order" class="section">
        <text class="section-title">{{ t('marketplaceUi.orderTitle') }}</text>
        <view class="quote-card">
          <text class="meta">{{ order.orderNo }}</text>
          <text class="quote-amount">¥{{ order.totalAmount }}</text>
          <text class="status">{{ orderStatusLabel(order.status) }}</text>
          <button
            v-if="order.status === 'pending_pay'"
            class="btn-primary"
            size="mini"
            :loading="paying"
            @click="handlePay"
          >
            {{ payButtonLabel }}
          </button>
          <button
            v-else-if="nextOrderStatus"
            class="btn-outline"
            size="mini"
            :loading="advancing"
            @click="handleAdvance"
          >
            {{ tf('marketplaceUi.advanceOrder', { status: orderStatusLabel(nextOrderStatus) }) }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import {
  DemandStatus,
  ServiceOrderStatus,
  type DemandQuoteSummary,
  type ServiceDemandDetail,
  type ServiceOrderSummary,
} from '@douxing/shared';
import {
  advanceMarketplaceOrderStatus,
  fetchMarketplaceDemandDetail,
  fetchMarketplaceDemandQuotes,
  fetchMyMarketplaceOrders,
  selectMarketplaceQuote,
} from '@/api/marketplace';
import {
  completeMarketplaceOrderPayment,
  getMarketplacePayButtonLabel,
} from '@/utils/marketplace-payment';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';

import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.detailTitle');
useSuppressPetFloatingOnPage();
const { t, tf } = useTf();
const { themeClass } = useTheme();
const demandId = ref(0);
const loading = ref(true);
const demand = ref<ServiceDemandDetail | null>(null);
const quotes = ref<DemandQuoteSummary[]>([]);
const order = ref<ServiceOrderSummary | null>(null);
const selectingId = ref<number | null>(null);
const paying = ref(false);
const advancing = ref(false);
const payButtonLabel = computed(() => getMarketplacePayButtonLabel());

const isOwner = computed(() => {
  const user = getStoredUser();
  return user != null && demand.value?.publisherUserId === user.id;
});

const canSelectQuote = computed(
  () =>
    isOwner.value &&
    demand.value != null &&
    (demand.value.status === DemandStatus.PUBLISHED || demand.value.status === DemandStatus.QUOTING),
);

const nextOrderStatus = computed(() => {
  if (!order.value) return null;
  const map: Record<string, string> = {
    [ServiceOrderStatus.PAID]: ServiceOrderStatus.IN_PROGRESS,
    [ServiceOrderStatus.IN_PROGRESS]: ServiceOrderStatus.DELIVERED,
    [ServiceOrderStatus.DELIVERED]: ServiceOrderStatus.CONFIRMED,
  };
  return map[order.value.status] ?? null;
});

/**
 * 解析需求状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

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
 * 加载需求详情、报价与服务订单。
 */
async function load() {
  if (!demandId.value) return;
  loading.value = true;
  try {
    demand.value = await fetchMarketplaceDemandDetail(demandId.value);
    if (isOwner.value) {
      quotes.value = await fetchMarketplaceDemandQuotes(demandId.value);
    }
    const orders = await fetchMyMarketplaceOrders();
    order.value = orders.find((o) => o.demandId === demandId.value) ?? null;
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

/**
 * 选定报价。
 *
 * @param quoteId - 报价 ID
 */
async function handleSelectQuote(quoteId: number) {
  selectingId.value = quoteId;
  try {
    const created = await selectMarketplaceQuote(demandId.value, { quoteId });
    order.value = created;
    await load();
    uni.showToast({ title: t('common.success'), icon: 'success' });
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    selectingId.value = null;
  }
}

async function handlePay() {
  if (!order.value) return;
  paying.value = true;
  try {
    order.value = await completeMarketplaceOrderPayment(order.value.id);
    await load();
    uni.showToast({ title: t('common.success'), icon: 'success' });
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    paying.value = false;
  }
}

async function handleAdvance() {
  if (!order.value || !nextOrderStatus.value) return;
  advancing.value = true;
  try {
    order.value = await advanceMarketplaceOrderStatus(order.value.id, {
      status: nextOrderStatus.value as ServiceOrderSummary['status'],
    });
    await load();
    uni.showToast({ title: t('common.success'), icon: 'success' });
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    advancing.value = false;
  }
}

onLoad((query) => {
  demandId.value = Number(query?.id ?? 0);
});

onShow(load);
</script>

<style scoped>
.page { min-height: 100vh; padding: 32rpx; background: var(--dx-page-bg); }
.content { display: flex; flex-direction: column; gap: 24rpx; }
.card, .quote-card { background: #fff; border-radius: 20rpx; padding: 24rpx; }
.title { display: block; font-size: 34rpx; font-weight: 700; }
.meta { display: block; margin-top: 8rpx; font-size: 24rpx; color: var(--dx-text-secondary); }
.status { display: block; margin-top: 8rpx; font-size: 24rpx; color: var(--dx-primary); }
.desc { display: block; margin-top: 12rpx; font-size: 26rpx; line-height: 1.5; }
.section-title { display: block; margin-bottom: 16rpx; font-size: 28rpx; font-weight: 600; }
.quote-amount { display: block; font-size: 32rpx; font-weight: 700; color: var(--dx-primary); }
.quote-card { margin-bottom: 16rpx; }
</style>
