<template>
  <div class="table-action-bar">
    <slot name="prefix" />
    <a v-if="showEdit" class="action-btn edit-btn" @click="emit('edit')">
      <EditOutlined />
      <span>{{ editLabel }}</span>
    </a>
    <a v-if="showDelete" class="action-btn delete-btn" @click="emit('delete')">
      <DeleteOutlined />
      <span>{{ deleteLabel }}</span>
    </a>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    showEdit?: boolean;
    showDelete?: boolean;
    editText?: string;
    deleteText?: string;
  }>(),
  {
    showEdit: true,
    showDelete: true,
  },
);

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();

const { t } = useI18n();
const editLabel = computed(() => props.editText ?? t('system.edit'));
const deleteLabel = computed(() => props.deleteText ?? t('system.delete'));
</script>
