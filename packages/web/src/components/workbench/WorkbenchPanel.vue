<template>
  <a-card class="workbench-panel" :bordered="false">
    <template #title>
      <div class="panel-title">
        <span class="panel-title-bar" aria-hidden="true" />
        <span>{{ title }}</span>
      </div>
    </template>
    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
    <slot />
  </a-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style scoped>
.workbench-panel {
  height: 100%;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.workbench-panel :deep(.ant-card-head) {
  min-height: auto;
  padding: 14px 16px 0;
  border-bottom: none;
}

.workbench-panel :deep(.ant-card-head-title) {
  padding: 0;
}

.workbench-panel :deep(.ant-card-extra) {
  padding: 0;
}

.workbench-panel :deep(.ant-card-body) {
  padding: 12px 16px 16px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.panel-title-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--color-primary);
  flex-shrink: 0;
}
</style>
