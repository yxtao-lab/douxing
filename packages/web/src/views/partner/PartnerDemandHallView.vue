<template>
  <div class="partner-page">
    <h1 class="partner-page-title">{{ t('partner.demandsTitle') }}</h1>
    <p class="partner-page-desc">{{ t('partner.demandsDesc') }}</p>

    <a-alert v-if="!canQuote" type="info" :message="t('partner.notQuotable')" show-icon class="mb-4">
      <template #action>
        <a-button size="small" @click="$router.push({ name: 'partner-onboard' })">{{ t('partner.goOnboard') }}</a-button>
      </template>
    </a-alert>

    <a-spin :spinning="loading">
      <a-empty v-if="items.length === 0" :description="t('common.noData')" />
      <div v-else class="demand-list">
        <a-card v-for="item in items" :key="item.id" hoverable class="demand-item" @click="goDetail(item.id)">
          <h3>{{ item.title }}</h3>
          <p>{{ item.destination || '-' }} · {{ demandStatusLabel(item.status) }}</p>
          <p class="meta">{{ item.demandNo }}</p>
        </a-card>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ServiceDemandSummary } from '@douxing/shared';
import { fetchPartnerDemandHallPage } from '@/api/marketplace-partner';
import { usePartnerContext } from '@/composables/usePartnerContext';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('partner.demandsTitle');
const { t } = useLocale();
const router = useRouter();
const { context, reload: reloadContext } = usePartnerContext();
const loading = ref(false);
const items = ref<ServiceDemandSummary[]>([]);

const canQuote = computed(() => {
  if (!context.value) return false;
  return context.value.canQuoteAsProvider || context.value.quotableOrgIds.length > 0;
});

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
 * 跳转需求详情。
 *
 * @param id - 需求 ID
 */
function goDetail(id: number) {
  router.push({ name: 'partner-demand-detail', params: { id } });
}

/**
 * 加载接单大厅列表。
 */
async function load() {
  loading.value = true;
  try {
    const result = await fetchPartnerDemandHallPage({ page: 1, pageSize: 50 });
    items.value = result.items;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await reloadContext();
  await load();
});
</script>

<style scoped>
.partner-page-title { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
.partner-page-desc { margin: 0 0 16px; color: #666; }
.mb-4 { margin-bottom: 16px; }
.demand-list { display: flex; flex-direction: column; gap: 12px; }
.demand-item { cursor: pointer; }
.demand-item h3 { margin: 0 0 8px; }
.demand-item p { margin: 0; color: #666; }
.meta { font-size: 12px; color: #999; margin-top: 4px !important; }
</style>
