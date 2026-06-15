<template>
  <div
    ref="wrapRef"
    class="admin-table-wrap"
    :class="{
      'admin-table-wrap--body-scroll': scrollY != null,
      'admin-table-wrap--embedded': !autoBodyScroll,
    }"
  >
    <a-alert v-if="error" type="error" :message="error" show-icon class="admin-table-alert" />
    <a-table
      v-bind="tableAttrs"
      :columns="resizableColumns"
      :size="tableSize"
      class="admin-pro-table"
      :loading="loading"
      :scroll="tableScroll"
      :pagination="mergedPagination"
      :locale="{ emptyText: emptyText ?? t('common.noData') }"
    >
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData ?? {}" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useAttrs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ColumnType } from 'ant-design-vue/es/table';
import type { SizeType } from 'ant-design-vue/es/config-provider';
import { useAdminResizableColumns } from '@/composables/useAdminResizableColumns';
import { mergeAdminPagination, type AdminPaginationInput } from '@/utils/adminPagination';

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string;
    emptyText?: string;
    /** 是否允许拖动调整列宽，默认开启；单列可设 resizable: false */
    columnResizable?: boolean;
    /** 是否根据视口自动计算表格 body 纵向滚动高度，内嵌小表可关闭 */
    autoBodyScroll?: boolean;
  }>(),
  { columnResizable: true, autoBodyScroll: true },
);

const { t } = useI18n();
const attrs = useAttrs();
const wrapRef = ref<HTMLElement>();
const scrollY = ref<number | undefined>(undefined);

const TABLE_HEAD_HEIGHT = 55;
const TABLE_PAGINATION_HEIGHT = 88;
const LAYOUT_BOTTOM_GAP = 16;
const ROW_HEIGHT_ESTIMATE = 49;

const sourceColumns = computed(() => attrs.columns as ColumnType[] | undefined);

const { columns: resizableColumns } = useAdminResizableColumns(
  sourceColumns,
  props.columnResizable,
);

const tableAttrs = computed(() => {
  const { pagination: _pagination, columns: _columns, size: _size, ...rest } = attrs;
  return rest;
});

const tableSize = computed<SizeType>(() => (attrs.size as SizeType | undefined) ?? 'middle');

const mergedPagination = computed(() =>
  mergeAdminPagination(attrs.pagination as AdminPaginationInput, (total, range) =>
    t('common.paginationTotal', { start: range[0], end: range[1], total }),
  ),
);

const hasPagination = computed(() => mergedPagination.value !== false);

const tableScroll = computed(() =>
  scrollY.value != null ? { x: 'max-content', y: scrollY.value } : { x: 'max-content' },
);

function getAvailableBodyHeight(el: HTMLElement) {
  const alertEl = el.querySelector('.admin-table-alert') as HTMLElement | null;
  const alertHeight = alertEl ? alertEl.offsetHeight + 16 : 0;
  const paginationHeight = hasPagination.value ? TABLE_PAGINATION_HEIGHT : 0;

  const rect = el.getBoundingClientRect();
  const viewportAvailable = window.innerHeight - rect.top - LAYOUT_BOTTOM_GAP;
  const containerAvailable = el.clientHeight;
  const available =
    containerAvailable > 120 ? containerAvailable : Math.max(containerAvailable, viewportAvailable);

  const bodyHeight = available - alertHeight - TABLE_HEAD_HEIGHT - paginationHeight;
  return Math.max(160, Math.floor(bodyHeight));
}

function measureBodyContentHeight(el: HTMLElement) {
  const tbody = el.querySelector('.ant-table-tbody') as HTMLElement | null;
  if (tbody) {
    return Math.ceil(tbody.getBoundingClientRect().height);
  }

  const dataSource = attrs['data-source'];
  const rowCount = Array.isArray(dataSource) ? dataSource.length : 0;
  return rowCount * ROW_HEIGHT_ESTIMATE;
}

let updating = false;

async function updateScrollY() {
  if (!props.autoBodyScroll || updating) return;
  const el = wrapRef.value;
  if (!el) return;

  updating = true;
  try {
    const maxBodyHeight = getAvailableBodyHeight(el);

    scrollY.value = undefined;
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const contentHeight = measureBodyContentHeight(el);
    scrollY.value = contentHeight > maxBodyHeight ? maxBodyHeight : undefined;
  } finally {
    updating = false;
  }
}

let resizeObserver: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleUpdateScrollY() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    void updateScrollY();
  }, 16);
}

onMounted(() => {
  if (!props.autoBodyScroll || !wrapRef.value) return;

  resizeObserver = new ResizeObserver(() => scheduleUpdateScrollY());
  resizeObserver.observe(wrapRef.value);

  let parent: HTMLElement | null = wrapRef.value.parentElement;
  while (parent) {
    resizeObserver.observe(parent);
    if (parent.classList.contains('page-container') || parent.classList.contains('content-inner')) {
      break;
    }
    parent = parent.parentElement;
  }

  window.addEventListener('resize', scheduleUpdateScrollY);
  scheduleUpdateScrollY();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', scheduleUpdateScrollY);
  if (resizeTimer) clearTimeout(resizeTimer);
});

watch(hasPagination, scheduleUpdateScrollY);
watch(() => props.loading, scheduleUpdateScrollY);
watch(() => attrs['data-source'], scheduleUpdateScrollY, { deep: true });
watch(() => attrs.pagination, scheduleUpdateScrollY, { deep: true });
watch(mergedPagination, scheduleUpdateScrollY, { deep: true });
</script>

<style scoped>
.admin-table-wrap {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.admin-table-wrap--body-scroll :deep(.ant-spin-nested-loading),
.admin-table-wrap--body-scroll :deep(.ant-spin-container),
.admin-table-wrap--body-scroll :deep(.ant-table) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.admin-table-wrap:not(.admin-table-wrap--body-scroll) :deep(.ant-spin-nested-loading),
.admin-table-wrap:not(.admin-table-wrap--body-scroll) :deep(.ant-spin-container) {
  flex: 0 1 auto;
}

.admin-table-wrap--embedded {
  flex: 0 1 auto;
  height: auto;
  overflow: visible;
}

.admin-table-alert {
  flex-shrink: 0;
  margin-bottom: 0;
}
</style>
