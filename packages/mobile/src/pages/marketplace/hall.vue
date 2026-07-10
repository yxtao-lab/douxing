<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="title">{{ t('marketplace.hallTitle') }}</text>
        <text class="desc">{{ t('marketplaceUi.hallDesc') }}</text>
      </view>
    </view>

    <view class="page-body">
      <view class="toolbar">
        <button class="btn-outline" size="mini" @click="goMine">{{ t('marketplace.mineTitle') }}</button>
        <button class="btn-primary" size="mini" @click="goCreate">{{ t('marketplace.createTitle') }}</button>
      </view>

      <DouxingEmptyState v-if="loading" loading embedded compact />
      <DouxingEmptyState v-else-if="items.length === 0" :title="t('marketplaceUi.emptyHall')" embedded />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card" @click="goDetail(item.id)">
          <text class="card-title">{{ item.title }}</text>
          <text class="meta">{{ item.destination || t('common.unknownPlace') }}</text>
          <text class="meta">{{ categoryLabel(item.categoryCode) }}</text>
          <text class="status">{{ demandStatusLabel(item.status) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { SERVICE_CATEGORY_TREE, type ServiceDemandSummary } from '@douxing/shared';
import { fetchMarketplaceHallPage } from '@/api/marketplace';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage } from '@/utils/request';

import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.pageTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();
const loading = ref(false);
const items = ref<ServiceDemandSummary[]>([]);

/**
 * 解析类目展示名。
 *
 * @param code - 类目 code
 * @returns 本地化标签
 */
function categoryLabel(code: string) {
  for (const node of SERVICE_CATEGORY_TREE) {
    if (node.code === code) return t(node.labelKey);
    for (const child of node.children ?? []) {
      if (child.code === code) return t(child.labelKey);
    }
  }
  return code;
}

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
 * 加载需求大厅列表。
 */
async function load() {
  loading.value = true;
  try {
    const result = await fetchMarketplaceHallPage({ page: 1, pageSize: 30 });
    items.value = result.items;
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages/marketplace/create' });
}

function goMine() {
  uni.navigateTo({ url: '/pages/marketplace/mine' });
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/marketplace/detail?id=${id}` });
}

onShow(load);
</script>

<style scoped>
.page { min-height: 100vh; background: var(--dx-page-bg); }
.page-hero { position: relative; padding: 48rpx 32rpx 24rpx; }
.hero-bg { position: absolute; inset: 0; background: var(--dx-gradient-hero); opacity: 0.95; border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl); }
.hero-content { position: relative; color: #fff; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.desc { display: block; margin-top: 8rpx; font-size: 24rpx; opacity: 0.9; }
.page-body { padding: 24rpx 32rpx 48rpx; }
.toolbar { display: flex; justify-content: flex-end; gap: 16rpx; margin-bottom: 24rpx; }
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card { background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 28rpx; box-shadow: var(--dx-shadow-sm); }
.card-title { display: block; font-size: 30rpx; font-weight: 600; color: var(--dx-text); }
.meta { display: block; margin-top: 6rpx; font-size: 24rpx; color: var(--dx-text-secondary); }
.status { display: inline-block; margin-top: 12rpx; padding: 4rpx 16rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 500; background: var(--dx-primary-light); color: var(--dx-primary); }
.btn-primary, .btn-outline { margin: 0; }
.btn-primary { background: var(--dx-primary); color: var(--dx-text-inverse); }
.btn-primary::after { border: none; }
.btn-outline { background: var(--dx-surface); color: var(--dx-text); border: 2rpx solid var(--dx-border); }
.btn-outline::after { border: none; }
</style>
