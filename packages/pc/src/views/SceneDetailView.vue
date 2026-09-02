<template>
  <SubPageShell :title="sceneLabel" :back-to="{ name: 'home' }" :back-label="t('scenes.pageTitle')">
    <div v-if="loading" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="error" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ error }}</p>
      <button type="button" class="dx-btn-secondary" @click="loadDetail">{{ t('common.refresh') }}</button>
    </div>
    <template v-else>
      <section class="mb-6 rounded-2xl border border-dx-border bg-white p-5 shadow-card">
        <div class="mb-3 flex items-center gap-2">
          <h2 class="text-lg font-semibold text-dx-text">{{ t('scenes.attractionsTitle') }}</h2>
          <span
            v-if="attractions.length > 0"
            class="rounded-md bg-dx-primary-light px-2 py-0.5 text-[11px] font-semibold text-dx-primary"
          >
            {{ t('scenes.attractionsTopBadge') }}
          </span>
        </div>
        <p v-if="attractions.length === 0" class="text-sm text-dx-muted">
          {{ t('scenes.attractionsEmpty') }}
        </p>
        <div v-else class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          <button
            v-for="item in attractions"
            :key="item.id"
            type="button"
            class="w-36 shrink-0 text-left transition hover:opacity-90"
            @click="goAttraction(item.id)"
          >
            <div class="aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-dx-primary-light to-white">
              <img
                v-if="item.coverImageUrl"
                :src="item.coverImageUrl ?? ''"
                alt=""
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-2xl">📍</div>
            </div>
            <p class="mt-2 truncate text-sm font-medium text-dx-text">{{ item.name }}</p>
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-dx-border bg-white p-5 shadow-card">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-dx-text">{{ t('scenes.routesTitle') }}</h2>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-dx-primary hover:underline"
            @click="goCustomPlan"
          >
            {{ t('scenes.planCustomRoute') }}
          </button>
        </div>
        <div
          v-if="routes.length === 0"
          class="rounded-2xl border border-dashed border-dx-border bg-dx-bg px-6 py-8 text-center"
        >
          <p class="text-sm font-medium text-dx-text">{{ t('scenes.routesEmpty') }}</p>
          <p class="mt-2 text-xs leading-relaxed text-dx-muted">{{ t('scenes.routesEmptyDesc') }}</p>
          <button type="button" class="dx-btn-primary mt-5" @click="goCustomPlan">
            {{ t('scenes.planCustomRoute') }}
          </button>
        </div>
        <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <RouteCard v-for="item in routes" :key="item.id" :route="item" />
        </div>
      </section>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AttractionInfo, TravelRouteInfo, SceneTagSlug } from '@douxing/shared';
import { buildSceneCustomPlanPrompt, formatSceneTagLabel, isSceneTagSlug } from '@douxing/shared';
import { fetchSceneDetail } from '@/api/scenes';
import SubPageShell from '@/components/SubPageShell.vue';
import RouteCard from '@/components/RouteCard.vue';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';

const route = useRoute();
const router = useRouter();
const { t, currentLocale } = useLocale();
const userStore = useUserStore();

const slug = ref<SceneTagSlug>('kids');
const attractions = ref<AttractionInfo[]>([]);
const routes = ref<TravelRouteInfo[]>([]);
const loading = ref(false);
const error = ref('');

const sceneLabel = computed(() => formatSceneTagLabel(slug.value, currentLocale.value));

/**
 * 解析路由参数中的场景 slug。
 *
 * @returns void
 */
function resolveSlug() {
  const raw = String(route.params.slug ?? 'kids');
  slug.value = isSceneTagSlug(raw) ? raw : 'kids';
}

/**
 * 拉取场景专题景点与公开路线。
 *
 * @returns void
 */
async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchSceneDetail(slug.value, { attractionLimit: 10, pageSize: 12 });
    attractions.value = data.attractions ?? [];
    routes.value = data.routes?.items ?? [];
  } catch (e) {
    attractions.value = [];
    routes.value = [];
    error.value = getAppErrorMessage(e, t('scenes.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 进入景点详情；带回场景 slug 便于返回专题页。
 *
 * @param id - 景点 ID
 * @returns void
 */
function goAttraction(id: number) {
  router.push({
    name: 'attraction-detail',
    params: { id: String(id) },
    query: { fromScene: slug.value },
  });
}

/**
 * 跳转规划页：场景 + 用户画像定制 prompt，并带上显式 sceneTags 保证专题归属。
 *
 * @returns void
 */
function goCustomPlan() {
  if (!userStore.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  const user = userStore.user;
  const prompt = buildSceneCustomPlanPrompt(
    slug.value,
    {
      interestTags: user.interestTags,
      preferredScenes: user.preferredScenes,
      ageRange: user.ageRange,
      travelRadius: user.travelRadius,
      companionStructure: user.companionStructure,
      budgetTier: user.budgetTier,
    },
    currentLocale.value,
  );
  router.push({
    name: 'plan',
    query: {
      prompt,
      autoSend: '1',
      fresh: '1',
      sceneTags: slug.value,
    },
  });
}

resolveSlug();
void loadDetail();

watch(
  () => route.params.slug,
  () => {
    resolveSlug();
    void loadDetail();
  },
);
</script>
