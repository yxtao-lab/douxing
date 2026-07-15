<template>
  <view class="page" :class="themeClass">
    <DouxingEmptyState v-if="loading" loading embedded />
    <DouxingEmptyState v-else-if="!detail" :title="t('marketplaceUi.emptyProducts')" embedded />
    <view v-else class="body">
      <text class="title">{{ detail.title }}</text>
      <text class="meta">{{ detail.orgName || t('marketplaceUi.orgName') }}</text>
      <text class="meta">{{ detail.destination || t('common.unknownPlace') }}</text>
      <text v-if="detail.description" class="desc">{{ detail.description }}</text>

      <text class="section">{{ t('marketplaceUi.selectSku') }}</text>
      <view
        v-for="sku in detail.skus"
        :key="sku.id"
        class="sku"
        :class="{ active: selectedSkuId === sku.id }"
        @click="selectedSkuId = sku.id"
      >
        <text class="sku-name">{{ sku.name }}</text>
        <text class="sku-price">¥{{ sku.price }}</text>
        <text class="sku-stock">×{{ sku.stock }}</text>
      </view>

      <button class="btn-primary" :disabled="buying || !selectedSkuId" @click="buy">
        {{ t('marketplaceUi.buyNow') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { ServiceProductDetail } from '@douxing/shared';
import {
  fetchMarketplaceProductDetail,
  payMockMarketplaceOrder,
  purchaseMarketplaceProduct,
} from '@/api/marketplace';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.productDetailTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();

const loading = ref(true);
const buying = ref(false);
const detail = ref<ServiceProductDetail | null>(null);
const selectedSkuId = ref<number | null>(null);
let productId = 0;

/**
 * 加载标品详情并默认选中第一个有库存 SKU。
 */
async function load() {
  loading.value = true;
  try {
    detail.value = await fetchMarketplaceProductDetail(productId);
    const available = detail.value.skus.find((sku) => sku.stock > 0) ?? detail.value.skus[0];
    selectedSkuId.value = available?.id ?? null;
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

/**
 * 直购下单并模拟支付。
 */
async function buy() {
  if (!selectedSkuId.value || buying.value) return;
  buying.value = true;
  try {
    const order = await purchaseMarketplaceProduct(productId, {
      skuId: selectedSkuId.value,
      quantity: 1,
    });
    await payMockMarketplaceOrder(order.id);
    uni.showToast({ title: t('marketplaceUi.purchaseSuccess'), icon: 'none' });
    await load();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    buying.value = false;
  }
}

onLoad((query) => {
  productId = Number(query?.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    uni.showToast({ title: t('marketplaceUi.emptyProducts'), icon: 'none' });
    return;
  }
  void load();
});
</script>

<style scoped>
.page { min-height: 100vh; background: var(--dx-page-bg); padding: 32rpx; }
.body { background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 32rpx; box-shadow: var(--dx-shadow-sm); }
.title { display: block; font-size: 36rpx; font-weight: 700; color: var(--dx-text); }
.meta { display: block; margin-top: 8rpx; font-size: 24rpx; color: var(--dx-text-secondary); }
.desc { display: block; margin-top: 20rpx; font-size: 26rpx; color: var(--dx-text); line-height: 1.6; }
.section { display: block; margin: 32rpx 0 16rpx; font-size: 28rpx; font-weight: 600; color: var(--dx-text); }
.sku {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-radius: var(--dx-radius-md);
  border: 2rpx solid var(--dx-border);
  background: var(--dx-page-bg);
}
.sku.active { border-color: var(--dx-primary); background: var(--dx-primary-light); }
.sku-name { flex: 1; font-size: 26rpx; color: var(--dx-text); }
.sku-price { font-size: 28rpx; font-weight: 600; color: var(--dx-primary); }
.sku-stock { font-size: 22rpx; color: var(--dx-text-secondary); }
.btn-primary {
  margin-top: 32rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.btn-primary::after { border: none; }
.btn-primary[disabled] { opacity: 0.5; }
</style>
