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
          <button
            v-if="canReview"
            type="button"
            class="dx-btn-outline mt-2 ml-2 text-sm"
            @click="reviewModalOpen = true"
          >
            {{ t('marketplaceUi.reviewTitle') }}
          </button>
          <button
            v-if="canDispute"
            type="button"
            class="dx-btn-outline mt-2 ml-2 text-sm"
            @click="disputeModalOpen = true"
          >
            {{ t('marketplaceUi.disputeTitle') }}
          </button>
        </div>
      </section>

      <section v-if="order" class="mb-4">
        <h3 class="mb-2 font-semibold">{{ t('marketplaceUi.reviewTitle') }}</h3>
        <div v-if="reviews.length === 0" class="dx-card text-sm text-dx-muted">{{ t('marketplaceUi.reviewEmpty') }}</div>
        <div v-for="item in reviews" :key="item.id" class="dx-card mb-2">
          <p class="text-sm text-dx-primary">
            {{ reviewTargetTypeLabel(item.targetType) }} · {{ t('marketplaceUi.reviewRating', { rating: item.rating }) }}
          </p>
          <p v-if="item.content" class="mt-1 text-sm">{{ item.content }}</p>
          <p v-if="item.replyContent" class="mt-1 text-sm text-dx-muted">
            {{ t('marketplaceUi.reviewReply') }}：{{ item.replyContent }}
          </p>
        </div>
      </section>

      <section v-if="order" class="mb-4">
        <h3 class="mb-2 font-semibold">{{ t('marketplaceUi.disputeTitle') }}</h3>
        <div v-if="disputes.length === 0" class="dx-card text-sm text-dx-muted">{{ t('marketplaceUi.disputeEmpty') }}</div>
        <div v-for="item in disputes" :key="item.id" class="dx-card mb-2">
          <p class="text-sm text-dx-primary">
            {{ disputeTypeLabel(item.type) }} · {{ disputeStatusLabel(item.status) }}
          </p>
          <p class="mt-1 text-sm">{{ item.reason }}</p>
          <p v-if="item.platformNote" class="mt-1 text-sm text-dx-muted">
            {{ t('marketplaceUi.disputeType') }}：{{ item.platformNote }}
          </p>
        </div>
      </section>
    </template>

    <div v-if="reviewModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="reviewModalOpen = false">
      <div class="dx-card w-full max-w-md">
        <h3 class="mb-4 font-semibold">{{ t('marketplaceUi.reviewTitle') }}</h3>
        <label class="block mb-2 text-sm">{{ t('marketplaceUi.reviewRating') }}：{{ reviewRating }}</label>
        <input v-model.number="reviewRating" type="range" min="1" max="5" step="1" class="w-full mb-4" />
        <textarea
          v-model="reviewContent"
          class="w-full rounded border border-dx-border p-2 text-sm"
          rows="4"
          maxlength="2000"
          :placeholder="t('marketplaceUi.reviewContent')"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="dx-btn-outline text-sm" @click="reviewModalOpen = false">{{ t('common.cancel') }}</button>
          <button type="button" class="dx-btn-primary text-sm" :disabled="submittingReview" @click="handleSubmitReview">{{ t('marketplaceUi.reviewSubmit') }}</button>
        </div>
      </div>
    </div>

    <div v-if="disputeModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="disputeModalOpen = false">
      <div class="dx-card w-full max-w-md">
        <h3 class="mb-4 font-semibold">{{ t('marketplaceUi.disputeTitle') }}</h3>
        <select v-model="disputeType" class="mb-4 w-full rounded border border-dx-border p-2 text-sm">
          <option v-for="opt in disputeTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <textarea
          v-model="disputeReason"
          class="w-full rounded border border-dx-border p-2 text-sm"
          rows="4"
          maxlength="4000"
          :placeholder="t('marketplaceUi.disputeReason')"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="dx-btn-outline text-sm" @click="disputeModalOpen = false">{{ t('common.cancel') }}</button>
          <button type="button" class="dx-btn-primary text-sm" :disabled="submittingDispute" @click="handleSubmitDispute">{{ t('marketplaceUi.disputeSubmit') }}</button>
        </div>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  DemandStatus,
  ServiceOrderDisputeType,
  ServiceOrderReviewTargetType,
  ServiceOrderStatus,
  type DemandQuoteSummary,
  type ServiceDemandDetail,
  type ServiceOrderDisputeSummary,
  type ServiceOrderReviewSummary,
  type ServiceOrderStatusValue,
  type ServiceOrderSummary,
} from '@douxing/shared';
import {
  advanceMarketplaceOrderStatus,
  createMarketplaceOrderDispute,
  createMarketplaceOrderReview,
  fetchMarketplaceDemandDetail,
  fetchMarketplaceDemandQuotes,
  fetchMarketplaceOrderDisputes,
  fetchMarketplaceOrderReviews,
  fetchMyMarketplaceOrders,
  payMockMarketplaceOrder,
  selectMarketplaceQuote,
} from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const route = useRoute();
const userStore = useUserStore();
const demandId = computed(() => Number(route.params.id));
const loading = ref(true);
const demand = ref<ServiceDemandDetail | null>(null);
const quotes = ref<DemandQuoteSummary[]>([]);
const order = ref<ServiceOrderSummary | null>(null);
const reviews = ref<ServiceOrderReviewSummary[]>([]);
const disputes = ref<ServiceOrderDisputeSummary[]>([]);
const selectingId = ref<number | null>(null);
const paying = ref(false);
const advancing = ref(false);
const reviewModalOpen = ref(false);
const reviewRating = ref(5);
const reviewContent = ref('');
const disputeModalOpen = ref(false);
const disputeType = ref<string>(ServiceOrderDisputeType.QUALITY);
const disputeReason = ref('');
const submittingReview = ref(false);
const submittingDispute = ref(false);

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

