import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue';

export function useElementHeight() {
  const elementRef = shallowRef<HTMLElement>();
  const height = ref(0);

  let resizeObserver: ResizeObserver | null = null;

  function updateHeight() {
    height.value = elementRef.value?.clientHeight ?? 0;
  }

  onMounted(async () => {
    await nextTick();
    if (!elementRef.value) return;

    resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(elementRef.value);
    updateHeight();
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
  });

  return {
    elementRef,
    height,
    updateHeight,
  };
}
