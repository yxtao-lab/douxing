<template>
  <view v-if="visible" class="media-mask" @click="handleClose">
    <view class="media-sheet" @click.stop>
      <view class="media-header">
        <text class="media-title">{{ displayTitle }}</text>
        <text class="media-close" @click="handleClose">×</text>
      </view>
      <video
        v-if="videoUrl"
        :id="playerId"
        class="media-player"
        :src="videoUrl"
        :poster="coverUrl || undefined"
        controls
        :show-center-play-btn="true"
        object-fit="contain"
        @error="handleVideoError"
      />
      <text v-if="errorText" class="media-error">{{ errorText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTf } from '@/i18n/useTf';

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

const { t } = useTf();

const playerId = `route-media-player-${Math.random().toString(36).slice(2, 9)}`;
const errorText = ref('');

const displayTitle = computed(() => props.title?.trim() || t('routes.playRouteVideo'));

/**
 * 关闭半屏播放器。
 */
function handleClose() {
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
    if (!open) errorText.value = '';
  },
);
</script>

<style scoped>
.media-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
}

.media-sheet {
  width: 100%;
  max-height: 72vh;
  background: #111827;
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
}

.media-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.media-title {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  color: #f9fafb;
}

.media-close {
  font-size: 40rpx;
  color: #9ca3af;
  padding: 0 8rpx;
}

.media-player {
  width: 100%;
  height: 420rpx;
  border-radius: 16rpx;
  background: #000;
}

.media-error {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #fca5a5;
  text-align: center;
}
</style>
