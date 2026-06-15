<template>
  <div class="table-action-bar">
    <slot name="prefix" />
    <TableActionButton
      v-if="showEdit"
      variant="edit"
      :label="editLabel"
      @click="emit('edit')"
    />
    <TableActionButton
      v-if="showDelete"
      variant="delete"
      :label="deleteLabel"
      @click="emit('delete')"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TableActionButton from './TableActionButton.vue';

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
