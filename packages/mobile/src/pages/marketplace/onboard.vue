<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="title">{{ t('marketplace.onboardTitle') }}</text>
        <text class="desc">{{ t('marketplaceUi.onboardHubDesc') }}</text>
      </view>
    </view>

    <view class="page-body">
      <view class="card" @click="goOrgApply">
        <text class="card-title">{{ t('marketplace.orgApplyTitle') }}</text>
        <text class="card-desc">{{ t('marketplaceUi.orgApplyDesc') }}</text>
        <text class="card-arrow">›</text>
      </view>
      <view class="card" @click="goProviderApply">
        <text class="card-title">{{ t('marketplace.providerApplyTitle') }}</text>
        <text class="card-desc">{{ t('marketplaceUi.providerApplyDesc') }}</text>
        <text class="card-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.onboardTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();

/**
 * 跳转商户入驻页；未登录时先登录。
 */
function goOrgApply() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  uni.navigateTo({ url: '/pages/marketplace/org-apply' });
}

/**
 * 跳转个人服务者认证页；未登录时先登录。
 */
function goProviderApply() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  uni.navigateTo({ url: '/pages/marketplace/provider-apply' });
}
</script>

<style scoped>
.page { min-height: 100vh; background: var(--dx-page-bg); }
.page-hero { position: relative; padding: 48rpx 32rpx 24rpx; }
.hero-bg { position: absolute; inset: 0; background: var(--dx-gradient-hero); opacity: 0.95; border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl); }
.hero-content { position: relative; color: #fff; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.desc { display: block; margin-top: 8rpx; font-size: 24rpx; opacity: 0.9; }
.page-body { padding: 24rpx 32rpx 48rpx; display: flex; flex-direction: column; gap: 20rpx; }
.card { position: relative; background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 32rpx 56rpx 32rpx 28rpx; box-shadow: var(--dx-shadow-sm); }
.card-title { display: block; font-size: 30rpx; font-weight: 600; color: var(--dx-text); }
.card-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: var(--dx-text-secondary); line-height: 1.5; }
.card-arrow { position: absolute; right: 24rpx; top: 50%; transform: translateY(-50%); font-size: 36rpx; color: var(--dx-text-muted); }
</style>
