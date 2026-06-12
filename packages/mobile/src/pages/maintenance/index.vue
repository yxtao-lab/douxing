<template>
  <view class="maintenance-page">
    <view class="maintenance-card">
      <text class="maintenance-icon">🛠️</text>
      <text class="maintenance-title">{{ t('siteStatus.title') }}</text>
      <text class="maintenance-desc">{{ t('siteStatus.desc') }}</text>
      <button class="maintenance-btn" :disabled="checking" @click="retry">
        {{ checking ? t('siteStatus.checking') : t('siteStatus.retry') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPublicSiteStatus } from '@/utils/site-status';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('siteStatus.pageTitle');

const { t } = useI18n();
const checking = ref(false);

async function retry() {
  checking.value = true;
  try {
    const status = await fetchPublicSiteStatus();
    if (status.online) {
      uni.reLaunch({ url: '/pages/index/index' });
    }
  } catch {
    /* 保持维护页 */
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  box-sizing: border-box;
}

.maintenance-card {
  width: 100%;
  max-width: 640rpx;
  padding: 64rpx 40rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 16rpx 48rpx rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.maintenance-icon {
  font-size: 80rpx;
  line-height: 1;
  margin-bottom: 24rpx;
}

.maintenance-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16rpx;
}

.maintenance-desc {
  font-size: 28rpx;
  line-height: 1.6;
  color: #6b7280;
  margin-bottom: 40rpx;
}

.maintenance-btn {
  min-width: 240rpx;
  padding: 20rpx 36rpx;
  border-radius: 999rpx;
  background: #1677ff;
  color: #fff;
  font-size: 28rpx;
  border: none;
}

.maintenance-btn[disabled] {
  opacity: 0.65;
}
</style>
