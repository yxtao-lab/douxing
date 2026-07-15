<template>
  <SubPageShell
    :title="detail?.title || t('marketplace.productDetailTitle')"
    :description="detail?.orgName || t('marketplaceUi.orgName')"
    :back-to="{ name: 'marketplace-hall' }"
    :back-label="t('marketplace.hallTitle')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="!detail" class="dx-card text-center text-dx-muted">{{ t('marketplaceUi.emptyProducts') }}</div>
    <div v-else class="dx-card space-y-4">
      <p class="text-sm text-dx-muted">{{ detail.destination || t('common.unknownPlace') }}</p>
      <p v-if="detail.description" class="text-dx-text whitespace-pre-wrap">{{ detail.description }}</p>

      <div>
        <h3 class="mb-2 font-semibold text-dx-text">{{ t('marketplaceUi.selectSku') }}</h3>
        <div class="space-y-2">
          <button
            v-for="sku in detail.skus"
            :key="sku.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left"
            :class="selectedSkuId === sku.id ? 'border-dx-primary bg-dx-primary/5' : 'border-dx-border'"
            @click="selectedSkuId = sku.id"
          >
            <span class="text-dx-text">{{ sku.name }}</span>
            <span class="text-sm text-dx-muted">×{{ sku.stock }}</span>
            <span class="font-semibold text-dx-primary">¥{{ sku.price }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="dx-btn-primary"
        :disabled="buying || !selectedSkuId"
        @click="buy"
      >
        {{ t('marketplaceUi.buyNow') }}
      </button>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { ServiceProductDetail } from '@douxing/shared';
import {
  fetchMarketplaceProductDetail,
  payMockMarketplaceOrder,
  purchaseMarketplaceProduct,
} from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();
const loading = ref(true);
const buying = ref(false);
const detail = ref<ServiceProductDetail | null>(null);
const selectedSkuId = ref<number | null>(null);

/**
 * 加载标品详情。
 */
async function load() {
  const id = Number(route.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    detail.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    detail.value = await fetchMarketplaceProductDetail(id);
    const available = detail.value.skus.find((sku) => sku.stock > 0) ?? detail.value.skus[0];
    selectedSkuId.value = available?.id ?? null;
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

/**
 * 直购下单并模拟支付。
 */
async function buy() {
  if (!detail.value || !selectedSkuId.value || buying.value) return;
  buying.value = true;
  try {
    const order = await purchaseMarketplaceProduct(detail.value.id, {
      skuId: selectedSkuId.value,
      quantity: 1,
    });
    await payMockMarketplaceOrder(order.id);
    window.alert(t('marketplaceUi.purchaseSuccess'));
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  } finally {
    buying.value = false;
  }
}

onMounted(load);
</script>
