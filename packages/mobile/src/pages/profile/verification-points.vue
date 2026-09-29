<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="title">{{ t('verificationPoints.title') }}</text>
        <text class="balance">{{ balanceText }}</text>
        <text class="hint">{{ t('verificationPoints.hint') }}</text>
        <button class="btn-redeem-link" @click="goRedeem">{{ t('verificationPoints.goRedeem') }}</button>
      </view>
    </view>

    <view class="page-body">
      <DouxingEmptyState v-if="loading" loading />
      <DouxingEmptyState
        v-else-if="events.length === 0"
        variant="generic"
        :title="t('verificationPoints.empty')"
        :description="t('verificationPoints.emptyDesc')"
      />
      <view v-else class="event-list">
        <view v-for="item in events" :key="item.id" class="event-item">
          <view class="event-main">
            <text class="event-type">{{ eventTypeLabel(item.eventType) }}</text>
            <text class="event-time">{{ item.createdAt }}</text>
          </view>
          <text class="event-points">{{ formatPoints(item.points) }}</text>
        </view>
        <view v-if="hasMore" class="load-more" @click="loadMore">
          <text>{{ loadingMore ? t('common.loading') : t('verificationPoints.loadMore') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { VerificationPointEventInfo } from '@douxing/shared';
import { VerificationPointEventType, VerificationPointSpendEventType } from '@douxing/shared';
import { fetchVerificationPoints } from '@/api/user';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/composables/useTheme';

const { t, tf } = useLocale();
const { themeClass } = useTheme();

const loading = ref(true);
const loadingMore = ref(false);
const balance = ref(0);
const events = ref<VerificationPointEventInfo[]>([]);
const page = ref(1);
const total = ref(0);
const pageSize = 20;

const balanceText = computed(() =>
  tf('verificationPoints.balance', { points: balance.value }),
);
const hasMore = computed(() => events.value.length < total.value);

/**
 * 将事件类型映射为可读文案。
 *
 * @param eventType - 账本事件类型
 * @returns 展示文案
 */
function eventTypeLabel(eventType: string) {
  const map: Record<string, string> = {
    [VerificationPointEventType.INSPIRATION_PUBLISH]: t('verificationPoints.eventInspiration'),
    [VerificationPointEventType.FOLLOW_COMPLETE]: t('verificationPoints.eventFollow'),
    [VerificationPointEventType.CORRECTION_ACCEPTED]: t('verificationPoints.eventCorrection'),
    [VerificationPointEventType.TRAVEL_READY_UPGRADE]: t('verificationPoints.eventTravelReady'),
    [VerificationPointEventType.CHECKIN_KEY_NODE]: t('verificationPoints.eventKeyNode'),
    [VerificationPointEventType.CHECKIN_FIRST_POI]: t('verificationPoints.eventFirstPoi'),
    [VerificationPointEventType.CHECKIN_QUALITY]: t('verificationPoints.eventQuality'),
    [VerificationPointSpendEventType.REDEEM_AI_PLAN]: t('verificationPoints.eventRedeemAiPlan'),
    [VerificationPointSpendEventType.REDEEM_PHOTO_QUOTA]: t('verificationPoints.eventRedeemPhoto'),
    [VerificationPointSpendEventType.REDEEM_MEMBER_TRIAL]: t('verificationPoints.eventRedeemMember'),
    [VerificationPointSpendEventType.REDEEM_POSTER_STICKER]: t('verificationPoints.eventRedeemSticker'),
  };
  return map[eventType] ?? eventType;
}

/**
 * 带符号展示积分变动。
 *
 * @param points - 变动值
 * @returns 文案
 */
function formatPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

/**
 * 跳转兑换页。
 */
function goRedeem() {
  uni.navigateTo({ url: '/pages/profile/points-redemption' });
}

/**
 * 拉取账本页。
 *
 * @param reset - 是否重置到第一页
 */
async function load(reset = false) {
  if (reset) {
    page.value = 1;
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    const summary = await fetchVerificationPoints(page.value, pageSize);
    balance.value = summary.balance;
    total.value = summary.total;
    events.value = reset ? summary.events : [...events.value, ...summary.events];
  } catch (err) {
    console.error('[verification-points]', err);
    uni.showToast({ title: t('verificationPoints.loadFailed'), icon: 'none' });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

/**
 * 加载下一页账本。
 */
function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  page.value += 1;
  void load(false);
}

onShow(() => {
  void load(true);
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
  color: #fff;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0f766e, #134e4a 60%, #042f2e);
}
.hero-content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.title {
  font-size: 36rpx;
  font-weight: 700;
}
.balance {
  font-size: 56rpx;
  font-weight: 800;
}
.hint {
  font-size: 24rpx;
  opacity: 0.85;
}
.btn-redeem-link {
  margin-top: 8rpx;
  align-self: flex-start;
  font-size: 24rpx;
  color: #ccfbf1;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999rpx;
  padding: 10rpx 24rpx;
  border: none;
}
.page-body {
  padding: 24rpx 32rpx 48rpx;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.event-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--dx-card, #fff);
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}
.event-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.event-type {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.event-time {
  font-size: 22rpx;
  color: var(--dx-muted);
}
.event-points {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f766e;
}
.load-more {
  text-align: center;
  padding: 24rpx;
  color: var(--dx-muted);
  font-size: 26rpx;
}
</style>
