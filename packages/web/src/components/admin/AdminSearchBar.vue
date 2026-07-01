<template>
  <div class="admin-search-bar" @keyup.enter="onSearch">
    <a-form layout="inline" class="admin-search-form">
      <div
        ref="fieldsRef"
        class="admin-search-fields"
        :class="expanded ? 'is-expanded' : 'is-collapsed'"
      >
        <slot />
      </div>
      <div class="admin-search-actions-row">
        <a-space :size="8">
          <a-button
            v-if="showToggle"
            type="link"
            html-type="button"
            class="admin-search-toggle"
            @click="toggleExpand"
          >
            {{ expanded ? t('common.collapseFilter') : t('common.expandFilter') }}
            <DownOutlined class="admin-search-toggle-icon" :class="{ 'is-expanded': expanded }" />
          </a-button>
          <a-button type="primary" html-type="button" @click="onSearch">
            <template #icon><SearchOutlined /></template>
            {{ t('common.search') }}
          </a-button>
          <a-button html-type="button" @click="onReset">
            <template #icon><ReloadOutlined /></template>
            {{ t('common.reset') }}
          </a-button>
        </a-space>
      </div>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { DownOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { t } = useI18n();

const fieldsRef = ref<HTMLElement | null>(null);
const expanded = ref(false);
const showToggle = ref(false);
const overflowDetected = ref(false);

let resizeObserver: ResizeObserver | null = null;

/** 根据栅格区域高度判断是否需要显示展开/收起按钮 */
function updateToggleVisibility() {
  const el = fieldsRef.value;
  if (!el) return;

  if (!expanded.value) {
    overflowDetected.value = el.scrollHeight > el.clientHeight + 1;
  }
  showToggle.value = expanded.value || overflowDetected.value;
}

function toggleExpand() {
  expanded.value = !expanded.value;
  nextTick(updateToggleVisibility);
}

function onSearch() {
  emit('search');
}

function onReset() {
  emit('reset');
}

onMounted(() => {
  nextTick(() => {
    const el = fieldsRef.value;
    if (!el) return;

    resizeObserver = new ResizeObserver(() => updateToggleVisibility());
    resizeObserver.observe(el);
    updateToggleVisibility();
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>
