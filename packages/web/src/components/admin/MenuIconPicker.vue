<template>
  <div class="menu-icon-picker">
    <div class="icon-preview" :class="{ empty: !modelValue }">
      <component :is="previewIcon" v-if="previewIcon" />
      <span v-else class="preview-placeholder">{{ t('system.iconPreviewEmpty') }}</span>
    </div>
    <a-select
      :value="modelValue"
      allow-clear
      show-search
      class="icon-select"
      :placeholder="t('system.iconPlaceholder')"
      :filter-option="filterIconOption"
      @update:value="onChange"
    >
      <a-select-option v-for="name in menuIconOptions" :key="name" :value="name">
        <span class="icon-option">
          <component :is="renderMenuIcon(name)" />
          <span class="icon-option-label">{{ name }}</span>
        </span>
      </a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SelectValue } from 'ant-design-vue/es/select';
import { useI18n } from 'vue-i18n';
import { menuIconOptions, renderMenuIcon } from '@/composables/useAppMenu';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();

const { t } = useI18n();

const previewIcon = computed(() => renderMenuIcon(props.modelValue));

function filterIconOption(input: string, option: { value?: string | number }) {
  const value = String(option?.value ?? '');
  return value.toLowerCase().includes(input.trim().toLowerCase());
}

function onChange(value: SelectValue) {
  emit('update:modelValue', typeof value === 'string' ? value : undefined);
}
</script>

<style scoped>
.menu-icon-picker {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.icon-preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 6px;
  background: #fafafa;
  font-size: 18px;
  color: var(--color-primary, #1677ff);
}

.icon-preview.empty {
  color: #bfbfbf;
  font-size: 12px;
}

.preview-placeholder {
  transform: scale(0.85);
  white-space: nowrap;
}

.icon-select {
  flex: 1;
  min-width: 0;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.icon-option :deep(.anticon) {
  font-size: 16px;
  color: var(--color-primary, #1677ff);
}

.icon-option-label {
  font-size: 13px;
}
</style>
