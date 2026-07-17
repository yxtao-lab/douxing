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
      <section class="mb-10">
        <h2 class="mb-4 text-lg font-semibold text-dx-text">{{ t('scenes.attractionsTitle') }}</h2>
        <p v-if="attractions.length === 0" class="text-sm text-dx-muted">
          {{ t('scenes.attractionsEmpty') }}
        </p>
        <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in attractions"
            :key="item.id"
            class="flex flex-col overflow-hidden rounded-2xl border border-dx-border bg-white shadow-card"
          >
            <div class="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-dx-primary-light to-white">
              <img
                v-if="item.coverImageUrl"
                :src="item.coverImageUrl ?? ''"
                alt=""
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-4xl">📍</div>
            </div>
            <div class="flex flex-1 flex-col gap-2 p-4">
              <h3 class="line-clamp-2 text-base font-semibold text-dx-text">{{ item.name }}</h3>
              <p class="text-xs text-dx-muted">{{ item.city }}</p>
              <div v-if="(item.sceneTags ?? []).length > 0" class="mt-auto flex flex-wrap gap-1.5">
                <span
                  v-for="slug in item.sceneTags"
                  :key="slug"
                  class="rounded-full bg-dx-primary-light px-2 py-0.5 text-xs text-dx-primary"
                >
                  {{ formatSceneTagLabel(slug, currentLocale) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-4 text-lg font-semibold text-dx-text">{{ t('scenes.routesTitle') }}</h2>
        <p v-if="routes.length === 0" class="text-sm text-dx-muted">
          {{ t('scenes.routesEmpty') }}
        </p>
        <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <RouteCard v-for="route in routes" :key="route.id" :route="route" />
        </div>
      </section>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { AttractionInfo, TravelRouteInfo, SceneTagSlug } from '@douxing/shared';
import { formatSceneTagLabel, isSceneTagSlug } from '@douxing/shared';
import { fetchSceneDetail } from '@/api/scenes';
import SubPageShell from '@/components/SubPageShell.vue';
import RouteCard from '@/components/RouteCard.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const route = useRoute();
const { t, currentLocale } = useLocale();

const slug = ref<SceneTagSlug>('kids');
const attractions = ref<AttractionInfo[]>([]);
const routes = ref<TravelRouteInfo[]>([]);
const loading = ref(false);
const error = ref('');

const sceneLabel = computed(() => formatSceneTagLabel(slug.value, currentLocale.value));

function resolveSlug() {
  const raw = String(route.params.slug ?? 'kids');
  slug.value = isSceneTagSlug(raw) ? raw : 'kids';
}

async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchSceneDetail(slug.value, { attractionLimit: 12, pageSize: 12 });
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
