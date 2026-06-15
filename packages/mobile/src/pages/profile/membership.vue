<template>
  <view class="page" :class="themeClass">
    <view v-if="loading" class="state-text">{{ t('common.loading') }}</view>
    <template v-else-if="membership">
      <view class="membership-hero">
        <view class="hero-bg" />
        <view class="current-card" :class="badgeClass(membership.level)">
          <MemberLevelIcon :level="membership.level" size="lg" />
          <view class="current-body">
            <text class="current-label">{{ t('membership.currentLevel') }}</text>
            <text class="current-name">{{ levelLabel(membership.level) }}</text>
            <text class="current-meta">{{ currentSummary }}</text>
            <text v-if="expiresText" class="current-expires">{{ expiresText }}</text>
            <text v-if="membership.isExpired" class="expired-hint">{{ t('membership.expiredHint') }}</text>
          </view>
        </view>
      </view>

      <view class="page-body">
        <view class="tier-icon-strip">
          <view
            v-for="tier in tiers"
            :key="`strip-${tier.level}`"
            class="tier-icon-item"
            :class="{ active: tier.level === membership.level }"
          >
            <MemberLevelIcon :level="tier.level" size="md" />
            <text class="tier-icon-label">{{ levelLabel(tier.level) }}</text>
          </view>
        </view>

        <view v-if="photoStorage" class="storage-section">
          <text class="section-title">{{ t('membership.storageTitle') }}</text>
          <view class="storage-bar">
            <view class="storage-row">
              <text class="storage-value">{{ storageSummary }}</text>
            </view>
            <view class="storage-track">
              <view class="storage-fill" :style="{ width: storagePercent + '%' }" />
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">{{ t('membership.compareTitle') }}</text>
          <view class="compare-table">
            <view class="compare-row compare-header">
              <text class="feature-col feature-col--head">{{ t('membership.featureColumn') }}</text>
              <view
                v-for="tier in tiers"
                :key="`head-${tier.level}`"
                class="tier-col tier-col--head"
                :class="{ active: tier.level === membership.level }"
              >
                <MemberLevelIcon :level="tier.level" size="sm" />
                <text class="tier-head-name">{{ levelLabel(tier.level) }}</text>
              </view>
            </view>

            <view class="compare-row">
              <text class="feature-col">{{ t('membership.featurePlanCount') }}</text>
              <text
                v-for="tier in tiers"
                :key="`count-${tier.level}`"
                class="tier-col"
                :class="{ active: tier.level === membership.level }"
              >
                {{ tf('membership.planCountUnit', { count: tier.planCandidateCount }) }}
              </text>
            </view>

            <view class="compare-row">
              <text class="feature-col">{{ t('membership.featureFollowUp') }}</text>
              <view
                v-for="tier in tiers"
                :key="`follow-${tier.level}`"
                class="tier-col tier-col--follow"
                :class="{ active: tier.level === membership.level, yes: tier.canAppendPlan, no: !tier.canAppendPlan }"
              >
                <text class="follow-icon">{{ tier.canAppendPlan ? '✓' : '✕' }}</text>
                <text class="follow-text">
                  {{ tier.canAppendPlan ? t('membership.followUpYes') : t('membership.followUpNo') }}
                </text>
              </view>
            </view>

            <view class="compare-row">
              <text class="feature-col">{{ t('membership.featurePhotoStorage') }}</text>
              <text
                v-for="tier in tiers"
                :key="`photo-${tier.level}`"
                class="tier-col"
                :class="{ active: tier.level === membership.level }"
              >
                {{
                  tf('membership.photoStorageUnit', {
                    count: tier.photoQuota.maxCount,
                    bytes: formatStorageBytes(tier.photoQuota.maxBytes),
                  })
                }}
              </text>
            </view>
          </view>

          <view class="tier-cards">
            <view
              v-for="tier in tiers"
              :key="tier.level"
              class="tier-card"
              :class="[badgeClass(tier.level), { current: tier.level === membership.level }]"
            >
              <view class="tier-card-head">
                <MemberLevelIcon :level="tier.level" size="md" />
                <view class="tier-card-title">
                  <text class="tier-card-name">{{ levelLabel(tier.level) }}</text>
                  <text v-if="tier.level === membership.level" class="tier-current-tag">
                    {{ t('membership.currentBadge') }}
                  </text>
                </view>
              </view>
              <text class="tier-card-line">
                {{ t('membership.featurePlanCount') }}：
                {{ tf('membership.planCountUnit', { count: tier.planCandidateCount }) }}
              </text>
              <text class="tier-card-line">
                {{ t('membership.featureFollowUp') }}：
                {{ tier.canAppendPlan ? t('membership.followUpYes') : t('membership.followUpNo') }}
              </text>
            </view>
          </view>

          <text v-if="membership.nextLevel" class="upgrade-hint">{{ t('membership.upgradeHint') }}</text>
        </view>

        <view v-if="upgradeProducts.length > 0" class="upgrade-section">
          <text class="section-title">{{ t('membership.upgradeTitle') }}</text>
          <view
            v-for="product in upgradeProducts"
            :key="product.id"
            class="upgrade-card"
            :class="badgeClass(product.targetLevel)"
          >
            <view class="upgrade-card-head">
              <MemberLevelIcon :level="product.targetLevel" size="md" />
              <view class="upgrade-card-info">
                <text class="upgrade-card-name">{{ levelLabel(product.targetLevel) }}</text>
                <text class="upgrade-card-price">{{ tf('membership.priceUnit', { price: product.price }) }}</text>
              </view>
            </view>
            <button
              class="btn-upgrade"
              size="mini"
              :loading="payingLevel === product.targetLevel"
              :disabled="!!payingLevel"
              @click="handleUpgrade(product.targetLevel)"
            >
              {{ upgradeButtonText(product.targetLevel) }}
            </button>
          </view>
          <text class="pay-mode-hint">{{ payButtonLabel }}</text>
        </view>
      </view>
    </template>
    <view v-else class="state-text">{{ t('membership.loadFailed') }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  getAllMembershipTiers,
  getMemberLevelBadgeClass,
  getMemberLevelI18nKey,
  MEMBERSHIP_PRODUCTS,
  type MembershipInfo,
  type MembershipProduct,
} from '@douxing/shared';
import { fetchMembershipInfo, fetchPhotoStorage } from '@/api/user';
import type { UserPhotoStorageInfo } from '@douxing/shared';
import { formatStorageBytes } from '@/api/journey-albums';
import { getStoredUser, getAppErrorMessage } from '@/utils/request';
import MemberLevelIcon from '@/components/member-level-icon/MemberLevelIcon.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import {
  completeMembershipUpgradePayment,
  getMembershipPayButtonLabel,
} from '@/utils/membership-payment';

