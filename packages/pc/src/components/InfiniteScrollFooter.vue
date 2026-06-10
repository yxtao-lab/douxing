<template>
  <div ref="sentinelRef" class="py-6 text-center text-sm text-dx-muted">
    <span v-if="loadingMore">{{ t('common.loadMore') }}</span>
    <span v-else-if="!hasMore && showNoMore">{{ t('common.noMore') }}</span>
    <span v-else aria-hidden="true">&nbsp;</span>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import { useLocale } from '@/i18n/useLocale';

const props = withDefaults(
  defineProps<{
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
    showNoMore?: boolean;
    onLoadMore: () => void | Promise<void>;
  }>(),
  { showNoMore: true },
);

const { t } = useLocale();

const { sentinelRef } = useInfiniteScroll({
  hasMore: toRef(props, 'hasMore'),
  loading: toRef(props, 'loading'),
  loadingMore: toRef(props, 'loadingMore'),
  onLoadMore: () => props.onLoadMore(),
});
</script>
