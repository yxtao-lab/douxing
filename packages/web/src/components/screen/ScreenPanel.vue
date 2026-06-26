<template>
  <section class="screen-panel" :class="{ compact: compact }">
    <header v-if="title" class="screen-panel__header">
      <span class="screen-panel__decor screen-panel__decor--left" />
      <h3 class="screen-panel__title">{{ title }}</h3>
      <span class="screen-panel__decor screen-panel__decor--right" />
    </header>
    <div class="screen-panel__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  compact?: boolean;
}>();
</script>

<style scoped>
.screen-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: linear-gradient(145deg, rgba(8, 28, 52, 0.88), rgba(4, 16, 32, 0.92));
  border: 1px solid rgba(0, 196, 255, 0.28);
  box-shadow:
    inset 0 0 24px rgba(0, 140, 220, 0.08),
    0 0 20px rgba(0, 80, 160, 0.15);
  border-radius: 4px;
  position: relative;
}

.screen-panel::before,
.screen-panel::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: rgba(0, 212, 255, 0.65);
  border-style: solid;
  pointer-events: none;
}

.screen-panel::before {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}

.screen-panel::after {
  right: -1px;
  bottom: -1px;
  border-width: 0 2px 2px 0;
}

.screen-panel.compact .screen-panel__body {
  padding: 10px 12px;
}

.screen-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 0;
}

.screen-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #e6f7ff;
  white-space: nowrap;
}

.screen-panel__decor {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 196, 255, 0.55), transparent);
}

.screen-panel__body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px 14px;
}
</style>
