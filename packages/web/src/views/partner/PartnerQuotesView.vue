<template>
  <div class="partner-page">
    <h1 class="partner-page-title">{{ t('partner.quotesTitle') }}</h1>
    <a-spin :spinning="loading">
      <a-empty v-if="items.length === 0" :description="t('partner.quotesEmpty')" />
      <a-table v-else :columns="columns" :data-source="items" row-key="id" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'demand'">
            <router-link :to="{ name: 'partner-demand-detail', params: { id: record.demandId } }">
              {{ record.demandTitle || record.demandNo }}
            </router-link>
          </template>
          <template v-else-if="column.key === 'status'">
            {{ quoteStatusLabel(record.status) }}
          </template>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { PartnerQuoteListItem } from '@douxing/shared';
import { fetchMyPartnerQuotes } from '@/api/marketplace-partner';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('partner.quotesTitle');
const { t } = useLocale();
const loading = ref(false);
const items = ref<PartnerQuoteListItem[]>([]);

const columns = computed(() => [
  { title: t('partner.colDemand'), key: 'demand' },
  { title: t('partner.colAmount'), dataIndex: 'amount', width: 120 },
  { title: t('partner.colQuoteStatus'), key: 'status', width: 120 },
  { title: t('partner.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
]);

/**
 * 解析报价状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function quoteStatusLabel(status: string) {
  const key = `marketplace.quoteStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 加载我的报价列表。
 */
async function load() {
  loading.value = true;
  try {
    items.value = await fetchMyPartnerQuotes();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.partner-page-title { margin: 0 0 16px; font-size: 22px; font-weight: 600; }
</style>
