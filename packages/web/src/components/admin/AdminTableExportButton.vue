<template>
  <a-tooltip :title="t('common.exportReport')">
    <a-button :size="size" :loading="exporting" :disabled="disabled" @click="handleExport">
      <template #icon><DownloadOutlined /></template>
      <span v-if="showLabel">{{ t('common.exportReport') }}</span>
    </a-button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { ColumnType } from 'ant-design-vue/es/table';
import type { SizeType } from 'ant-design-vue/es/config-provider';
import { exportAdminTableXlsx, flattenTreeRows } from '@/utils/adminTableExport';

const props = withDefaults(
  defineProps<{
    columns: ColumnType[];
    rows?: unknown[];
    fetchRows?: () => Promise<unknown[]>;
    /** i18n 键：导出文件名与 Sheet 名使用 t(nameKey) + 时间戳 */
    nameKey: string;
    flattenTree?: boolean;
    disabled?: boolean;
    size?: SizeType;
    showLabel?: boolean;
  }>(),
  {
    size: 'middle',
    showLabel: false,
  },
);

const { t } = useI18n();
const exporting = ref(false);

async function handleExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    let rows = props.fetchRows ? await props.fetchRows() : [...(props.rows ?? [])];
    if (props.flattenTree) {
      rows = flattenTreeRows(rows);
    }
    if (!rows.length) {
      message.warning(t('common.exportEmpty'));
      return;
    }
    const reportName = t(props.nameKey);
    await exportAdminTableXlsx(
      props.columns,
      rows as Record<string, unknown>[],
      reportName,
    );
    message.success(t('common.exportSuccess'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.exportFailed'));
  } finally {
    exporting.value = false;
  }
}
</script>
