<template>
  <SubPageShell
    :title="t('marketplace.hallTitle')"
    :description="t('marketplaceUi.hallDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-4 flex justify-end gap-2">
      <RouterLink :to="{ name: 'marketplace-groups' }" class="dx-btn-outline text-sm">{{ t('marketplaceUi.groupsEntry') }}</RouterLink>
      <RouterLink :to="{ name: 'marketplace-mine' }" class="dx-btn-outline text-sm">{{ t('marketplace.mineTitle') }}</RouterLink>
      <RouterLink :to="{ name: 'marketplace-create' }" class="dx-btn-primary text-sm">{{ t('marketplace.createTitle') }}</RouterLink>
    </div>

    <div class="mb-4 flex gap-2">
      <button
        type="button"
        class="rounded-md border px-4 py-2 text-sm"
        :class="tab === 'demands' ? 'border-dx-primary text-dx-primary font-semibold' : 'border-dx-border text-dx-muted'"
        @click="switchTab('demands')"
      >
        {{ t('marketplaceUi.tabDemands') }}
      </button>
      <button
        type="button"
        class="rounded-md border px-4 py-2 text-sm"
        :class="tab === 'products' ? 'border-dx-primary text-dx-primary font-semibold' : 'border-dx-border text-dx-muted'"
        @click="switchTab('products')"
      >
        {{ t('marketplaceUi.tabProducts') }}
      </button>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <template v-else-if="tab === 'demands'">
      <div v-if="items.length === 0" class="dx-card text-center text-dx-muted">{{ t('marketplaceUi.emptyHall') }}</div>
      <div v-else class="space-y-3">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          :to="{ name: 'marketplace-detail', params: { id: item.id } }"
          class="dx-card block hover:shadow-md transition-shadow"
        >
          <h3 class="font-semibold text-dx-text">{{ item.title }}</h3>
          <p class="mt-1 text-sm text-dx-muted">{{ item.destination || t('common.unknownPlace') }}</p>
          <p class="text-sm text-dx-primary">{{ demandStatusLabel(item.status) }}</p>
        </RouterLink>
      </div>
    </template>
    <template v-else>
      <div v-if="products.length === 0" class="dx-card text-center text-dx-muted">{{ t('marketplaceUi.emptyProducts') }}</div>
      <div v-else class="space-y-3">
        <RouterLink
          v-for="item in products"
          :key="item.id"
          :to="{ name: 'marketplace-product-detail', params: { id: item.id } }"
          class="dx-card block hover:shadow-md transition-shadow"
        >
          <h3 class="font-semibold text-dx-text">{{ item.title }}</h3>
          <p class="mt-1 text-sm text-dx-muted">{{ item.orgName || t('marketplaceUi.orgName') }}</p>
          <p class="text-sm text-dx-muted">{{ item.destination || t('common.unknownPlace') }}</p>
          <p v-if="item.minPrice" class="mt-1 text-sm font-semibold text-dx-primary">
            ¥{{ item.minPrice }} {{ t('marketplaceUi.fromPrice') }}
          </p>
        </RouterLink>
      </div>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ServiceDemandSummary, ServiceProductSummary } from '@douxing/shared';
import { fetchMarketplaceHallPage, fetchMarketplaceProductHall } from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const loading = ref(false);
const tab = ref<'demands' | 'products'>('demands');
const items = ref<ServiceDemandSummary[]>([]);
const products = ref<ServiceProductSummary[]>([]);

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
 * 切换大厅 Tab 并重新加载。
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
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
