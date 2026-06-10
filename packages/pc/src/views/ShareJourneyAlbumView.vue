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
      <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('shareJourneyAlbum.loading') }}</div>
      <div v-else-if="error" class="dx-card text-center text-red-600">{{ error }}</div>
      <template v-else-if="payload">
        <section class="mb-6 overflow-hidden rounded-2xl bg-dx-hero text-white shadow-hero">
          <div class="p-6">
            <span class="mb-3 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs">
              {{ t('shareJourneyAlbum.badge') }}
            </span>
            <h1 class="text-2xl font-bold">{{ payload.title }}</h1>
            <p v-if="payload.routeName" class="mt-2 text-sm text-white/85">{{ payload.routeName }}</p>
            <p class="mt-2 text-sm text-white/75">
              {{ t('shareJourneyAlbum.photoCount', { count: payload.photoCount }) }}
            </p>
          </div>
          <img
            v-if="payload.coverPhotoUrl"
            :src="payload.coverPhotoUrl"
            alt=""
            class="h-48 w-full object-cover"
          />
        </section>

        <section
          v-for="group in displayGroups"
          :key="groupKey(group)"
          class="dx-card mb-4"
        >
          <h2 class="mb-3 text-sm font-semibold text-dx-primary">{{ groupTitle(group) }}</h2>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <img
              v-for="photo in group.photos"
              :key="photo.id"
              :src="photo.storedUrl"
              alt=""
              class="aspect-square rounded-lg object-cover bg-dx-border"
            />
          </div>
        </section>

        <section v-if="payload.photoCount === 0" class="dx-card text-center text-dx-muted">
          {{ t('shareJourneyAlbum.empty') }}
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { JourneyAlbumPhotoGroup } from '@douxing/shared';
import { fetchSharedJourneyAlbum } from '@/api/journey-albums';
import AppLogo from '@/components/AppLogo.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const vueRoute = useRoute();
const { t } = useLocale();

const payload = ref<Awaited<ReturnType<typeof fetchSharedJourneyAlbum>> | null>(null);
const loading = ref(true);
const error = ref('');

const shareToken = computed(() => String(vueRoute.params.token ?? '').trim());

const displayGroups = computed(() => {
  if (!payload.value) return [];
  return payload.value.groups.filter(
    (group) => group.photos.length > 0 && (group.dayIndex != null || Boolean(group.poiName?.trim())),
  );
});

function groupKey(group: JourneyAlbumPhotoGroup) {
  return `${group.dayIndex ?? 'null'}::${group.poiName ?? 'null'}::${group.attractionId ?? 'null'}`;
}

function groupTitle(group: JourneyAlbumPhotoGroup) {
  if (group.dayIndex != null && group.poiName) {
    return t('journeyAlbum.groupDayPoi', { day: group.dayIndex + 1, poi: group.poiName });
  }
  if (group.dayIndex != null) {
    return t('journeyAlbum.groupDayOnly', { day: group.dayIndex + 1 });
  }
  return group.poiName ?? t('journeyAlbum.unassigned');
}

onMounted(async () => {
  if (!shareToken.value) {
    error.value = t('shareJourneyAlbum.empty');
    loading.value = false;
    return;
  }
  try {
    payload.value = await fetchSharedJourneyAlbum(shareToken.value);
    if (!payload.value) {
      error.value = t('shareJourneyAlbum.empty');
    }
  } catch (err) {
    error.value = getAppErrorMessage(err, t('shareJourneyAlbum.empty'));
  } finally {
    loading.value = false;
  }
});
</script>
