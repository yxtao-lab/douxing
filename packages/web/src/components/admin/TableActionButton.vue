<template>
  <a
    class="action-btn"
    :class="variantClass"
    :title="title || undefined"
    @click="emit('click', $event)"
  >
    <component :is="resolvedIcon" v-if="resolvedIcon" />
    <span><slot>{{ label }}</slot></span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';

/** 管理端表格操作列按钮变体（须置于 TableActionBar 内） */
export type TableActionVariant = 'edit' | 'delete' | 'primary' | 'warning' | 'success' | 'info';

const props = withDefaults(
  defineProps<{
    variant?: TableActionVariant;
    label?: string;
    title?: string;
    icon?: Component | null;
  }>(),
  {
    variant: 'edit',
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClass = computed(() => {
  if (props.variant === 'delete') return 'delete-btn';
  if (props.variant === 'warning') return 'warning-btn';
  if (props.variant === 'success') return 'success-btn';
  if (props.variant === 'info') return 'info-btn';
  if (props.variant === 'primary') return 'primary-btn';
  return 'edit-btn';
});

const defaultIconMap: Record<TableActionVariant, Component> = {
  edit: EditOutlined,
  delete: DeleteOutlined,
  primary: EditOutlined,
  warning: KeyOutlined,
  success: CheckOutlined,
  info: ReloadOutlined,
};

const resolvedIcon = computed(() => {
  if (props.icon === null) return null;
  return props.icon ?? defaultIconMap[props.variant];
});
</script>
