<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="title">{{ t('pointsRedemption.title') }}</text>
        <text class="balance">{{ balanceText }}</text>
        <text class="hint">{{ t('pointsRedemption.hint') }}</text>
        <view class="entitlement-row">
          <text class="entitlement">{{ planBonusText }}</text>
          <text class="entitlement">{{ photoBonusText }}</text>
          <text v-if="entitlements?.posterStickerUnlocked" class="entitlement">
            {{ t('pointsRedemption.stickerOwned') }}
          </text>
        </view>
      </view>
    </view>

    <view class="page-body">
      <DouxingEmptyState v-if="loading" loading />
      <view v-else class="catalog">
        <view v-for="item in catalog" :key="item.id" class="card">
          <view class="card-main">
            <text class="card-title">{{ productTitle(item.id) }}</text>
            <text class="card-desc">{{ productDesc(item) }}</text>
            <text class="card-cost">{{ tf('pointsRedemption.cost', { points: item.costPoints }) }}</text>
          </view>
          <button
            class="btn-redeem"
            :disabled="!item.canRedeem || redeemingId === item.id"
            @click="handleRedeem(item)"
          >
            {{ redeemButtonLabel(item) }}
          </button>
        </view>
      </view>

      <view v-if="history.length" class="history">
        <text class="history-title">{{ t('pointsRedemption.historyTitle') }}</text>
        <view v-for="row in history" :key="row.id" class="history-item">
          <text class="history-name">{{ productTitle(row.productId) }}</text>
          <text class="history-meta">-{{ row.pointsSpent }} · {{ row.createdAt }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { PointRedemptionCatalogItem, PointRedemptionEntitlements, PointRedemptionRecord } from '@douxing/shared';
import { PointRedemptionProductId } from '@douxing/shared';
import { fetchRedemptionCatalog, fetchRedemptionHistory, redeemPoints } from '@/api/user';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/composables/useTheme';
import { getAppErrorMessage } from '@/utils/request';

const { t, tf } = useLocale();
const { themeClass } = useTheme();

const loading = ref(true);
const redeemingId = ref('');
const catalog = ref<PointRedemptionCatalogItem[]>([]);
const entitlements = ref<PointRedemptionEntitlements | null>(null);
const history = ref<PointRedemptionRecord[]>([]);

const balanceText = computed(() =>
  tf('pointsRedemption.balance', { points: entitlements.value?.balance ?? 0 }),
);
const planBonusText = computed(() =>
  tf('pointsRedemption.planBonus', {
    bonus: entitlements.value?.bonusPlanCandidates ?? 0,
    total: entitlements.value?.effectivePlanCandidates ?? 0,
  }),
);
const photoBonusText = computed(() =>
  tf('pointsRedemption.photoBonus', {
    count: entitlements.value?.bonusPhotoCount ?? 0,
  }),
);

/**
 * 商品标题。
 *
 * @param id - 商品 ID
 * @returns 文案
 */
function productTitle(id: string) {
  const map: Record<string, string> = {
    [PointRedemptionProductId.AI_PLAN_PACK]: t('pointsRedemption.productAiPlan'),
    [PointRedemptionProductId.PHOTO_QUOTA_PACK]: t('pointsRedemption.productPhoto'),
    [PointRedemptionProductId.MEMBER_TRIAL_SILVER]: t('pointsRedemption.productMember'),
    [PointRedemptionProductId.POSTER_STICKER]: t('pointsRedemption.productSticker'),
  };
  return map[id] ?? id;
}

/**
 * 商品说明。
 *
 * @param item - 目录项
 * @returns 文案
 */
function productDesc(item: PointRedemptionCatalogItem) {
  if (item.id === PointRedemptionProductId.AI_PLAN_PACK) {
    return tf('pointsRedemption.descAiPlan', { n: item.grantPlanCandidates ?? 1 });
  }
  if (item.id === PointRedemptionProductId.PHOTO_QUOTA_PACK) {
    return tf('pointsRedemption.descPhoto', { count: item.grantPhotoCount ?? 100 });
  }
  if (item.id === PointRedemptionProductId.MEMBER_TRIAL_SILVER) {
    return tf('pointsRedemption.descMember', { days: item.grantMemberDays ?? 7 });
  }
  return t('pointsRedemption.descSticker');
}

/**
 * 兑换按钮文案。
 *
 * @param item - 目录项
 * @returns 文案
 */
function redeemButtonLabel(item: PointRedemptionCatalogItem) {
  if (redeemingId.value === item.id) return t('pointsRedemption.redeeming');
  if (item.canRedeem) return t('pointsRedemption.redeem');
  if (item.blockedReason === 'insufficient') return t('pointsRedemption.insufficient');
  if (item.blockedReason === 'already_owned') return t('pointsRedemption.owned');
  if (item.blockedReason === 'member_not_eligible') return t('pointsRedemption.memberBlock');
  if (item.blockedReason === 'limit') return t('pointsRedemption.limit');
  return t('pointsRedemption.unavailable');
}

/**
 * 加载目录与历史。
 */
async function load() {
  loading.value = true;
  try {
    const [catalogRes, historyRes] = await Promise.all([
      fetchRedemptionCatalog(),
      fetchRedemptionHistory(10),
    ]);
    catalog.value = catalogRes.catalog;
    entitlements.value = catalogRes.entitlements;
    history.value = historyRes.items;
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('pointsRedemption.loadFailed')),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

/**
 * 兑换商品。
 *
 * @param item - 目录项
 */
async function handleRedeem(item: PointRedemptionCatalogItem) {
  if (!item.canRedeem || redeemingId.value) return;
  redeemingId.value = item.id;
  try {
    await redeemPoints({
      productId: item.id,
      clientRequestId: `m-${item.id}-${Date.now()}`,
    });
    uni.showToast({ title: t('pointsRedemption.success'), icon: 'success' });
    await load();
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('pointsRedemption.failed')),
      icon: 'none',
    });
  } finally {
    redeemingId.value = '';
  }
}

onShow(() => {
  void load();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
}
.page-hero {
  position: relative;
  padding: 48rpx 32rpx 40rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0f766e, #115e59 55%, #134e4a);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}
.balance {
  display: block;
  margin-top: 12rpx;
  font-size: 48rpx;
  font-weight: 700;
  color: #99f6e4;
}
.hint {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
}
.entitlement-row {
  margin-top: 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.entitlement {
  font-size: 22rpx;
  color: #ccfbf1;
  background: rgba(255, 255, 255, 0.12);
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
}
.page-body {
  padding: 24rpx 24rpx 48rpx;
}
.card {
  display: flex;
  gap: 16rpx;
  align-items: center;
  background: var(--dx-card, #fff);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 118, 110, 0.06);
}
.card-main {
  flex: 1;
  min-width: 0;
}
.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.card-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--dx-text-muted);
  line-height: 1.4;
}
.card-cost {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #0f766e;
  font-weight: 600;
}
.btn-redeem {
  flex-shrink: 0;
  min-width: 140rpx;
  font-size: 24rpx;
  background: #0f766e;
  color: #fff;
  border-radius: 999rpx;
  padding: 12rpx 20rpx;
  border: none;
}
.btn-redeem[disabled] {
  opacity: 0.45;
}
.history {
  margin-top: 32rpx;
}
.history-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 12rpx;
}
.history-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--dx-border, #e5e7eb);
}
.history-name {
  display: block;
  font-size: 26rpx;
  color: var(--dx-text);
}
.history-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
</style>
