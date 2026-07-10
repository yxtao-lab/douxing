<template>
  <SubPageShell
    :title="t('marketplace.mineTitle')"
    :back-to="{ name: 'marketplace-hall' }"
    :back-label="t('marketplace.hallTitle')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="items.length === 0" class="dx-card text-center text-dx-muted">{{ t('marketplaceUi.emptyMine') }}</div>
    <div v-else class="space-y-3">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="{ name: 'marketplace-detail', params: { id: item.id } }"
        class="dx-card block"
      >
        <h3 class="font-semibold">{{ item.title }}</h3>
        <p class="text-sm text-dx-muted">{{ item.demandNo }}</p>
        <p class="text-sm text-dx-primary">{{ demandStatusLabel(item.status) }}</p>
      </RouterLink>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ServiceDemandSummary } from '@douxing/shared';
import { fetchMyMarketplaceDemands } from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('marketplace.mineTitle');
const { t } = useI18n();
const loading = ref(false);
const items = ref<ServiceDemandSummary[]>([]);

function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

async function load() {
  loading.value = true;
  try {
    items.value = await fetchMyMarketplaceDemands();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
