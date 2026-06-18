<script setup lang="ts">

import { computed, onMounted, ref } from 'vue';

import { usePetCompanion } from '@/composables/usePetCompanion';



const {

  visible,

  sheetOpen,

  showBubble,

  ballPosition,

  ambientBubble,

  speciesEmoji,

  sheetViewModel,

  openSheet,

  closeSheet,

  goPlan,

  goMemoryWall,

  triggerPrePlanAnalyze,

  updateBallPosition,

} = usePetCompanion();



const dragging = ref(false);

const dragOffset = ref({ x: 0, y: 0 });

const viewport = ref({ width: 375, height: 667 });

const ballSize = 56;



const ballStyle = computed(() => {

  if (ballPosition.value.x === 0 && ballPosition.value.y === 0) {

    return {};

  }

  return {

    left: `${ballPosition.value.x}px`,

    top: `${ballPosition.value.y}px`,

    right: 'auto',

    bottom: 'auto',

  };

});



const useCustomPosition = computed(

  () => ballPosition.value.x !== 0 || ballPosition.value.y !== 0,

);



onMounted(() => {

  try {

    const info = uni.getSystemInfoSync();

    viewport.value = { width: info.windowWidth, height: info.windowHeight };

  } catch {

    /* ignore */

  }

});



function clampPosition(x: number, y: number) {

  const maxX = Math.max(8, viewport.value.width - ballSize - 8);

  const maxY = Math.max(8, viewport.value.height - ballSize - 120);

  return {

    x: Math.min(Math.max(8, x), maxX),

    y: Math.min(Math.max(8, y), maxY),

  };

}



function onTouchStart(event: TouchEvent) {

  const touch = event.touches[0];

  if (!touch) return;

  dragging.value = true;

  const currentX = useCustomPosition.value

    ? ballPosition.value.x

    : viewport.value.width - ballSize - 12;

  const currentY = useCustomPosition.value

    ? ballPosition.value.y

    : viewport.value.height - ballSize - 120;

  dragOffset.value = { x: touch.clientX - currentX, y: touch.clientY - currentY };

}



function onTouchMove(event: TouchEvent) {

  if (!dragging.value) return;

  const touch = event.touches[0];

  if (!touch) return;

  const next = clampPosition(touch.clientX - dragOffset.value.x, touch.clientY - dragOffset.value.y);

  updateBallPosition(next);

}



function onTouchEnd() {

  dragging.value = false;

}



function onBallTap() {

  if (dragging.value) return;

  openSheet();

}

</script>



<template>

  <view v-if="visible" class="travel-pet-floating">

    <view

      v-if="showBubble && ambientBubble && !sheetOpen"

      class="travel-pet-floating__bubble"

      :class="{ 'travel-pet-floating__bubble--custom': useCustomPosition }"

      :style="useCustomPosition ? { left: `${ballPosition.x}px`, top: `${Math.max(8, ballPosition.y - 72)}px` } : undefined"

    >

      <text class="travel-pet-floating__bubble-text">{{ ambientBubble }}</text>

    </view>



    <view

      class="travel-pet-floating__ball"

      :class="{ 'travel-pet-floating__ball--custom': useCustomPosition }"

      :style="ballStyle"

      @touchstart.stop.prevent="onTouchStart"

      @touchmove.stop.prevent="onTouchMove"

      @touchend.stop="onTouchEnd"

      @tap.stop="onBallTap"

    >

      <text class="travel-pet-floating__emoji">{{ speciesEmoji }}</text>

    </view>



    <view v-if="sheetOpen && sheetViewModel" class="travel-pet-floating__mask" @tap="closeSheet">

      <view class="travel-pet-floating__sheet" @tap.stop>

        <view class="travel-pet-floating__sheet-head">

          <text class="travel-pet-floating__sheet-title">{{ sheetViewModel.sheetTitle }}</text>

          <text class="travel-pet-floating__close" @tap="closeSheet">×</text>

        </view>

        <view class="travel-pet-floating__profile">

          <text class="travel-pet-floating__profile-emoji">{{ sheetViewModel.speciesEmoji }}</text>

          <view>

            <text class="travel-pet-floating__nickname">{{ sheetViewModel.nickname }}</text>

            <text class="travel-pet-floating__meta">

              {{ sheetViewModel.personalityLabel }} · {{ sheetViewModel.levelLabel }} · {{ sheetViewModel.moodLabel }}

            </text>

          </view>

        </view>

        <view class="travel-pet-floating__memory">

          <text class="travel-pet-floating__memory-title">{{ sheetViewModel.memoryTitle }}</text>

          <text v-if="sheetViewModel.hasMemories && sheetViewModel.memorySummary" class="travel-pet-floating__summary">

            {{ sheetViewModel.memorySummary }}

          </text>

          <text v-else-if="!sheetViewModel.hasMemories" class="travel-pet-floating__empty">

            {{ sheetViewModel.emptyMemoryText }}

          </text>

          <view v-if="sheetViewModel.recallItems.length" class="travel-pet-floating__items">

            <view

              v-for="(item, index) in sheetViewModel.recallItems"

              :key="`${item.content}-${index}`"

              class="travel-pet-floating__item"

            >

              <text class="travel-pet-floating__item-content">{{ item.content }}</text>

              <text class="travel-pet-floating__item-reason">{{ item.reason }}</text>

            </view>

          </view>

        </view>

        <button class="travel-pet-floating__cta" @tap="goPlan">{{ sheetViewModel.goPlanLabel }}</button>
        <view class="travel-pet-floating__secondary-actions">
          <button class="travel-pet-floating__secondary" @tap="goMemoryWall">
            {{ sheetViewModel.viewMemoryWallLabel }}
          </button>
          <button class="travel-pet-floating__secondary" @tap="triggerPrePlanAnalyze">
            {{ sheetViewModel.analyzePrePlanLabel }}
          </button>
        </view>

      </view>

    </view>

  </view>

