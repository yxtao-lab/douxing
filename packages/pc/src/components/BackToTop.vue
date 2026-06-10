<template>
  <Transition name="back-to-top">
    <button
      v-if="visible"
      type="button"
      class="fixed bottom-8 right-8 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-dx-primary text-white shadow-lg transition hover:bg-dx-primary/90 focus:outline-none focus:ring-2 focus:ring-dx-primary/50"
      :aria-label="t('common.backToTop')"
      :title="t('common.backToTop')"
      @click="scrollToTop"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path
          fill-rule="evenodd"
          d="M11.47 7.72a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 11-1.06-1.06l7.5-7.5z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '@/i18n/useLocale';

const SCROLL_THRESHOLD = 320;

const { t } = useLocale();
const visible = ref(false);

function onScroll() {
  visible.value = window.scrollY > SCROLL_THRESHOLD;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<style scoped>
.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
