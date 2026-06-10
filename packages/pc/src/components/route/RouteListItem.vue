<template>
  <RouterLink
    :to="{ name: 'route-detail', params: { id: route.id } }"
    class="group block overflow-hidden rounded-2xl border border-dx-border bg-white shadow-card transition hover:-translate-y-0.5 hover:border-dx-primary/40 hover:shadow-md"
  >
    <div class="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-dx-primary-light to-white">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt=""
        class="h-full w-full object-cover transition group-hover:scale-105"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-3xl">🗺️</div>
    </div>
    <div class="p-5">
    <div class="mb-2 flex items-start justify-between gap-2">
      <h3 class="line-clamp-2 flex-1 text-base font-semibold text-dx-text group-hover:text-dx-primary">
        {{ route.name }}
      </h3>
      <span
        v-if="route.isAiGenerated"
        class="shrink-0 rounded-full bg-dx-primary-light px-2 py-0.5 text-xs font-medium text-dx-primary"
      >
        AI
      </span>
    </div>

    <p class="mb-1 text-sm text-dx-muted">{{ metaLine }}</p>
    <p v-if="route.creatorNickname && showAuthor" class="mb-1 text-xs text-dx-muted">
      @{{ route.creatorNickname }}
    </p>
    <p class="mb-3 line-clamp-2 text-sm text-dx-muted">
      {{ route.description || t('routes.noDescription') }}
    </p>

    <div class="mb-3 flex flex-wrap gap-3 text-xs text-dx-muted">
      <span>👁 {{ route.viewCount ?? 0 }}</span>
      <span>♥ {{ route.likeCount ?? 0 }}</span>
      <span>★ {{ route.collectCount ?? 0 }}</span>
      <span>💬 {{ route.commentCount ?? 0 }}</span>
    </div>

    <div class="flex items-center justify-between text-sm">
      <span class="text-dx-muted">{{ statusLabel }}</span>
      <span class="font-medium text-dx-primary">{{ t('routes.viewDetail') }}</span>
    </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';
import { getRouteCardCoverUrl } from '@/utils/route-cover';

const props = defineProps<{
  route: TravelRouteInfo;
  showAuthor?: boolean;
}>();

const { t } = useLocale();

const coverUrl = computed(() => getRouteCardCoverUrl(props.route));

const metaLine = computed(() =>
  t('routes.cardMeta', {
    days: props.route.days,
    budget: props.route.budgetRange || t('routes.budgetTbd'),
  }),
);

const statusLabel = computed(() => {
  if (props.route.isPublic) return t('routes.statusPublicShare');
  if (props.route.status === RouteStatus.PUBLISHED) return t('routes.statusPublished');
  if (props.route.status === RouteStatus.ARCHIVED) return t('routes.statusArchived');
  return t('routes.statusDraft');
});
</script>
