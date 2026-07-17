<template>
  <div>
    <section class="bg-dx-hero px-4 py-12 text-white lg:py-16">
      <div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <div class="mb-6 flex items-center gap-4">
            <AppLogo size="lg" class="rounded-2xl ring-2 ring-white/25" />
            <div>
              <h1 class="text-3xl font-bold">{{ t('app.name') }}</h1>
              <p class="text-white/85">{{ t('home.subtitle') }}</p>
            </div>
          </div>
          <p class="mb-4 text-2xl font-semibold leading-snug lg:text-3xl">{{ t('home.tagline') }}</p>
          <p class="mb-6 text-white/80">{{ t('pc.layout.slogan') }}</p>
          <div class="mb-8 flex flex-wrap gap-2">
            <span
              v-for="item in valueProps"
              :key="item"
              class="rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur"
            >
              {{ item }}
            </span>
          </div>
          <button type="button" class="dx-btn-primary !bg-white !text-dx-primary hover:!bg-white/90" @click="goPlan">
            {{ t('home.ctaPlan') }}
          </button>
          <div v-if="userStore.user" class="mt-6 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <p class="font-medium">{{ welcomeText }}</p>
            <p class="text-sm text-white/80">{{ t('home.welcomeSub') }}</p>
          </div>
          <div v-else class="mt-6 flex items-center gap-3 text-sm">
            <span class="text-white/80">{{ t('home.hotRoutesGuestHint') }}</span>
            <button type="button" class="font-medium underline" @click="goLogin">
              {{ t('home.ctaLogin') }}
            </button>
          </div>
        </div>

        <div class="hidden lg:grid lg:grid-cols-3 lg:gap-4">
          <button
            v-for="action in quickActions"
            :key="action.labelKey"
            type="button"
            class="rounded-2xl bg-white/10 p-5 text-left backdrop-blur transition hover:bg-white/20"
            @click="action.onClick"
          >
            <span class="text-3xl">{{ action.emoji }}</span>
            <p class="mt-3 font-medium">{{ t(action.labelKey) }}</p>
          </button>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h2 class="text-xl font-semibold text-dx-text">{{ t('home.sceneExploreTitle') }}</h2>
          <p class="mt-1 text-sm text-dx-muted">{{ t('home.sceneExploreHint') }}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="slug in sceneTagSlugs"
          :key="slug"
          :to="{ name: 'scene-detail', params: { slug } }"
          class="inline-flex items-center gap-2 rounded-full border border-dx-border bg-white px-4 py-2 text-sm font-medium text-dx-text shadow-sm transition hover:border-dx-primary hover:text-dx-primary"
        >
          <span class="text-lg">{{ sceneEmoji(slug) }}</span>
          <span>{{ sceneLabel(slug) }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div class="mb-6 flex items-end justify-between">
        <h2 class="text-xl font-semibold text-dx-text">{{ t('home.hotRoutesTitle') }}</h2>
        <button
          v-if="userStore.user && hotRoutes.length > 0"
          type="button"
          class="text-sm text-dx-primary hover:underline"
          @click="goRoutes"
        >
          {{ t('home.hotRoutesMore') }}
        </button>
      </div>

      <div v-if="!userStore.user" class="dx-card text-center">
        <p class="mb-4 text-dx-muted">{{ t('home.hotRoutesGuestHint') }}</p>
        <button type="button" class="dx-btn-primary" @click="goLogin">{{ t('home.ctaLogin') }}</button>
      </div>

      <div v-else-if="hotLoading" class="dx-card text-center text-dx-muted">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="hotError" class="dx-card text-center">
        <p class="mb-4 text-red-600">{{ hotError }}</p>
        <button type="button" class="dx-btn-secondary" @click="loadHotRoutes">{{ t('common.refresh') }}</button>
      </div>

      <div v-else-if="hotRoutes.length === 0" class="dx-card text-center">
        <p class="mb-4 text-dx-muted">{{ t('home.hotRoutesEmpty') }}</p>
        <button type="button" class="dx-btn-primary" @click="goPlan">{{ t('home.ctaPlan') }}</button>
      </div>

      <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <RouteCard v-for="route in hotRoutes" :key="route.id" :route="route" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { TravelRouteInfo, SceneTagSlug } from '@douxing/shared';
import { sceneTagPresets, formatSceneTagLabel } from '@douxing/shared';
import { needsOnboarding } from '@douxing/shared';
import { fetchUserProfile } from '@/api/user';
import { fetchPlazaRoutesPage } from '@/api/routes';
import AppLogo from '@/components/AppLogo.vue';
import RouteCard from '@/components/RouteCard.vue';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale } = useLocale();

const sceneTagSlugs = sceneTagPresets as SceneTagSlug[];

const SCENE_EMOJI: Record<SceneTagSlug, string> = {
  kids: '👨‍👩‍👧',
  date: '💑',
  water: '💦',
  cool: '🍃',
  flower: '🌸',
  night: '🌃',
  'summer-escape': '🏔️',
  spring: '🌱',
  blessing: '🏮',
  camping: '⛺',
};

function sceneLabel(slug: SceneTagSlug) {
  return formatSceneTagLabel(slug, (currentLocale.value ?? 'zh-CN') as 'zh-CN' | 'en-US');
}

function sceneEmoji(slug: SceneTagSlug) {
  return SCENE_EMOJI[slug] ?? '✨';
}

const hotRoutes = ref<TravelRouteInfo[]>([]);
const hotLoading = ref(false);
const hotError = ref('');

const valueProps = computed(() => [
  t('home.valueProp1'),
  t('home.valueProp2'),
  t('home.valueProp3'),
]);

const welcomeText = computed(() => {
  const name = userStore.user?.nickname || userStore.user?.username || '';
  return t('home.welcome', { name });
});

const quickActions = computed(() => [
  { emoji: '✨', labelKey: 'home.quickPlan', onClick: goPlan },
  { emoji: '🗺️', labelKey: 'home.quickRoutes', onClick: goRoutes },
  { emoji: '🏅', labelKey: 'home.quickProfile', onClick: goProfile },
]);

function goPlan() {
  router.push({ name: 'plan' });
}

function goRoutes() {
  router.push({ name: 'routes' });
}

function goProfile() {
  router.push({ name: 'profile' });
}

function goLogin() {
  router.push({ name: 'login' });
}

async function loadHotRoutes() {
  if (!userStore.user) return;
  hotLoading.value = true;
  hotError.value = '';
  try {
    const result = await fetchPlazaRoutesPage(1, 6, 'hot');
    hotRoutes.value = result.items;
  } catch (err) {
    hotError.value = getAppErrorMessage(err, t('home.hotRoutesLoadFailed'));
  } finally {
    hotLoading.value = false;
  }
}

onMounted(async () => {
  if (userStore.user && needsOnboarding(userStore.user.onboardedAt)) {
    router.replace({ name: 'onboarding' });
    return;
  }
  if (userStore.user) {
    try {
      const fresh = await fetchUserProfile();
      if (userStore.token) userStore.setAuth(userStore.token, fresh);
      if (needsOnboarding(fresh.onboardedAt)) {
        router.replace({ name: 'onboarding' });
        return;
      }
    } catch {
      /* 忽略刷新失败 */
    }
    loadHotRoutes();
  }
});
</script>