const canReview = computed(() => {
  if (!isOwner.value || !order.value) return false;
  return (
    order.value.status === ServiceOrderStatus.CONFIRMED ||
    order.value.status === ServiceOrderStatus.DELIVERED
  );
});

const canDispute = computed(() => {
  if (!isOwner.value || !order.value) return false;
  return ([
    ServiceOrderStatus.PAID,
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
    ServiceOrderStatus.CONFIRMED,
  ] as ServiceOrderStatusValue[]).includes(order.value.status);
});

const disputeTypeOptions = computed(() =>
  Object.values(ServiceOrderDisputeType).map((value) => ({
    value,
    label: t(`marketplace.disputeType.${value}`),
  })),
);

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

function disputeTypeLabel(type: string) {
  const key = `marketplace.disputeType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

function disputeStatusLabel(status: string) {
  const key = `marketplace.disputeStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

function reviewTargetTypeLabel(targetType: string) {
  const key = `marketplace.reviewTargetType.${targetType}`;
  const label = t(key);
  return label !== key ? label : targetType;
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
    if (order.value) {
      reviews.value = await fetchMarketplaceOrderReviews(order.value.id);
      disputes.value = await fetchMarketplaceOrderDisputes(order.value.id);
    }
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

async function handleSubmitReview() {
  if (!order.value || !isOwner.value) return;
  submittingReview.value = true;
  try {
    await createMarketplaceOrderReview(order.value.id, {
      targetType: ServiceOrderReviewTargetType.SELLER,
      rating: reviewRating.value,
      content: reviewContent.value.trim() || undefined,
    });
    reviewModalOpen.value = false;
    reviewContent.value = '';
    reviewRating.value = 5;
    reviews.value = await fetchMarketplaceOrderReviews(order.value.id);
  } finally {
    submittingReview.value = false;
  }
}

async function handleSubmitDispute() {
  if (!order.value || !isOwner.value) return;
  const reason = disputeReason.value.trim();
  if (!reason) return;
  submittingDispute.value = true;
  try {
    await createMarketplaceOrderDispute(order.value.id, {
      type: disputeType.value,
      reason,
    });
    disputeModalOpen.value = false;
    disputeReason.value = '';
    disputes.value = await fetchMarketplaceOrderDisputes(order.value.id);
  } finally {
    submittingDispute.value = false;
  }
}

onMounted(load);
</script>
