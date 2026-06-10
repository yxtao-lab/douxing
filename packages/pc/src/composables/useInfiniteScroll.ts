import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

export interface UseInfiniteScrollOptions {
  hasMore: Ref<boolean>;
  loading: Ref<boolean>;
  loadingMore: Ref<boolean>;
  onLoadMore: () => void | Promise<void>;
  /** 距视口底部多远时提前触发加载，默认 480px */
  rootMargin?: string;
}

/**
 * 基于 IntersectionObserver 的触底自动加载，带 rootMargin 缓冲实现无感分页。
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const sentinelRef = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  async function tryLoadMore() {
    if (!options.hasMore.value || options.loading.value || options.loadingMore.value) return;
    await options.onLoadMore();
  }

  function setupObserver(el: HTMLElement | null) {
    observer?.disconnect();
    observer = null;
    if (!el) return;

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void tryLoadMore();
        }
      },
      { root: null, rootMargin: options.rootMargin ?? '480px 0px', threshold: 0 },
    );
    observer.observe(el);
  }

  watch(sentinelRef, (el) => {
    setupObserver(el);
  });

  onMounted(() => {
    setupObserver(sentinelRef.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return { sentinelRef };
}
