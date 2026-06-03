<template>
  <div class="page-container">
    <a-page-header class="page-container-header" :title="title" :sub-title="description">
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </a-page-header>
    <div class="page-container-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<style scoped>
.page-container {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  gap: 16px;
}

.page-container-body > :not(.admin-table-wrap):not(.map-page) {
  flex-shrink: 0;
}

.page-container-body > .map-page {
  flex: 1;
  min-height: 0;
}
</style>
