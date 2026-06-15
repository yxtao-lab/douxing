<template>
  <div class="mx-auto max-w-7xl px-4 py-6 lg:px-8">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-dx-text">{{ t('pc.nav.routes') }}</h1>
      <p class="mt-1 text-sm text-dx-muted">{{ t('routes.pageDesc') }}</p>
    </header>

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="tab in scopeTabs"
        :key="tab.id"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-medium transition"
        :class="
          activeScope === tab.id
            ? 'bg-dx-primary text-white'
            : 'bg-white text-dx-muted shadow-sm ring-1 ring-dx-border hover:text-dx-text'
        "
        @click="switchScope(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="relative w-full lg:max-w-md">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dx-muted"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="m13.5 13.5 3.5 3.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <input
          v-model="searchInput"
          type="search"
          class="w-full rounded-xl border border-dx-border bg-white py-2.5 pl-10 pr-20 text-sm text-dx-text shadow-sm outline-none ring-dx-primary transition focus:ring-2"
          :placeholder="t('routes.searchPlaceholder')"
          @keydown.enter.prevent="applySearchNow"
        />
        <button
          v-if="searchInput"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-dx-primary transition hover:bg-dx-primary-light"
          @click="clearSearch"
        >
          {{ t('common.reset') }}
        </button>
      </div>
      <p v-if="searchKeyword" class="text-xs text-dx-muted lg:text-right">
        {{ t('routes.searchResultCount', { count: listTotal }) }}
      </p>
    </div>

    <div v-if="activeScope === 'mine'" class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="f in statusFilters"
        :key="String(f.value)"
        type="button"
        class="rounded-full px-3 py-1.5 text-xs transition"
        :class="
          statusFilter === f.value
            ? 'bg-dx-primary-light font-medium text-dx-primary'
            : 'bg-gray-100 text-dx-muted hover:bg-gray-200'
        "
        @click="statusFilter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="loading && routes.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="loadError && routes.length === 0" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ loadError }}</p>
      <button type="button" class="dx-btn-secondary" @click="reload">{{ t('common.refresh') }}</button>
    </div>

    <div v-else-if="routes.length === 0" class="dx-card text-center">
      <p class="mb-2 text-dx-text">{{ emptyText }}</p>
      <p v-if="emptyHint" class="mb-4 text-sm text-dx-muted">{{ emptyHint }}</p>
      <div class="flex flex-wrap justify-center gap-3">
        <button v-if="searchKeyword" type="button" class="dx-btn-secondary" @click="clearSearch">
          {{ t('common.reset') }}
        </button>
        <button v-else type="button" class="dx-btn-primary" @click="goPlan">{{ t('routes.goPlan') }}</button>
        <button
          v-if="!searchKeyword && activeScope === 'mine' && statusFilter !== undefined"
          type="button"
          class="dx-btn-secondary"
          @click="statusFilter = undefined"
        >
          {{ t('pc.routes.filterReset') }}
        </button>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouteListItem
        v-for="item in routes"
        :key="item.id"
        :route="item"
        :show-author="activeScope === 'plaza'"
      />
    </div>

    <InfiniteScrollFooter
      v-if="routes.length > 0"
      :has-more="hasMore"
      :loading="loading"
      :loading-more="loadingMore"
      :on-load-more="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { RouteListScope, TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchRoutesPage } from '@/api/routes';
import InfiniteScrollFooter from '@/components/InfiniteScrollFooter.vue';
import RouteListItem from '@/components/route/RouteListItem.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const vueRoute = useRoute();
const { t } = useLocale();

const activeScope = ref<RouteListScope>('mine');
const statusFilter = ref<number | undefined>(undefined);
const searchInput = ref('');
const searchKeyword = ref('');
const routes = ref<TravelRouteInfo[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const listTotal = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref('');
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const scopeTabs = computed(() => [
  { id: 'mine' as RouteListScope, label: t('routes.scopeMine') },
  { id: 'plaza' as RouteListScope, label: t('routes.scopePlaza') },
  { id: 'favorites' as RouteListScope, label: t('routes.scopeFavorites') },
]);

const statusFilters = computed(() => [
  { label: t('routes.filterAll'), value: undefined as number | undefined },
  { label: t('routes.filterDraft'), value: RouteStatus.DRAFT },
  { label: t('routes.filterPublished'), value: RouteStatus.PUBLISHED },
]);

const emptyText = computed(() => {
  if (loadError.value) return loadError.value;
  if (searchKeyword.value) return t('routes.emptySearch');
  if (activeScope.value === 'plaza') return t('routes.emptyPlaza');
  if (activeScope.value === 'favorites') return t('routes.emptyFavorites');
  return t('routes.emptyMine');
});

const emptyHint = computed(() => {
  if (loadError.value) return '';
  if (searchKeyword.value) {
    return t('routes.emptySearchHint', { keyword: searchKeyword.value });
  }
  if (activeScope.value === 'mine' && statusFilter.value !== undefined) {
    const filterLabel =
      statusFilter.value === RouteStatus.PUBLISHED
        ? t('routes.filterPublished')
        : t('routes.filterDraft');
    return t('routes.emptyFilterHint', { filter: filterLabel });
  }
  return '';
});

async function fetchPage(nextPage: number, append: boolean) {
  const result = await fetchRoutesPage({
    scope: activeScope.value,
    status: activeScope.value === 'mine' ? statusFilter.value : undefined,
    keyword: searchKeyword.value || undefined,
    sort: activeScope.value === 'plaza' ? 'hot' : 'recent',
    page: nextPage,
    pageSize,
  });
  routes.value = append ? [...routes.value, ...result.items] : result.items;
  page.value = nextPage;
  hasMore.value = result.hasMore;
  listTotal.value = result.total;
}

async function reload() {
  loading.value = true;
  loadError.value = '';
  try {
    await fetchPage(1, false);
  } catch (err) {
    loadError.value = getAppErrorMessage(err, t('routes.loadFailed'));
    routes.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    await fetchPage(page.value + 1, true);
  } catch (err) {
    loadError.value = getAppErrorMessage(err, t('routes.loadFailed'));
  } finally {
    loadingMore.value = false;
  }
}

function switchScope(scope: RouteListScope) {
  activeScope.value = scope;
}

function applySearchNow() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  const next = searchInput.value.trim();
  if (next === searchKeyword.value) return;
  searchKeyword.value = next;
  void reload();
}

function clearSearch() {
  searchInput.value = '';
  if (!searchKeyword.value) return;
  searchKeyword.value = '';
  void reload();
}

function goPlan() {
  router.push({ name: 'plan' });
}

watch([activeScope, statusFilter], () => {
  void reload();
});

watch(searchInput, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const next = value.trim();
    if (next === searchKeyword.value) return;
    searchKeyword.value = next;
    void reload();
  }, 300);
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
});

onMounted(() => {
  const legacyId = vueRoute.query.id;
  if (typeof legacyId === 'string' && legacyId) {
    router.replace({ name: 'route-detail', params: { id: legacyId } });
    return;
  }
  void reload();
});
</script>
