<template>
  <div ref="wrapRef" class="admin-table-wrap">
    <a-alert v-if="error" type="error" :message="error" show-icon class="admin-table-alert" />
    <a-table
      v-bind="$attrs"
      :loading="loading"
      :scroll="scrollY ? { x: 'max-content', y: scrollY } : undefined"
      :locale="{ emptyText: emptyText ?? t('common.noData') }"
    >
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData ?? {}" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useAttrs, watch } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  loading?: boolean;
  error?: string;
  emptyText?: string;
}>();

const { t } = useI18n();
const attrs = useAttrs();
const wrapRef = ref<HTMLElement>();
const scrollY = ref<number>();

const TABLE_HEAD_HEIGHT = 55;
const TABLE_PAGINATION_HEIGHT = 64;

const hasPagination = computed(() => attrs.pagination !== false);

function updateScrollY() {
  const el = wrapRef.value;
  if (!el) return;

  const alertEl = el.querySelector('.admin-table-alert') as HTMLElement | null;
  const alertHeight = alertEl ? alertEl.offsetHeight + 16 : 0;
  const paginationHeight = hasPagination.value ? TABLE_PAGINATION_HEIGHT : 0;
  const bodyHeight = el.clientHeight - alertHeight - TABLE_HEAD_HEIGHT - paginationHeight;

  scrollY.value = Math.max(160, Math.floor(bodyHeight));
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!wrapRef.value) return;

  resizeObserver = new ResizeObserver(() => updateScrollY());
  resizeObserver.observe(wrapRef.value);
  updateScrollY();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(hasPagination, () => updateScrollY());
</script>

<style scoped>
.admin-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.admin-table-alert {
  flex-shrink: 0;
  margin-bottom: 0;
}
</style>