</template>



<style scoped>

.travel-pet-floating {

  pointer-events: none;

}



.travel-pet-floating__ball {

  position: fixed;

  right: 24rpx;

  bottom: calc(140rpx + env(safe-area-inset-bottom));

  width: 112rpx;

  height: 112rpx;

  border-radius: 999rpx;

  background: linear-gradient(135deg, #fff7ed, #fed7aa);

  border: 2rpx solid rgba(251, 191, 36, 0.45);

  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.25);

  display: flex;

  align-items: center;

  justify-content: center;

  z-index: 9998;

  pointer-events: auto;

}



.travel-pet-floating__ball--custom {

  right: auto;

  bottom: auto;

}



.travel-pet-floating__emoji {

  font-size: 52rpx;

}



.travel-pet-floating__bubble {

  position: fixed;

  right: 24rpx;

  bottom: calc(268rpx + env(safe-area-inset-bottom));

  max-width: 420rpx;

  padding: 16rpx 20rpx;

  border-radius: 20rpx;

  background: rgba(255, 255, 255, 0.96);

  border: 1rpx solid rgba(251, 191, 36, 0.35);

  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.08);

  z-index: 9997;

  pointer-events: none;

}



.travel-pet-floating__bubble--custom {

  right: auto;

  bottom: auto;

  max-width: 280px;

}



.travel-pet-floating__bubble-text {

  font-size: 24rpx;

  line-height: 1.5;

  color: #57534e;

}



.travel-pet-floating__mask {

  position: fixed;

  inset: 0;

  background: rgba(15, 23, 42, 0.35);

  z-index: 10001;

  display: flex;

  align-items: flex-end;

  pointer-events: auto;

}



.travel-pet-floating__sheet {

  width: 100%;

  max-height: 72vh;

  padding: 28rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));

  border-radius: 32rpx 32rpx 0 0;

  background: #fffbeb;

}



.travel-pet-floating__sheet-head {

  display: flex;

  align-items: center;

  justify-content: space-between;

}



.travel-pet-floating__sheet-title {

  font-size: 32rpx;

  font-weight: 600;

  color: #92400e;

}



.travel-pet-floating__close {

  font-size: 44rpx;

  line-height: 1;

  color: #a8a29e;

  padding: 8rpx;

}



.travel-pet-floating__profile {

  display: flex;

  align-items: center;

  gap: 20rpx;

  margin-top: 24rpx;

}



.travel-pet-floating__profile-emoji {

  font-size: 64rpx;

}



.travel-pet-floating__nickname {

  display: block;

  font-size: 30rpx;

  font-weight: 600;

  color: #78350f;

}



.travel-pet-floating__meta {

  display: block;

  margin-top: 4rpx;

  font-size: 22rpx;

  color: #b45309;

}



.travel-pet-floating__memory {

  margin-top: 24rpx;

}



.travel-pet-floating__memory-title {

  display: block;

  font-size: 24rpx;

  font-weight: 600;

  color: #78350f;

}



.travel-pet-floating__summary,

.travel-pet-floating__empty {

  display: block;

  margin-top: 8rpx;

  font-size: 24rpx;

  line-height: 1.5;

  color: #57534e;

}



.travel-pet-floating__items {

  margin-top: 16rpx;

  display: flex;

  flex-direction: column;

  gap: 12rpx;

}



.travel-pet-floating__item {

  padding: 12rpx 16rpx;

  border-radius: 16rpx;

  background: rgba(255, 255, 255, 0.85);

}



.travel-pet-floating__item-content {

  display: block;

  font-size: 24rpx;

  color: #292524;

}



.travel-pet-floating__item-reason {

  display: block;

  margin-top: 4rpx;

  font-size: 20rpx;

  color: #a8a29e;

}



.travel-pet-floating__cta {

  margin-top: 28rpx;

  width: 100%;

  height: 88rpx;

  line-height: 88rpx;

  border-radius: 999rpx;

  background: linear-gradient(135deg, #f59e0b, #ea580c);

  color: #fff;

  font-size: 30rpx;

  font-weight: 600;

  border: none;

}



.travel-pet-floating__secondary-actions {

  display: flex;

  gap: 16rpx;

  margin-top: 16rpx;

}



.travel-pet-floating__secondary {

  flex: 1;

  height: 72rpx;

  line-height: 72rpx;

  border-radius: 999rpx;

  background: rgba(255, 255, 255, 0.9);

  border: 1rpx solid rgba(251, 191, 36, 0.45);

  color: #b45309;

  font-size: 24rpx;

}

</style>

