<template>
  <view class="page">
    <view v-if="loading" class="state-text">{{ t('common.loading') }}</view>
    <template v-else-if="membership">
      <view class="current-card" :class="badgeClass(membership.level)">
        <MemberLevelIcon :level="membership.level" size="lg" />
        <view class="current-body">
          <text class="current-label">{{ t('membership.currentLevel') }}</text>
          <text class="current-name">{{ levelLabel(membership.level) }}</text>
          <text class="current-meta">{{ currentSummary }}</text>
        </view>
      </view>

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
  type MembershipInfo,
} from '@douxing/shared';
import { fetchMembershipInfo } from '@/api/user';
import { getStoredUser } from '@/utils/request';
import MemberLevelIcon from '@/components/member-level-icon/MemberLevelIcon.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.membership');

const loading = ref(true);
const membership = ref<MembershipInfo | null>(null);
const tiers = getAllMembershipTiers();

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

onShow(async () => {
  if (!getStoredUser()) {
    uni.showToast({ title: t('membership.loginRequired'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  loading.value = true;
  try {
    membership.value = await fetchMembershipInfo();
  } catch {
    membership.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx;
  box-sizing: border-box;
}
.state-text {
  padding: 80rpx 24rpx;
  text-align: center;
  color: #6b7280;
  font-size: 28rpx;
}
.current-card {
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 20rpx;
  background: #fff;
  border: 2rpx solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 28rpx;
}
.current-card.free {
  border-color: #d1d5db;
}
.current-card.silver {
  border-color: #94a3b8;
  background: linear-gradient(135deg, #fff 0%, #f1f5f9 100%);
}
.current-card.gold {
  border-color: #fbbf24;
  background: linear-gradient(135deg, #fff 0%, #fef3c7 100%);
}
.current-card.vip {
  border-color: #a78bfa;
  background: linear-gradient(135deg, #fff 0%, #ede9fe 100%);
}
.current-body {
  flex: 1;
  min-width: 0;
}
.current-label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}
.current-name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
  margin-top: 8rpx;
}
.current-meta {
  display: block;
  font-size: 26rpx;
  color: #374151;
  margin-top: 12rpx;
}
.tier-icon-strip {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 20rpx;
  padding: 20rpx 16rpx;
  background: #fff;
  border-radius: 20rpx;
}
.tier-icon-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 4rpx;
  border-radius: 16rpx;
  opacity: 0.55;
}
.tier-icon-item.active {
  opacity: 1;
  background: #eff6ff;
  box-shadow: inset 0 0 0 2rpx #bfdbfe;
}
.tier-icon-label {
  font-size: 20rpx;
  color: #374151;
  text-align: center;
  line-height: 1.3;
}
.tier-icon-item.active .tier-icon-label {
  color: #1677ff;
  font-weight: 600;
}
.section {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx 32rpx;
}
.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
  margin-bottom: 20rpx;
}
.compare-table {
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.compare-row {
  display: flex;
  border-bottom: 1rpx solid #e5e7eb;
}
.compare-row:last-child {
  border-bottom: none;
}
.compare-header {
  background: #f9fafb;
}
.feature-col {
  flex: 1.2;
  padding: 18rpx 12rpx;
  font-size: 22rpx;
  color: #374151;
  border-right: 1rpx solid #e5e7eb;
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
  color: #6b7280;
  text-align: center;
  border-right: 1rpx solid #e5e7eb;
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
  color: #374151;
  padding-top: 14rpx;
  padding-bottom: 14rpx;
}
.tier-head-name {
  font-size: 18rpx;
  line-height: 1.3;
  text-align: center;
}
.tier-col.active {
  background: #eff6ff;
  color: #1677ff;
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
  border-radius: 16rpx;
  padding: 24rpx;
  border: 2rpx solid #e5e7eb;
  background: #fff;
}
.tier-card.current {
  box-shadow: 0 4rpx 20rpx rgba(22, 119, 255, 0.12);
}
.tier-card.free {
  border-color: #e5e7eb;
}
.tier-card.silver {
  border-color: #cbd5e1;
  background: linear-gradient(135deg, #fff 60%, #f8fafc 100%);
}
.tier-card.gold {
  border-color: #fcd34d;
  background: linear-gradient(135deg, #fff 60%, #fffbeb 100%);
}
.tier-card.vip {
  border-color: #c4b5fd;
  background: linear-gradient(135deg, #fff 60%, #f5f3ff 100%);
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
  color: #111827;
}
.tier-current-tag {
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}
.tier-card-line {
  display: block;
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.6;
  padding-left: 92rpx;
}
.upgrade-hint {
  display: block;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
}
</style>
