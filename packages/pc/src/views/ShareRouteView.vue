<template>
  <div class="min-h-screen bg-dx-bg">
    <header class="border-b border-dx-border bg-white px-4 py-4">
      <div class="mx-auto flex max-w-3xl items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold text-dx-text">
          <AppLogo size="sm" />
          {{ t('app.name') }}
        </RouterLink>
        <RouterLink to="/login" class="text-sm text-dx-primary hover:underline">{{ t('common.login') }}</RouterLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('shareRoute.loading') }}</div>
      <div v-else-if="error" class="dx-card text-center text-red-600">{{ error }}</div>
      <template v-else-if="route">
        <section class="mb-6 overflow-hidden rounded-2xl bg-dx-hero text-white shadow-hero">
          <div class="p-6">
            <span class="mb-3 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs">{{ t('shareRoute.badge') }}</span>
            <h1 class="text-2xl font-bold">{{ route.name }}</h1>
            <p class="mt-2 text-sm text-white/85">{{ heroMeta }}</p>
            <p v-if="route.description" class="mt-3 text-white/90">{{ route.description }}</p>
            <p v-if="route.creatorNickname" class="mt-2 text-sm text-white/75">
              {{ t('routes.authorShare', { name: route.creatorNickname }) }}
            </p>
            <button
              v-if="routeVideo"
              type="button"
              class="mt-4 rounded-full bg-white/20 px-4 py-2 text-sm hover:bg-white/30"
              @click="openRouteVideo"
            >
              ▶ {{ t('routes.playRouteVideo') }}
            </button>
          </div>
        </section>

        <section class="dx-card mb-6">
          <h2 class="mb-4 font-semibold">{{ t('shareRoute.highlights') }}</h2>
          <div v-for="(day, index) in previewDays" :key="index" class="mb-5 last:mb-0">
            <h3 class="mb-2 text-sm font-medium text-dx-primary">{{ dayTitle(day, index) }}</h3>
            <div v-for="(spot, spotIndex) in day.attractions.slice(0, 3)" :key="spotIndex" class="mb-3 flex gap-3">
              <img
                v-if="spot.coverImageUrl"
                :src="spot.coverImageUrl"
                alt=""
                class="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div>
                <p class="font-medium">{{ spot.name }}</p>
                <p v-if="spot.time" class="text-xs text-dx-muted">{{ spot.time }}</p>
              </div>
            </div>
          </div>
          <p v-if="hiddenDayCount > 0" class="text-sm text-dx-muted">
            {{ t('shareRoute.moreDays', { count: hiddenDayCount }) }}
          </p>
        </section>

        <section class="dx-card text-center">
          <h2 class="mb-2 font-semibold">{{ t('shareRoute.ctaTitle') }}</h2>
          <p class="mb-4 text-sm text-dx-muted">{{ t('shareRoute.ctaDesc') }}</p>
          <RouterLink :to="{ name: 'route-detail', params: { id: routeId } }" class="dx-btn-primary">
            {{ t('shareRoute.openApp') }}
          </RouterLink>
        </section>
      </template>
    </main>

    <RouteMediaPlayerSheet
      :visible="mediaPlayerVisible"
      :video-url="mediaPlayerUrl"
      :cover-url="mediaPlayerCover"
      :title="mediaPlayerTitle"
      @close="mediaPlayerVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { RouteDayPlan, RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import { fetchSharedRoute } from '@/api/share';
import RouteMediaPlayerSheet from '@/components/route/RouteMediaPlayerSheet.vue';
import AppLogo from '@/components/AppLogo.vue';
import { useInterestTagLabels } from '@/composables/useInterestTagLabels';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const vueRoute = useRoute();
const { t } = useLocale();
const { joinLabels } = useInterestTagLabels();

const route = ref<TravelRouteInfo | null>(null);
const loading = ref(true);
const error = ref('');
const mediaPlayerVisible = ref(false);
const mediaPlayerUrl = ref('');
const mediaPlayerCover = ref<string | null>(null);
const mediaPlayerTitle = ref('');

const routeId = computed(() => Number(vueRoute.params.id));

const heroMeta = computed(() => {
  if (!route.value) return '';
  return t('routes.metaHero', {
    days: route.value.days,
    budget: route.value.budgetRange ?? t('routes.budgetTbd'),
    tags: joinLabels.value(route.value.interestTags),
  });
});

const previewDays = computed((): RouteDayPlan[] => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return (detail?.days ?? []).slice(0, 4);
});

const routeVideo = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return detail?.routeVideo ?? null;
});

/**
 * 打开分享页路线视频播放器。
 */
function openRouteVideo() {
  const video = routeVideo.value;
  if (!video?.videoUrl) return;
  mediaPlayerUrl.value = video.videoUrl;
  mediaPlayerCover.value = video.coverUrl ?? null;
  mediaPlayerTitle.value = route.value?.name ?? '';
  mediaPlayerVisible.value = true;
}

const hiddenDayCount = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return Math.max(0, (detail?.days?.length ?? 0) - 4);
});

function dayTitle(day: RouteDayPlan, index: number) {
  if (day.title?.trim()) return day.title;
  return t('routes.flowDayTab', { day: index + 1 });
}

onMounted(async () => {
  if (!routeId.value) {
    error.value = t('shareRoute.invalidLink');
    loading.value = false;
    return;
  }
  try {
    route.value = await fetchSharedRoute(routeId.value);
  } catch (err) {
    error.value = getAppErrorMessage(err, t('shareRoute.loadFailed'));
  } finally {
    loading.value = false;
  }
});
</script>
