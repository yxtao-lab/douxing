<template>
  <a-layout class="basic-layout">
    <AppSider />
    <a-layout class="basic-layout-main">
      <a-layout-header class="basic-layout-header">
        <AppHeader />
      </a-layout-header>
      <AppTabs />
      <a-layout-content class="basic-layout-content">
        <div class="content-inner overlay-scrollbar">
          <router-view />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import AppHeader from './components/AppHeader.vue';
import AppSider from './components/AppSider.vue';
import AppTabs from './components/AppTabs.vue';
</script>

<style scoped>
.basic-layout {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.basic-layout :deep(.ant-layout-sider) {
  height: 100%;
  flex-shrink: 0;
}

.basic-layout-main {
  flex: 1;
  width: 0;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.basic-layout-header {
  flex-shrink: 0;
  height: 56px;
  line-height: 56px;
  padding: 0;
  background: #fff;
}

.basic-layout-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px 8px 16px 16px;
  overflow: hidden;
  background: #f5f7fa;
}

.content-inner {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-inner > :deep(> :not(.page-container)) {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.content-inner > :deep(.page-container) {
  flex: 1;
  min-height: 0;
}
</style>
