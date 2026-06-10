<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      @click="close"
    >
      <button
        v-if="canPrev"
        type="button"
        class="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur transition hover:bg-white/25"
        :aria-label="t('photoPreview.prev')"
        @click.stop="prev"
      >
        ‹
      </button>

      <div class="flex max-h-[90vh] max-w-full flex-col items-center" @click.stop>
        <img
          :src="currentUrl"
          alt=""
          class="max-h-[80vh] max-w-[min(100%,960px)] rounded-xl object-contain"
        />
        <p v-if="urls.length > 1" class="mt-3 text-sm text-white/80">
          {{ t('photoPreview.counter', { current: currentIndex + 1, total: urls.length }) }}
        </p>
      </div>

      <button
        v-if="canNext"
        type="button"
        class="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur transition hover:bg-white/25"
        :aria-label="t('photoPreview.next')"
        @click.stop="next"
      >
        ›
      </button>

      <button
        type="button"
        class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white backdrop-blur hover:bg-white/25"
        :aria-label="t('common.cancel')"
        @click.stop="close"
      >
        ×
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useLocale } from '@/i18n/useLocale';

const props = defineProps<{
  open: boolean;
  urls: string[];
  initialIndex?: number;
}>();

const emit = defineEmits<{
  close: [];
  'update:initialIndex': [index: number];
}>();

const { t } = useLocale();

const currentIndex = computed(() => {
  const max = Math.max(0, props.urls.length - 1);
  const idx = props.initialIndex ?? 0;
  return Math.min(Math.max(0, idx), max);
});

const currentUrl = computed(() => props.urls[currentIndex.value] ?? '');
const canPrev = computed(() => props.urls.length > 1 && currentIndex.value > 0);
const canNext = computed(() => props.urls.length > 1 && currentIndex.value < props.urls.length - 1);

function close() {
  emit('close');
}

function prev() {
  if (!canPrev.value) return;
  emit('update:initialIndex', currentIndex.value - 1);
}

function next() {
  if (!canNext.value) return;
  emit('update:initialIndex', currentIndex.value + 1);
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    prev();
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    next();
  }
}

watch(
  () => props.open,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
