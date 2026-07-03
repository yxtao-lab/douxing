<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[1200] flex items-end bg-black/55"
      @click="handleClose"
    >
      <div
        class="w-full max-h-[72vh] rounded-t-2xl bg-gray-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        @click.stop
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <h3 class="truncate text-base font-semibold text-white">{{ displayTitle }}</h3>
          <button
            type="button"
            class="shrink-0 text-2xl leading-none text-gray-400 hover:text-white"
            @click="handleClose"
          >
            ×
          </button>
        </div>
        <video
          v-if="videoUrl"
          ref="videoRef"
          class="w-full max-h-[60vh] rounded-xl bg-black"
          :src="videoUrl"
          :poster="coverUrl || undefined"
          controls
          playsinline
          @error="handleVideoError"
        />
        <p v-if="errorText" class="mt-3 text-center text-sm text-red-300">{{ errorText }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLocale } from '@/i18n/useLocale';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    videoUrl?: string | null;
    coverUrl?: string | null;
    title?: string;
  }>(),
  {
    videoUrl: null,
    coverUrl: null,
    title: '',
  },
);

const emit = defineEmits<{
  close: [];
}>();

const { t } = useLocale();
const videoRef = ref<HTMLVideoElement | null>(null);
const errorText = ref('');

const displayTitle = computed(() => props.title?.trim() || t('routes.playRouteVideo'));

/**
 * 关闭半屏播放器并暂停视频。
 */
function handleClose() {
  videoRef.value?.pause();
  errorText.value = '';
  emit('close');
}

/**
 * 视频加载失败时提示用户。
 */
function handleVideoError() {
  errorText.value = t('routes.videoPlayFailed');
}

watch(
  () => props.visible,
  (open) => {
    if (!open) {
      videoRef.value?.pause();
      errorText.value = '';
    }
  },
);
</script>
