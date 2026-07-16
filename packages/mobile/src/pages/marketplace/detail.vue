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
          <button
            v-if="canReview"
            class="btn-outline"
            size="mini"
            @click="reviewModalVisible = true"
          >
            {{ t('marketplaceUi.reviewTitle') }}
          </button>
          <button
            v-if="canDispute"
            class="btn-outline"
            size="mini"
            @click="disputeModalVisible = true"
          >
            {{ t('marketplaceUi.disputeTitle') }}
          </button>
        </view>
      </view>

      <view v-if="order" class="section">
        <text class="section-title">{{ t('marketplaceUi.reviewTitle') }}</text>
        <DouxingEmptyState v-if="reviews.length === 0" :title="t('marketplaceUi.reviewEmpty')" embedded compact />
        <view v-for="item in reviews" :key="item.id" class="quote-card">
          <text class="status">{{ t(`marketplace.reviewTargetType.${item.targetType}`) }} · {{ t('marketplaceUi.reviewRating', { rating: item.rating }) }}</text>
          <text v-if="item.content" class="desc">{{ item.content }}</text>
          <text v-if="item.replyContent" class="desc">{{ t('marketplaceUi.reviewReply') }}：{{ item.replyContent }}</text>
        </view>
      </view>

      <view v-if="order" class="section">
        <text class="section-title">{{ t('marketplaceUi.disputeTitle') }}</text>
        <DouxingEmptyState v-if="disputes.length === 0" :title="t('marketplaceUi.disputeEmpty')" embedded compact />
        <view v-for="item in disputes" :key="item.id" class="quote-card">
          <text class="status">{{ t(`marketplace.disputeType.${item.type}`) }} · {{ t(`marketplace.disputeStatus.${item.status}`) }}</text>
          <text class="desc">{{ item.reason }}</text>
          <text v-if="item.platformNote" class="desc">{{ t('marketplaceUi.disputeType') }}：{{ item.platformNote }}</text>
        </view>
      </view>
    </view>

    <view v-if="reviewModalVisible" class="modal-overlay" @click.self="reviewModalVisible = false">
      <view class="modal-card">
        <text class="section-title">{{ t('marketplaceUi.reviewTitle') }}</text>
        <text>{{ t('marketplaceUi.reviewRating') }}：{{ reviewRating }}</text>
        <slider :value="reviewRating" min="1" max="5" step="1" show-value @change="handleReviewRatingChange" />
        <textarea
          v-model="reviewContent"
          class="form-textarea"
          :placeholder="t('marketplaceUi.reviewContent')"
          maxlength="2000"
        />
        <button class="btn-primary" size="mini" :loading="submittingReview" @click="handleSubmitReview">
          {{ t('marketplaceUi.reviewSubmit') }}
        </button>
        <button class="btn-outline" size="mini" @click="reviewModalVisible = false">
          {{ t('common.cancel') }}
        </button>
      </view>
    </view>

    <view v-if="disputeModalVisible" class="modal-overlay" @click.self="disputeModalVisible = false">
      <view class="modal-card">
        <text class="section-title">{{ t('marketplaceUi.disputeTitle') }}</text>
        <picker mode="selector" :range="disputeTypeOptions" range-key="label" :value="0" @change="handleDisputeTypeChange">
          <view class="picker-row">
            {{ t('marketplaceUi.disputeType') }}：{{ t(`marketplace.disputeType.${disputeType}`) }}
          </view>
        </picker>
        <textarea
          v-model="disputeReason"
          class="form-textarea"
          :placeholder="t('marketplaceUi.disputeReason')"
          maxlength="4000"
        />
        <button class="btn-primary" size="mini" :loading="submittingDispute" @click="handleSubmitDispute">
          {{ t('marketplaceUi.disputeSubmit') }}
        </button>
        <button class="btn-outline" size="mini" @click="disputeModalVisible = false">
          {{ t('common.cancel') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import {
  DemandStatus,
  ServiceOrderDisputeType,
  ServiceOrderReviewTargetType,
  ServiceOrderStatus,
  type DemandQuoteSummary,
  type ServiceDemandDetail,
  type ServiceOrderDisputeSummary,
  type ServiceOrderReviewSummary,
  type ServiceOrderStatusValue,
  type ServiceOrderSummary,
} from '@douxing/shared';
import {
  advanceMarketplaceOrderStatus,
  createMarketplaceOrderDispute,
  createMarketplaceOrderReview,
  fetchMarketplaceDemandDetail,
  fetchMarketplaceDemandQuotes,
  fetchMarketplaceOrderDisputes,
  fetchMarketplaceOrderReviews,
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
const reviews = ref<ServiceOrderReviewSummary[]>([]);
const disputes = ref<ServiceOrderDisputeSummary[]>([]);
const selectingId = ref<number | null>(null);
const paying = ref(false);
const advancing = ref(false);
const reviewModalVisible = ref(false);
const reviewRating = ref(5);
const reviewContent = ref('');
const disputeModalVisible = ref(false);
const disputeType = ref<string>(ServiceOrderDisputeType.QUALITY);
const disputeReason = ref('');
const submittingReview = ref(false);
const submittingDispute = ref(false);
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

const canReview = computed(() => {
  if (!isOwner.value || !order.value) return false;
  return (
    order.value.status === ServiceOrderStatus.CONFIRMED ||
    order.value.status === ServiceOrderStatus.DELIVERED
  );
});

const canDispute = computed(() => {
  if (!isOwner.value || !order.value) return false;
  return ([
    ServiceOrderStatus.PAID,
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
    ServiceOrderStatus.CONFIRMED,
  ] as ServiceOrderStatusValue[]).includes(order.value.status);
});

const disputeTypeOptions = computed(() =>
  Object.values(ServiceOrderDisputeType).map((value) => ({
    value,
    label: t(`marketplace.disputeType.${value}`),
  })),
);

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
    if (order.value) {
      await loadReviews(order.value.id);
      await loadDisputes(order.value.id);
    }
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

/**
 * 加载订单评价列表。
 *
 * @param orderId - 订单 ID
 */
async function loadReviews(orderId: number) {
  try {
    reviews.value = await fetchMarketplaceOrderReviews(orderId);
  } catch {
    reviews.value = [];
  }
}

/**
 * 加载订单争议列表。
 *
 * @param orderId - 订单 ID
 */
async function loadDisputes(orderId: number) {
  try {
    disputes.value = await fetchMarketplaceOrderDisputes(orderId);
  } catch {
    disputes.value = [];
  }
}

/**
 * 处理评分滑块变化。
 *
 * @param e - slider change 事件
 */
function handleReviewRatingChange(e: { detail: { value: number } }) {
  reviewRating.value = e.detail.value;
}

/**
 * 提交买方对卖方的评价。
 */
async function handleSubmitReview() {
  if (!order.value || !isOwner.value) return;
  submittingReview.value = true;
  try {
    await createMarketplaceOrderReview(order.value.id, {
      targetType: ServiceOrderReviewTargetType.SELLER,
      rating: reviewRating.value,
      content: reviewContent.value.trim() || undefined,
    });
    uni.showToast({ title: t('marketplaceUi.reviewSubmitSuccess'), icon: 'success' });
    reviewModalVisible.value = false;
    reviewContent.value = '';
    reviewRating.value = 5;
    await loadReviews(order.value.id);
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    submittingReview.value = false;
  }
}

/**
 * 选择争议类型。
 *
 * @param e - picker change 事件
 */
function handleDisputeTypeChange(e: { detail: { value: number } }) {
  const index = e.detail.value;
  const selected = disputeTypeOptions.value[index];
  if (selected) {
    disputeType.value = selected.value;
  }
}

/**
 * 提交买方对卖方的争议。
 */
async function handleSubmitDispute() {
  if (!order.value || !isOwner.value) return;
  const reason = disputeReason.value.trim();
  if (!reason) {
    uni.showToast({ title: t('marketplaceUi.formInvalid'), icon: 'none' });
    return;
  }
  submittingDispute.value = true;
  try {
    await createMarketplaceOrderDispute(order.value.id, {
      type: disputeType.value,
      reason,
    });
    uni.showToast({ title: t('marketplaceUi.disputeSubmitSuccess'), icon: 'success' });
    disputeModalVisible.value = false;
    disputeReason.value = '';
    await loadDisputes(order.value.id);
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    submittingDispute.value = false;
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
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-card { width: 80%; background: #fff; border-radius: 20rpx; padding: 32rpx; display: flex; flex-direction: column; gap: 16rpx; }
.form-textarea { width: 100%; height: 160rpx; border: 1rpx solid #ddd; border-radius: 12rpx; padding: 16rpx; font-size: 26rpx; box-sizing: border-box; }
.picker-row { padding: 16rpx 0; font-size: 28rpx; color: var(--dx-text-primary); }
</style>
