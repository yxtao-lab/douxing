<template>
  <RouterLink
    :to="{ name: 'route-detail', params: { id: route.id } }"
    class="group flex flex-col overflow-hidden rounded-2xl border border-dx-border bg-white shadow-card transition hover:-translate-y-0.5 hover:border-dx-primary/40 hover:shadow-md"
  >
    <div class="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-dx-primary-light to-white">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt=""
        class="h-full w-full object-cover transition group-hover:scale-105"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-4xl"
      >
        🗺️
      </div>
    </div>
    <div class="flex flex-1 flex-col gap-2 p-4">
      <h3 class="line-clamp-2 text-base font-semibold text-dx-text group-hover:text-dx-primary">
        {{ route.name }}
      </h3>
      <p v-if="route.description" class="line-clamp-2 text-sm text-dx-muted">
        {{ route.description }}
      </p>
      <div class="mt-auto flex flex-wrap gap-2 text-xs text-dx-muted">
        <span v-if="route.days">{{ t('pc.route.days', { count: route.days }) }}</span>
        <span v-if="route.likeCount != null">❤️ {{ route.likeCount }}</span>
        <span v-if="route.viewCount != null">👁 {{ route.viewCount }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';
import { getRouteCardCoverUrl } from '@/utils/route-cover';

const props = defineProps<{
  route: TravelRouteInfo;
}>();

const { t } = useLocale();

const coverUrl = computed(() => getRouteCardCoverUrl(props.route));
</script>
