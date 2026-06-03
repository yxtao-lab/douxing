<template>
  <router-link to="/" class="app-logo" :class="{ 'is-collapsed': collapsed }">
    <img src="/logo.png" :alt="t('app.name')" class="logo-img" />
    <span v-if="!collapsed" class="logo-title">{{ t('app.name') }}</span>
  </router-link>
</template>

<script setup lang="ts">
import { useLocale } from '@/i18n/useLocale';

defineProps<{
  collapsed?: boolean;
}>();

const { t } = useLocale();
</script>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  overflow: hidden;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition: padding 0.2s;
}

.app-logo.is-collapsed {
  justify-content: center;
  padding: 0 12px;
}

.logo-img {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
  border-radius: 6px;
}

.logo-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
