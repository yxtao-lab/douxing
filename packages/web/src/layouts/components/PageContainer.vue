<template>
  <div class="page-container" :class="{ 'page-container--admin': admin }">
    <template v-if="admin">
      <a-card class="admin-page-card" :bordered="false">
        <div v-if="$slots.search" class="admin-page-search">
          <slot name="search" />
        </div>
        <slot name="toolbar" />
        <div class="page-container-body">
          <slot />
        </div>
      </a-card>
    </template>
    <template v-else>
      <a-page-header class="page-container-header" :title="title" :sub-title="description">
        <template v-if="$slots.extra" #extra>
          <slot name="extra" />
        </template>
      </a-page-header>
      <div class="page-container-body">
        <slot />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  /** BearJia 风格：白卡片 + 搜索区 + 工具栏 */
  admin?: boolean;
}>();
</script>

<style scoped>
.page-container {
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-container--admin {
  padding-right: 4px;
}

.page-container-header {
  flex-shrink: 0;
  padding: 0 0 16px;
  background: transparent;
}

.page-container-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-container-body > :not(.admin-table-wrap):not(.map-page):not(.admin-panel-grid):not(.admin-split-panels):not(.admin-desc-block):not(.admin-tree-panel) {
  flex-shrink: 0;
}

.page-container-body > .admin-table-wrap,
.page-container-body > .map-page,
.page-container-body > .admin-split-panels,
.page-container-body > .admin-tree-panel,
.page-container-body > .admin-panel-grid,
.page-container-body > .admin-desc-block {
  flex: 1;
  min-height: 0;
}
</style>
