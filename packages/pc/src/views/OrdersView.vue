<template>
  <SubPageShell
    :title="t('nav.orders')"
    :description="t('orders.pageDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="rounded-full px-4 py-1.5 text-sm"
        :class="activeTab === tab.key ? 'bg-dx-primary text-white' : 'bg-gray-100 text-dx-muted'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading && items.length === 0" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="items.length === 0" class="dx-card text-center text-dx-muted">{{ emptyHint }}</div>
    <div v-else class="space-y-3">
      <div v-for="item in items" :key="item.id" class="dx-card">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold text-dx-text">{{ item.productName }}</h3>
          <span class="text-sm" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
        </div>
        <p class="mt-1 text-sm text-dx-muted">{{ t('orders.orderNo', { no: item.orderNo }) }}</p>
        <p class="text-sm text-dx-muted">{{ orderTypeText(item.orderType) }}</p>
        <p class="text-sm text-dx-muted">
          {{ t('orders.amountLine', { amount: item.totalAmount, time: formatTime(item.createdAt) }) }}
        </p>
        <div v-if="item.status === OrderStatus.PENDING" class="mt-3 flex gap-2">
          <button type="button" class="dx-btn-primary !px-3 !py-1.5 text-xs" :disabled="payingId === item.id" @click="handlePay(item.id)">
            {{ t('orders.continuePayMock') }}
          </button>
          <button type="button" class="dx-btn-secondary !px-3 !py-1.5 text-xs" :disabled="cancellingId === item.id" @click="handleCancel(item.id)">
            {{ t('orders.cancelOrder') }}
          </button>
        </div>
        <RouterLink
          v-else-if="item.orderType === OrderType.MEMBERSHIP && canViewRoute(item.status)"
          :to="{ name: 'membership' }"
          class="mt-3 inline-block text-sm text-dx-primary hover:underline"
        >
          {{ t('orders.viewMembership') }}
        </RouterLink>
        <RouterLink
          v-else-if="item.orderType === OrderType.ROUTE && canViewRoute(item.status)"
          :to="{ name: 'route-detail', params: { id: item.productId } }"
          class="mt-3 inline-block text-sm text-dx-primary hover:underline"
        >
          {{ t('orders.viewRoute') }}
        </RouterLink>
      </div>
      <InfiniteScrollFooter
        :has-more="hasMore"
        :loading="loading"
        :loading-more="loadingMore"
        :on-load-more="loadMore"
      />
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { OrderInfo, OrderListTab } from '@douxing/shared';
import { OrderStatus, OrderType, getOrderStatusI18nKey } from '@douxing/shared';
import { cancelOrder, continuePayForOrder, fetchOrdersPage } from '@/api/orders';
import InfiniteScrollFooter from '@/components/InfiniteScrollFooter.vue';
import SubPageShell from '@/components/SubPageShell.vue';
import { appDialog } from '@/composables/useAppDialog';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const { t } = useLocale();
const activeTab = ref<OrderListTab>('all');
const items = ref<OrderInfo[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);
const payingId = ref<number | null>(null);
const cancellingId = ref<number | null>(null);

const tabs = computed(() => [
  { key: 'all' as OrderListTab, label: t('orders.tabAll') },
  { key: 'pending' as OrderListTab, label: t('orders.tabPending') },
  { key: 'done' as OrderListTab, label: t('orders.tabDone') },
]);

const emptyHint = computed(() => {
  if (activeTab.value === 'pending') return t('orders.emptyPending');
  if (activeTab.value === 'done') return t('orders.emptyDone');
  return t('orders.emptyAll');
});

function statusLabel(status: number) {
  return t(getOrderStatusI18nKey(status));
}

function statusClass(status: number) {
  if (status === OrderStatus.PENDING) return 'text-amber-600';
  if (status === OrderStatus.COMPLETED || status === OrderStatus.PAID) return 'text-emerald-600';
  return 'text-dx-muted';
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function canViewRoute(status: number) {
  return status === OrderStatus.PAID || status === OrderStatus.COMPLETED;
}

function orderTypeText(orderType: string) {
  const key = orderType === OrderType.MEMBERSHIP ? 'orderType.membership' : 'orderType.route';
  return t(key);
}

async function fetchPage(nextPage: number, append: boolean) {
  const result = await fetchOrdersPage(nextPage, pageSize, activeTab.value);
  items.value = append ? [...items.value, ...result.items] : result.items;
  page.value = nextPage;
  hasMore.value = result.hasMore;
}

async function reload() {
  loading.value = true;
  try {
    await fetchPage(1, false);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  loadingMore.value = true;
  try {
    await fetchPage(page.value + 1, true);
  } finally {
    loadingMore.value = false;
  }
}

async function handlePay(orderId: number) {
  payingId.value = orderId;
  try {
    await continuePayForOrder(orderId);
    appMessage.success(t('orders.paySuccess'));
    await reload();
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('routes.payFailed')));
  } finally {
    payingId.value = null;
  }
}

async function handleCancel(orderId: number) {
  const confirmed = await appDialog.confirm({
    content: t('orders.cancelModalContent'),
    danger: true,
  });
  if (!confirmed) return;
  cancellingId.value = orderId;
  try {
    await cancelOrder(orderId);
    appMessage.success(t('orders.cancelSuccess'));
    await reload();
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('orders.cancelFailed')));
  } finally {
    cancellingId.value = null;
  }
}

watch(activeTab, () => {
  void reload();
}, { immediate: true });
</script>
