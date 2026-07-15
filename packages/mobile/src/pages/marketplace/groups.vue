<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">👥</text>
          </view>
          <view class="header-copy">
            <text class="hero-title">{{ t('marketplace.groupsTitle') }}</text>
            <text class="hero-desc">{{ t('marketplaceUi.groupsDesc') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="toolbar">
        <button class="btn-outline" size="mini" @click="goHall">{{ t('marketplace.hallTitle') }}</button>
        <button class="btn-primary" size="mini" @click="goCreate">{{ t('marketplace.groupCreateTitle') }}</button>
      </view>

      <DouxingEmptyState v-if="loading" loading embedded compact />
      <DouxingEmptyState v-else-if="items.length === 0" :title="t('marketplaceUi.emptyGroups')" embedded />

      <view v-else class="list">
        <view v-for="item in items" :key="item.groupId" class="card" @click="goDetail(item.groupId)">
          <view class="card-head">
            <text class="card-title">{{ item.group.name }}</text>
            <text class="status-badge active">{{ memberRoleLabel(item.memberRole) }}</text>
          </view>
          <text class="meta">{{ groupTypeLabel(item.group.groupType) }}</text>
          <text v-if="item.group.headcount" class="meta">
            {{ t('marketplaceUi.fieldHeadcount') }}：{{ item.group.headcount }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { GroupMembershipSummary } from '@douxing/shared';
import { fetchMyMarketplaceGroups } from '@/api/marketplace-groups';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.groupsTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();
const loading = ref(false);
const items = ref<GroupMembershipSummary[]>([]);

/**
 * 解析团体类型展示名。
 *
 * @param type - 团体类型
 * @returns 本地化标签
 */
function groupTypeLabel(type: string) {
  const key = `marketplace.groupType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 解析成员角色展示名。
 *
 * @param role - 成员角色
 * @returns 本地化标签
 */
function memberRoleLabel(role: string) {
  const key = `marketplace.memberRole.${role}`;
  const label = t(key);
  return label !== key ? label : role;
}

/**
 * 加载我的团体列表。
 */
async function load() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  loading.value = true;
  try {
    items.value = await fetchMyMarketplaceGroups();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goHall() {
  uni.navigateTo({ url: '/pages/marketplace/hall' });
}

function goCreate() {
  uni.navigateTo({ url: '/pages/marketplace/group-create' });
}

/**
 * 跳转团体详情。
 *
 * @param id - 团体 ID
 */
function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/marketplace/group-detail?id=${id}` });
}

onShow(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-page-bg);
}
.page-hero {
  position: relative;
  padding: 48rpx 32rpx 28rpx;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  opacity: 0.95;
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
}
.hero-content {
  position: relative;
}
.header-brand {
  display: flex;
  align-items: center;
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
.hero-title {
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
  padding: 24rpx 32rpx 48rpx;
}
.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.list {
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
.card-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.4;
}
.status-badge {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.5;
}
.status-badge.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}
.meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.btn-primary,
.btn-outline {
  margin: 0;
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
</style>
