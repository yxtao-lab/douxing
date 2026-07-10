<template>
  <SubPageShell
    :title="t('marketplace.hallTitle')"
    :description="t('marketplaceUi.hallDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-4 flex justify-end gap-2">
      <RouterLink :to="{ name: 'marketplace-mine' }" class="dx-btn-outline text-sm">{{ t('marketplace.mineTitle') }}</RouterLink>
      <RouterLink :to="{ name: 'marketplace-create' }" class="dx-btn-primary text-sm">{{ t('marketplace.createTitle') }}</RouterLink>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="items.length === 0" class="dx-card text-center text-dx-muted">{{ t('marketplaceUi.emptyHall') }}</div>
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
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ServiceDemandSummary } from '@douxing/shared';
import { fetchMarketplaceHallPage } from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('marketplace.pageTitle');
const { t } = useI18n();
const loading = ref(false);
const items = ref<ServiceDemandSummary[]>([]);

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

async function load() {
  loading.value = true;
  try {
    const result = await fetchMarketplaceHallPage({ page: 1, pageSize: 30 });
    items.value = result.items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
