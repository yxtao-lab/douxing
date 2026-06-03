<template>
  <a-config-provider :theme="antdTheme" class="app-root">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { antdTheme } from '@/theme/antd-theme';
</script>

<style scoped>
.app-root {
  height: 100%;
}
</style>
