<template>
  <a-config-provider :theme="antdTheme" :locale="antdLocale" class="app-root">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { antdTheme } from '@/theme/antd-theme';
import { useAntdLocale } from '@/composables/useAntdLocale';

const { antdLocale } = useAntdLocale();
</script>

<style scoped>
.app-root {
  height: 100%;
}
</style>
