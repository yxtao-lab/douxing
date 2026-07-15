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
        <button class="btn-outline" size="mini" @click="goOnboard">{{ t('marketplaceUi.onboardEntry') }}</button>
        <button class="btn-outline" size="mini" @click="goGroups">{{ t('marketplaceUi.groupsEntry') }}</button>
        <button class="btn-outline" size="mini" @click="goMine">{{ t('marketplace.mineTitle') }}</button>
        <button class="btn-primary" size="mini" @click="goCreate">{{ t('marketplace.createTitle') }}</button>
      </view>

      <view class="tabs">
        <view class="tab" :class="{ active: tab === 'demands' }" @click="switchTab('demands')">
          {{ t('marketplaceUi.tabDemands') }}
        </view>
        <view class="tab" :class="{ active: tab === 'products' }" @click="switchTab('products')">
          {{ t('marketplaceUi.tabProducts') }}
        </view>
      </view>

      <DouxingEmptyState v-if="loading" loading embedded compact />
      <template v-else-if="tab === 'demands'">
        <DouxingEmptyState v-if="items.length === 0" :title="t('marketplaceUi.emptyHall')" embedded />
        <view v-else class="list">
          <view v-for="item in items" :key="item.id" class="card" @click="goDetail(item.id)">
            <text class="card-title">{{ item.title }}</text>
            <text class="meta">{{ item.destination || t('common.unknownPlace') }}</text>
            <text class="meta">{{ categoryLabel(item.categoryCode) }}</text>
            <text class="status">{{ demandStatusLabel(item.status) }}</text>
          </view>
        </view>
      </template>
      <template v-else>
        <DouxingEmptyState v-if="products.length === 0" :title="t('marketplaceUi.emptyProducts')" embedded />
        <view v-else class="list">
          <view v-for="item in products" :key="item.id" class="card" @click="goProduct(item.id)">
            <text class="card-title">{{ item.title }}</text>
            <text class="meta">{{ item.orgName || t('marketplaceUi.orgName') }}</text>
            <text class="meta">{{ item.destination || t('common.unknownPlace') }}</text>
            <text v-if="item.minPrice" class="price">¥{{ item.minPrice }} {{ t('marketplaceUi.fromPrice') }}</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { SERVICE_CATEGORY_TREE, type ServiceDemandSummary, type ServiceProductSummary } from '@douxing/shared';
import { fetchMarketplaceHallPage, fetchMarketplaceProductHall } from '@/api/marketplace';
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
const tab = ref<'demands' | 'products'>('demands');
const items = ref<ServiceDemandSummary[]>([]);
const products = ref<ServiceProductSummary[]>([]);

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
 * 切换大厅 Tab 并按需加载。
 *
 * @param next - 目标 Tab
 */
function switchTab(next: 'demands' | 'products') {
  tab.value = next;
  void load();
}

/**
 * 按当前 Tab 加载需求或标品列表。
 */
async function load() {
  loading.value = true;
  try {
    if (tab.value === 'demands') {
      const result = await fetchMarketplaceHallPage({ page: 1, pageSize: 30 });
      items.value = result.items;
    } else {
      const result = await fetchMarketplaceProductHall({ page: 1, pageSize: 30 });
      products.value = result.items;
    }
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages/marketplace/create' });
}

function goOnboard() {
  uni.navigateTo({ url: '/pages/marketplace/onboard' });
}

function goGroups() {
  uni.navigateTo({ url: '/pages/marketplace/groups' });
}

function goMine() {
  uni.navigateTo({ url: '/pages/marketplace/mine' });
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/marketplace/detail?id=${id}` });
}

function goProduct(id: number) {
  uni.navigateTo({ url: `/pages/marketplace/product-detail?id=${id}` });
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
.tabs { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: var(--dx-radius-md);
  background: var(--dx-surface);
  color: var(--dx-text-secondary);
  font-size: 26rpx;
  border: 2rpx solid var(--dx-border);
}
.tab.active {
  color: var(--dx-primary);
  border-color: var(--dx-primary);
  font-weight: 600;
}
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card { background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 28rpx; box-shadow: var(--dx-shadow-sm); }
.card-title { display: block; font-size: 30rpx; font-weight: 600; color: var(--dx-text); }
.meta { display: block; margin-top: 6rpx; font-size: 24rpx; color: var(--dx-text-secondary); }
.price { display: block; margin-top: 12rpx; font-size: 28rpx; font-weight: 600; color: var(--dx-primary); }
.status { display: inline-block; margin-top: 12rpx; padding: 4rpx 16rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 500; background: var(--dx-primary-light); color: var(--dx-primary); }
.btn-primary, .btn-outline { margin: 0; }
.btn-primary { background: var(--dx-primary); color: var(--dx-text-inverse); }
.btn-primary::after { border: none; }
.btn-outline { background: var(--dx-surface); color: var(--dx-text); border: 2rpx solid var(--dx-border); }
.btn-outline::after { border: none; }
</style>
