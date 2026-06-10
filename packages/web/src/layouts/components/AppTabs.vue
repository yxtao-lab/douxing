<template>
  <div v-if="tabs.length" class="app-tabs">
    <a-dropdown
      v-for="tab in tabs"
      :key="tab.path"
      :trigger="['contextmenu']"
    >
      <div
        class="app-tab"
        :class="{ active: tab.path === activePath }"
        @click="switchTab(tab)"
      >
        <span class="app-tab-title">{{ tabTitle(tab) }}</span>
        <CloseOutlined
          v-if="tabs.length > 1"
          class="app-tab-close"
          @click.stop="closeTab(tab.path)"
        />
      </div>
      <template #overlay>
        <a-menu @click="(info) => handleContextAction(info, tab)">
          <a-menu-item key="close">{{ t('web.tabs.close') }}</a-menu-item>
          <a-menu-item key="closeOthers">{{ t('web.tabs.closeOthers') }}</a-menu-item>
          <a-menu-item key="closeAll">{{ t('web.tabs.closeAll') }}</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CloseOutlined } from '@ant-design/icons-vue';
import type { VisitedTab } from '@/stores/layout';
import { useLayoutStore } from '@/stores/layout';
import { useLocale } from '@/i18n/useLocale';

const router = useRouter();
const route = useRoute();
const layoutStore = useLayoutStore();
const { t } = useLocale();

const tabs = computed(() => layoutStore.visitedViews);
const activePath = computed(() => route.path);

function tabTitle(tab: VisitedTab) {
  return tab.titleKey ? t(tab.titleKey) : tab.path;
}

function switchTab(tab: VisitedTab) {
  if (tab.path !== route.path) {
    router.push(tab.fullPath);
  }
}

function closeTab(path: string) {
  layoutStore.closeView(path, route.path, router);
}

function handleContextAction(
  info: { key: string | number },
  tab: VisitedTab,
) {
  if (info.key === 'close') {
    closeTab(tab.path);
  } else if (info.key === 'closeOthers') {
    layoutStore.closeOtherViews(tab.path);
    if (route.path !== tab.path) {
      router.push(tab.fullPath);
    }
  } else if (info.key === 'closeAll') {
    layoutStore.closeAllViews();
    if (route.path !== '/') {
      router.push('/');
    }
  }
}
</script>

<style scoped>
.app-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
  flex-shrink: 0;
}

.app-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 160px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: #fafafa;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s, color 0.2s;
}

.app-tab.active {
  background: #f5f7fa;
  color: var(--color-primary);
  border-color: #d9d9d9;
  font-weight: 500;
}

.app-tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-tab-close {
  font-size: 10px;
  color: #9ca3af;
  flex-shrink: 0;
}

.app-tab-close:hover {
  color: #374151;
}
</style>
