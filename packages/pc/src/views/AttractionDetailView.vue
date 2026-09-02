<template>
  <SubPageShell
    :title="detail?.name || t('nav.attractionDetail')"
    :back-to="backTarget"
    :back-label="backLabel"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="error" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ error }}</p>
      <button type="button" class="dx-btn-secondary" @click="loadDetail">{{ t('common.refresh') }}</button>
    </div>
    <div v-else-if="detail" class="overflow-hidden rounded-2xl border border-dx-border bg-white shadow-card">
      <div class="relative aspect-[21/9] max-h-72 overflow-hidden bg-gradient-to-br from-dx-primary-light to-white">
        <img
          v-if="detail.coverImageUrl"
          :src="detail.coverImageUrl"
          alt=""
          class="h-full w-full object-cover"
        />
        <div v-else class="flex h-full w-full items-center justify-center text-5xl">📍</div>
      </div>
      <div class="space-y-5 p-6">
        <div>
          <h1 class="text-2xl font-semibold text-dx-text">{{ detail.name }}</h1>
          <p class="mt-1 text-sm text-dx-muted">{{ detail.city }}</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-dx-bg px-4 py-3">
            <p class="text-xs text-dx-muted">{{ t('attractions.ticketLabel') }}</p>
            <p class="mt-1 text-sm font-semibold text-dx-text">{{ ticketText }}</p>
          </div>
          <div class="rounded-xl bg-dx-bg px-4 py-3">
            <p class="text-xs text-dx-muted">{{ t('attractions.openHoursLabel') }}</p>
            <p class="mt-1 text-sm font-semibold text-dx-text">{{ openHoursText }}</p>
          </div>
        </div>
        <div>
          <h2 class="mb-2 text-sm font-semibold text-dx-text">{{ t('attractions.descriptionLabel') }}</h2>
          <p class="text-sm leading-relaxed text-dx-muted">
            {{ detail.description || t('attractions.descriptionEmpty') }}
          </p>
        </div>
        <div v-if="displayTags.length > 0">
          <h2 class="mb-2 text-sm font-semibold text-dx-text">{{ t('attractions.tagsLabel') }}</h2>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in displayTags"
              :key="tag"
              class="rounded-full bg-dx-primary-light px-2.5 py-0.5 text-xs text-dx-primary"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <a
          v-if="mapUrl"
          :href="mapUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="dx-btn-primary inline-flex"
        >
          {{ t('attractions.openMap') }}
        </a>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { AttractionInfo } from '@douxing/shared';
import { fetchAttractionDetail } from '@/api/attractions';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const route = useRoute();
const { t } = useLocale();

const loading = ref(false);
const error = ref('');
const detail = ref<AttractionInfo | null>(null);

const attractionId = computed(() => {
  const raw = Number(route.params.id);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
});

const sceneSlug = computed(() => {
  const raw = route.query.fromScene;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
});

const backTarget = computed(() =>
  sceneSlug.value
    ? { name: 'scene-detail' as const, params: { slug: sceneSlug.value } }
    : { name: 'home' as const },
);

const backLabel = computed(() =>
  sceneSlug.value ? t('scenes.pageTitle') : t('pc.nav.home'),
);

const ticketText = computed(() => {
  const price = detail.value?.ticketPrice ?? 0;
  if (price <= 0) return t('attractions.freeTicket');
  return t('attractions.ticketValue', { price });
});

const openHoursText = computed(() => {
  const windows = detail.value?.openHours?.windows ?? [];
  if (windows.length === 0) return t('attractions.openHoursAllDay');
  return windows.map((w) => `${w.open}-${w.close}`).join(' · ');
});

const displayTags = computed(() => (detail.value?.tags ?? []).slice(0, 12));

const mapUrl = computed(() => {
  const d = detail.value;
  if (!d || d.latitude == null || d.longitude == null) return '';
  return `https://uri.amap.com/marker?position=${d.longitude},${d.latitude}&name=${encodeURIComponent(d.name)}`;
});

/**
 * 拉取景点详情。
 *
 * @returns void
 */
async function loadDetail() {
  if (!attractionId.value) {
    error.value = t('attractions.loadFailed');
    detail.value = null;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    detail.value = await fetchAttractionDetail(attractionId.value);
  } catch (e) {
    detail.value = null;
    error.value = getAppErrorMessage(e, t('attractions.loadFailed'));
  } finally {
    loading.value = false;
  }
}

watch(
  attractionId,
  () => {
    void loadDetail();
  },
  { immediate: true },
);
</script>