const { t, tf } = useTf();
const { themeClass } = useTheme();
usePageTitle('nav.membership');

const loading = ref(true);
const membership = ref<MembershipInfo | null>(null);
const photoStorage = ref<UserPhotoStorageInfo | null>(null);
const payingLevel = ref<number | null>(null);
const tiers = getAllMembershipTiers();
const payButtonLabel = getMembershipPayButtonLabel();

const upgradeProducts = computed<MembershipProduct[]>(() => {
  if (!membership.value) return [];
  const effective = membership.value.level;
  const stored = membership.value.storedLevel;
  return MEMBERSHIP_PRODUCTS.filter((product) => {
    if (product.targetLevel > effective) return true;
    return product.targetLevel === stored && stored > 0;
  });
});

const expiresText = computed(() => {
  if (!membership.value?.memberExpiresAt || membership.value.level <= 0) return '';
  const date = membership.value.memberExpiresAt.slice(0, 10);
  return tf('membership.expiresAt', { date });
});

function upgradeButtonText(targetLevel: number): string {
  if (!membership.value) return t('membership.upgrade');
  if (targetLevel === membership.value.level) return t('membership.renew');
  return t('membership.upgrade');
}

async function handleUpgrade(targetLevel: number) {
  payingLevel.value = targetLevel;
  try {
    await completeMembershipUpgradePayment(targetLevel);
    uni.showToast({ title: t('membership.upgradeSuccess'), icon: 'success' });
    const [membershipInfo, storageInfo] = await Promise.all([
      fetchMembershipInfo(),
      fetchPhotoStorage(),
    ]);
    membership.value = membershipInfo;
    photoStorage.value = storageInfo;
  } catch (e) {
    uni.showToast({
      title: getAppErrorMessage(e, t('membership.upgradeFailed')),
      icon: 'none',
    });
  } finally {
    payingLevel.value = null;
  }
}

