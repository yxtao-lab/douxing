<template>
  <div class="admin-search-bar" @keyup.enter="onSearch">
    <a-form layout="inline" class="admin-search-form">
      <slot />
      <a-form-item class="admin-search-actions">
        <a-space>
          <a-button type="primary" html-type="button" @click="onSearch">
            <template #icon><SearchOutlined /></template>
            {{ t('common.search') }}
          </a-button>
          <a-button html-type="button" @click="onReset">
            <template #icon><ReloadOutlined /></template>
            {{ t('common.reset') }}
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { t } = useI18n();

function onSearch() {
  emit('search');
}

function onReset() {
  emit('reset');
}
</script>
