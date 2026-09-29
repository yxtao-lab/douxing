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
      <div class="flex shrink-0 flex-wrap justify-end gap-1">
        <span
          v-if="route.isAiGenerated"
          class="rounded-full bg-dx-primary-light px-2 py-0.5 text-xs font-medium text-dx-primary"
        >
          AI
        </span>
        <span
          v-if="contentTierLabel"
          class="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-medium text-white"
        >
          {{ contentTierLabel }}
        </span>
        <span
          v-if="sourceLabel"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-dx-muted"
        >
          {{ sourceLabel }}
        </span>
        <span
          v-if="showPendingVerification"
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
        >
          {{ t('routes.pendingVerification') }}
        </span>
      </div>
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
import { isRoutePendingVerification, RouteContentTier, RouteSourceKind, RouteStatus } from '@douxing/shared';
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

const sourceLabel = computed(() => {
  switch (props.route.sourceKind) {
    case RouteSourceKind.CRAWL:
      return t('routes.sourceCrawl');
    case RouteSourceKind.AI_DRAFT:
      return t('routes.sourceAiDraft');
    case RouteSourceKind.UGC_ORIGINAL:
      return t('routes.sourceUgcOriginal');
    case RouteSourceKind.UGC_FORK:
      return t('routes.sourceUgcFork');
    default:
      return '';
  }
});

const contentTierLabel = computed(() => {
  if (props.route.contentTier === RouteContentTier.TRAVEL_READY) return t('routes.contentTravelReady');
  if (props.route.contentTier === RouteContentTier.INSPIRATION) return t('routes.contentInspiration');
  return '';
});

const showPendingVerification = computed(
  () =>
    props.route.pendingVerification === true ||
    isRoutePendingVerification(props.route.sourceKind, props.route.verificationStatus),
);

const statusLabel = computed(() => {
  if (props.route.isPublic) return t('routes.statusPublicShare');
  if (props.route.status === RouteStatus.PUBLISHED) return t('routes.statusPublished');
  if (props.route.status === RouteStatus.ARCHIVED) return t('routes.statusArchived');
  return t('routes.statusDraft');
});
</script>