function levelLabel(level: number): string {
  return t(getMemberLevelI18nKey(level));
}

function badgeClass(level: number): string {
  return getMemberLevelBadgeClass(level);
}

const currentSummary = computed(() => {
  if (!membership.value) return '';
  const followUp = membership.value.canAppendPlan
    ? t('profile.planQuotaFollowUpYes')
    : t('profile.planQuotaFollowUpNo');
  return tf('membership.planCountUnit', { count: membership.value.planCandidateCount }) + ` · ${followUp}`;
});

const storageSummary = computed(() => {
  if (!photoStorage.value) return '';
  return tf('membership.storageSummary', {
    usedBytes: formatStorageBytes(photoStorage.value.usedBytes),
    maxBytes: formatStorageBytes(photoStorage.value.maxBytes),
    usedCount: photoStorage.value.usedCount,
    maxCount: photoStorage.value.maxCount,
  });
});

const storagePercent = computed(() => {
  if (!photoStorage.value) return 0;
  const byteRatio =
    photoStorage.value.maxBytes > 0
      ? photoStorage.value.usedBytes / photoStorage.value.maxBytes
      : 0;
  const countRatio =
    photoStorage.value.maxCount > 0
      ? photoStorage.value.usedCount / photoStorage.value.maxCount
      : 0;
  return Math.min(100, Math.round(Math.max(byteRatio, countRatio) * 100));
});

