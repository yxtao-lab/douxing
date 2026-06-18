<template>
  <view v-if="visible && celebration" class="celebration-mask" @click="handleClose">
    <view class="celebration-card" @click.stop>
      <text class="celebration-title">{{ titleText }}</text>
      <text class="celebration-exp">{{ expText }}</text>
      <text v-if="celebration.leveledUp" class="celebration-level-up">{{ levelUpText }}</text>
      <text class="celebration-reply">{{ celebration.petReply }}</text>
      <button class="btn-celebration-ok" @click="handleClose">{{ okText }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PetCheckInCelebration } from '@douxing/shared';
import {
  formatPetCheckInCelebrationExp,
  formatPetCheckInCelebrationLevelUp,
  formatPetCheckInCelebrationOk,
  formatPetCheckInCelebrationTitle,
} from '@douxing/shared';
import { useTf } from '@/i18n/useTf';

const props = defineProps<{
  visible: boolean;
  celebration: PetCheckInCelebration | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { locale } = useTf();

const titleText = computed(() => formatPetCheckInCelebrationTitle(locale.value));
const expText = computed(() =>
  props.celebration
    ? formatPetCheckInCelebrationExp(locale.value, { exp: props.celebration.expGained })
    : '',
);
const levelUpText = computed(() =>
  props.celebration?.leveledUp
    ? formatPetCheckInCelebrationLevelUp(locale.value, {
        prev: props.celebration.previousLevel,
        next: props.celebration.newLevel,
      })
    : '',
);
const okText = computed(() => formatPetCheckInCelebrationOk(locale.value));

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.celebration-mask {
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.celebration-card {
  width: 100%;
  max-width: 620rpx;
  background: var(--dx-bg, #fff);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  text-align: center;
}

.celebration-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text, #1a1a1a);
}

.celebration-exp {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-primary, #2563eb);
}

.celebration-level-up {
  font-size: 28rpx;
  font-weight: 600;
  color: #e67e22;
}

.celebration-reply {
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--dx-muted, #666);
}

.btn-celebration-ok {
  margin-top: 12rpx;
  width: 100%;
  font-size: 28rpx;
  border-radius: 999rpx;
  background: var(--dx-primary, #2563eb);
  color: #fff;
}
</style>
