<template>
  <a-layout-sider
    v-model:collapsed="layoutStore.collapsed"
    class="app-sider"
    :width="220"
    :collapsed-width="64"
    theme="dark"
    collapsible
    :trigger="null"
  >
    <AppLogo :collapsed="layoutStore.collapsed" />
    <div class="sider-menu">
      <a-menu
        theme="dark"
        mode="inline"
        :items="menuItems"
        :selected-keys="selectedKeys"
        v-model:open-keys="openKeys"
        @click="onMenuClick"
      />
    </div>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { MenuProps } from 'ant-design-vue';
import { useAppMenu } from '@/composables/useAppMenu';
import { useLayoutStore } from '@/stores/layout';
import AppLogo from './AppLogo.vue';

const router = useRouter();
const layoutStore = useLayoutStore();
const { menuItems, selectedKeys, openKeys: defaultOpenKeys } = useAppMenu();
const openKeys = ref<string[]>([]);

watch(
  defaultOpenKeys,
  (keys) => {
    openKeys.value = [...keys];
  },
  { immediate: true },
);

function onMenuClick(info: Parameters<NonNullable<MenuProps['onClick']>>[0]) {
  const key = info.key;
  if (typeof key !== 'string' || key.startsWith('group-')) return;
  router.push(key);
}
</script>

<style scoped>
.app-sider {
  height: 100%;
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
}

.app-sider :deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.app-sider :deep(.app-logo) {
  flex-shrink: 0;
}

.sider-menu {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.sider-menu :deep(.ant-menu) {
  border-inline-end: none;
}
</style>
