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
        <button type="button" class="dx-btn-primary" @click="goPlan">{{ t('routes.goPlan') }}</button>
        <button
          v-if="activeScope === 'mine' && statusFilter !== undefined"
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

    <div v-if="routes.length > 0" class="mt-8 text-center">
      <button
        v-if="hasMore"
        type="button"
        class="dx-btn-secondary"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? t('common.loading') : t('common.loadMore') }}
      </button>
      <p v-else class="text-sm text-dx-muted">{{ t('common.noMore') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { RouteListScope, TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchRoutesPage } from '@/api/routes';
import RouteListItem from '@/components/route/RouteListItem.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const vueRoute = useRoute();
const { t } = useLocale();

const activeScope = ref<RouteListScope>('mine');
const statusFilter = ref<number | undefined>(undefined);
const routes = ref<TravelRouteInfo[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref('');

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
  if (activeScope.value === 'plaza') return t('routes.emptyPlaza');
  if (activeScope.value === 'favorites') return t('routes.emptyFavorites');
  return t('routes.emptyMine');
});

const emptyHint = computed(() => {
  if (loadError.value) return '';
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
    sort: activeScope.value === 'plaza' ? 'hot' : 'recent',
    page: nextPage,
    pageSize,
  });
  routes.value = append ? [...routes.value, ...result.items] : result.items;
  page.value = nextPage;
  hasMore.value = result.hasMore;
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

function goPlan() {
  router.push({ name: 'plan' });
}

watch([activeScope, statusFilter], () => {
  void reload();
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