onShow(async () => {
  if (!getStoredUser()) {
    uni.showToast({ title: t('membership.loginRequired'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  loading.value = true;
  try {
    const [membershipInfo, storageInfo] = await Promise.all([
      fetchMembershipInfo(),
      fetchPhotoStorage(),
    ]);
    membership.value = membershipInfo;
    photoStorage.value = storageInfo;
  } catch {
    membership.value = null;
    photoStorage.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 48rpx;
  box-sizing: border-box;
}
.state-text {
  padding: 80rpx 24rpx;
  text-align: center;
  color: var(--dx-text-secondary);
  font-size: 28rpx;
}
.membership-hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 28rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.current-card {
  position: relative;
  z-index: 1;
  border-radius: var(--dx-radius-md);
  padding: 32rpx;
  background: rgba(255, 255, 255, 0.96);
  border: 2rpx solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--dx-shadow-md);
  display: flex;
  align-items: center;
  gap: 28rpx;
}
.current-card.free {
  border-color: rgba(255, 255, 255, 0.75);
}
.current-card.silver {
  border-color: #94a3b8;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, #f1f5f9 100%);
}
.current-card.gold {
  border-color: #fbbf24;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, #fef3c7 100%);
}
.current-card.vip {
  border-color: #a78bfa;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, #ede9fe 100%);
}
.current-body {
  flex: 1;
  min-width: 0;
}
.current-label {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.current-name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-text);
  margin-top: 8rpx;
}
.current-meta {
  display: block;
  font-size: 26rpx;
  color: var(--dx-text);
  margin-top: 12rpx;
}
.current-expires {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  margin-top: 8rpx;
}
.expired-hint {
  display: block;
  font-size: 24rpx;
  color: #dc2626;
  margin-top: 8rpx;
}
.page-body {
  padding: 0 var(--page-gutter);
}
.tier-icon-strip {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 20rpx;
  padding: 20rpx 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.tier-icon-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 4rpx;
  border-radius: var(--dx-radius-md);
  opacity: 0.55;
}
.tier-icon-item.active {
  opacity: 1;
  background: var(--dx-primary-light);
  box-shadow: inset 0 0 0 2rpx var(--dx-primary-border);
}
.tier-icon-label {
  font-size: 20rpx;
  color: var(--dx-text);
  text-align: center;
  line-height: 1.3;
}
.tier-icon-item.active .tier-icon-label {
  color: var(--dx-primary);
  font-weight: 600;
}
.section {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx 24rpx 32rpx;
  box-shadow: var(--dx-shadow-sm);
}
.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 20rpx;
}
.compare-table {
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  overflow: hidden;
  margin-bottom: 24rpx;
}
.compare-row {
  display: flex;
  border-bottom: 1rpx solid var(--dx-border);
}
.compare-row:last-child {
  border-bottom: none;
}
.compare-header {
  background: var(--dx-bg);
}
.feature-col {
  flex: 1.2;
  padding: 18rpx 12rpx;
  font-size: 22rpx;
  color: var(--dx-text);
  border-right: 1rpx solid var(--dx-border);
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
.feature-col--head {
  font-weight: 600;
}
.tier-col {
  flex: 1;
  padding: 18rpx 8rpx;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  text-align: center;
  border-right: 1rpx solid var(--dx-border);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}
.tier-col:last-child {
  border-right: none;
}
.tier-col--head {
  font-weight: 600;
  color: var(--dx-text);
  padding-top: 14rpx;
  padding-bottom: 14rpx;
}
.tier-head-name {
  font-size: 18rpx;
  line-height: 1.3;
  text-align: center;
}
.tier-col.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  font-weight: 600;
}
.tier-col--follow.yes .follow-icon {
  color: #059669;
}
.tier-col--follow.no .follow-icon {
  color: #dc2626;
}
.follow-icon {
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}
.follow-text {
  font-size: 18rpx;
  line-height: 1.2;
}
.tier-cards {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.tier-card {
  border-radius: var(--dx-radius-md);
  padding: 24rpx;
  border: 2rpx solid var(--dx-border);
  background: var(--dx-surface);
}
.tier-card.current {
  box-shadow: var(--dx-shadow-md);
}
.tier-card.free {
  border-color: var(--dx-border);
}
.tier-card.silver {
  border-color: #cbd5e1;
  background: linear-gradient(135deg, var(--dx-surface) 60%, #f8fafc 100%);
}
.tier-card.gold {
  border-color: #fcd34d;
  background: linear-gradient(135deg, var(--dx-surface) 60%, #fffbeb 100%);
}
.tier-card.vip {
  border-color: #c4b5fd;
  background: linear-gradient(135deg, var(--dx-surface) 60%, #f5f3ff 100%);
}
.tier-card-head {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}
.tier-card-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.tier-card-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.tier-current-tag {
  font-size: 20rpx;
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}
.tier-card-line {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  line-height: 1.6;
  padding-left: 92rpx;
}
.upgrade-hint {
  display: block;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  line-height: 1.5;
}
.upgrade-section {
  margin-top: 24rpx;
  padding-top: 8rpx;
}
.upgrade-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border-radius: var(--dx-radius-md);
  border: 2rpx solid var(--dx-border);
  background: var(--dx-bg);
}
.upgrade-card-head {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-width: 0;
}
.upgrade-card-info {
  flex: 1;
  min-width: 0;
}
.upgrade-card-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.upgrade-card-price {
  display: block;
  font-size: 24rpx;
  color: var(--dx-primary);
  margin-top: 6rpx;
}
.btn-upgrade {
  flex-shrink: 0;
  background: var(--dx-primary);
  color: #fff;
  border: none;
  border-radius: 999rpx;
  font-size: 24rpx;
  padding: 0 28rpx;
}
.pay-mode-hint {
  display: block;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  text-align: center;
}
.storage-section {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  background: var(--dx-bg);
}
.storage-bar {
  margin-top: 12rpx;
}
.storage-row {
  margin-bottom: 12rpx;
}
.storage-value {
  font-size: 24rpx;
  color: var(--dx-text);
}
.storage-track {
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--dx-border);
  overflow: hidden;
}
.storage-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--dx-primary);
}
</style>
