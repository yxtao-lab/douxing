<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.cacheKeyPattern')">
          <a-input v-model:value="pattern" allow-clear style="width: 240px" @press-enter="load" />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton :columns="columns" :rows="tableData" name-key="web.monitorCacheList" />
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <DouxingAdminTable
      :columns="columns"
      :data-source="tableData"
      :loading="loading"
      :empty-text="t('system.empty')"
      row-key="key"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <a-popconfirm :title="t('system.confirmDelete')" @confirm="handleDelete(record.key)">
              <TableActionButton variant="delete" :label="t('system.deleteKey')" />
            </a-popconfirm>
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { deleteCacheKey, fetchCacheKeys } from '@/api/system';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorCacheList');

const { t } = useI18n();
const loading = ref(false);
const pattern = ref('*');
const keys = ref<string[]>([]);

const tableData = computed(() => keys.value.map((key) => ({ key })));

const columns = computed<TableColumnsType<{ key: string }>>(() => [
  { title: 'Key', dataIndex: 'key', ellipsis: true },
  { title: t('system.colAction'), key: 'action', width: 120, fixed: 'right' },
]);

function resetSearch() {
  pattern.value = '*';
  void load();
}

async function load() {
  loading.value = true;
  try {
    keys.value = await fetchCacheKeys(pattern.value || '*');
  } finally {
    loading.value = false;
  }
}

async function handleDelete(key: string) {
  try {
    await deleteCacheKey(key);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(load);
</script>
