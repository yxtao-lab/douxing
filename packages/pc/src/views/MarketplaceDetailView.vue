<template>
  <SubPageShell
    :title="t('marketplace.detailTitle')"
    :back-to="{ name: 'marketplace-mine' }"
    :back-label="t('marketplace.mineTitle')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <template v-else-if="demand">
      <div class="dx-card mb-4">
        <h2 class="text-xl font-bold">{{ demand.title }}</h2>
        <p class="mt-1 text-sm text-dx-muted">{{ demand.demandNo }}</p>
        <p class="text-sm text-dx-muted">{{ demand.destination }}</p>
        <p class="text-sm text-dx-primary">{{ demandStatusLabel(demand.status) }}</p>
        <p v-if="demand.description" class="mt-3 text-sm">{{ demand.description }}</p>
      </div>

      <section v-if="isOwner" class="mb-4">
        <h3 class="mb-2 font-semibold">{{ t('marketplaceUi.quotesTitle') }}</h3>
        <div v-if="quotes.length === 0" class="dx-card text-sm text-dx-muted">{{ t('marketplaceUi.emptyQuotes') }}</div>
        <div v-for="quote in quotes" :key="quote.id" class="dx-card mb-2">
          <p class="text-lg font-bold text-dx-primary">¥{{ quote.amount }}</p>
          <p class="text-sm text-dx-muted">{{ quote.orgName || quote.providerDisplayName || '-' }}</p>
          <p v-if="quote.proposalText" class="mt-1 text-sm">{{ quote.proposalText }}</p>
          <button
            v-if="canSelectQuote"
            type="button"
            class="dx-btn-primary mt-2 text-sm"
            :disabled="selectingId === quote.id"
            @click="handleSelectQuote(quote.id)"
          >
            {{ t('marketplace.selectQuote') }}
          </button>
        </div>
      </section>

      <section v-if="order">
        <h3 class="mb-2 font-semibold">{{ t('marketplaceUi.orderTitle') }}</h3>
        <div class="dx-card">
          <p class="text-sm text-dx-muted">{{ order.orderNo }}</p>
          <p class="text-lg font-bold">¥{{ order.totalAmount }}</p>
          <p class="text-sm text-dx-primary">{{ orderStatusLabel(order.status) }}</p>
          <button
            v-if="order.status === 'pending_pay'"
            type="button"
            class="dx-btn-primary mt-2 text-sm"
            :disabled="paying"
            @click="handlePay"
          >
            {{ t('marketplace.payMock') }}
          </button>
          <button
            v-else-if="nextOrderStatus"
            type="button"
            class="dx-btn-outline mt-2 text-sm"
            :disabled="advancing"
            @click="handleAdvance"
          >
            {{ t('marketplaceUi.advanceOrder', { status: orderStatusLabel(nextOrderStatus) }) }}
          </button>
        </div>
      </section>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  DemandStatus,
  ServiceOrderStatus,
  type DemandQuoteSummary,
  type ServiceDemandDetail,
  type ServiceOrderSummary,
} from '@douxing/shared';
import {
  advanceMarketplaceOrderStatus,
  fetchMarketplaceDemandDetail,
  fetchMarketplaceDemandQuotes,
  fetchMyMarketplaceOrders,
  payMockMarketplaceOrder,
  selectMarketplaceQuote,
} from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useUserStore } from '@/stores/user';

usePageTitle('marketplace.detailTitle');
const { t } = useI18n();
const route = useRoute();
const userStore = useUserStore();
const demandId = computed(() => Number(route.params.id));
const loading = ref(true);
const demand = ref<ServiceDemandDetail | null>(null);
const quotes = ref<DemandQuoteSummary[]>([]);
const order = ref<ServiceOrderSummary | null>(null);
const selectingId = ref<number | null>(null);
const paying = ref(false);
const advancing = ref(false);

const isOwner = computed(
  () => userStore.user != null && demand.value?.publisherUserId === userStore.user.id,
);

const canSelectQuote = computed(
  () =>
    isOwner.value &&
    demand.value != null &&
    (demand.value.status === DemandStatus.PUBLISHED || demand.value.status === DemandStatus.QUOTING),
);

const nextOrderStatus = computed(() => {
  if (!order.value) return null;
  const map: Record<string, string> = {
    [ServiceOrderStatus.PAID]: ServiceOrderStatus.IN_PROGRESS,
    [ServiceOrderStatus.IN_PROGRESS]: ServiceOrderStatus.DELIVERED,
    [ServiceOrderStatus.DELIVERED]: ServiceOrderStatus.CONFIRMED,
  };
  return map[order.value.status] ?? null;
});

function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

function orderStatusLabel(status: string) {
  const key = `marketplace.orderStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

async function load() {
  if (!demandId.value) return;
  loading.value = true;
  try {
    demand.value = await fetchMarketplaceDemandDetail(demandId.value);
    if (isOwner.value) {
      quotes.value = await fetchMarketplaceDemandQuotes(demandId.value);
    }
    const orders = await fetchMyMarketplaceOrders();
    order.value = orders.find((o) => o.demandId === demandId.value) ?? null;
  } finally {
    loading.value = false;
  }
}

async function handleSelectQuote(quoteId: number) {
  selectingId.value = quoteId;
  try {
    order.value = await selectMarketplaceQuote(demandId.value, { quoteId });
    await load();
  } finally {
    selectingId.value = null;
  }
}

async function handlePay() {
  if (!order.value) return;
  paying.value = true;
  try {
    order.value = await payMockMarketplaceOrder(order.value.id);
    await load();
  } finally {
    paying.value = false;
  }
}

async function handleAdvance() {
  if (!order.value || !nextOrderStatus.value) return;
  advancing.value = true;
  try {
    order.value = await advanceMarketplaceOrderStatus(order.value.id, {
      status: nextOrderStatus.value as ServiceOrderSummary['status'],
    });
    await load();
  } finally {
    advancing.value = false;
  }
}

onMounted(load);
</script>
