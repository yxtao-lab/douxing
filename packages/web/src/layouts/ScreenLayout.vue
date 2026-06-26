<template>
  <div class="screen-root">
    <div
      class="screen-stage"
      :style="{
        width: `${designWidth}px`,
        height: `${designHeight}px`,
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      }"
    >
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useScreenScale } from '@/composables/useScreenScale';

const { scale, offsetX, offsetY, designWidth, designHeight } = useScreenScale();
</script>

<style scoped>
.screen-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 20%, #0c2a4a 0%, #040b14 55%, #02060c 100%);
}

.screen-stage {
  transform-origin: top left;
}
</style>
