<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="load"
          />
        </a-form-item>
        <a-form-item :label="t('system.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>
            {{ t('system.add') }}
          </a-button>
        </template>
        <template #right>
          <AdminTableExportButton :columns="columns" :rows="items" name-key="web.sysDepts" />
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
      :data-source="items"
      :loading="loading"
      :empty-text="t('system.empty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'default'">
            {{ record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar @edit="openEdit(record)" @delete="handleDelete(record)" />
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? t('system.edit') : t('system.add')"
      @ok="submit"
      :confirm-loading="saving"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('system.colParent')">
          <a-select v-model:value="form.parentId" :options="parentOptions" />
        </a-form-item>
        <a-form-item :label="t('system.colName')">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="t('system.colSort')">
          <a-input-number v-model:value="form.sortOrder" :min="0" class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { createDept, deleteDept, fetchDepts, updateDept, type DeptRow } from '@/api/system';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';

usePageTitle('web.sysDepts');

const { t } = useI18n();
const keyword = ref('');
const statusFilter = ref<number | undefined>();
const items = ref<DeptRow[]>([]);
const loading = ref(false);
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<DeptRow | null>(null);
const form = reactive({ parentId: 0, name: '', sortOrder: 0, status: 1 });

const statusOptions = computed(() => [
  { label: t('system.statusNormal'), value: 1 },
  { label: t('system.statusDisabled'), value: 0 },
]);

const parentOptions = computed(() => [
  { label: '—', value: 0 },
  ...items.value.map((d) => ({ label: d.name, value: d.id })),
]);

const columns = computed<AdminExportColumn<DeptRow>[]>(() => [
  { title: t('system.colName'), dataIndex: 'name' },
  { title: t('system.colParent'), dataIndex: 'parentId', width: 100 },
  { title: t('system.colSort'), dataIndex: 'sortOrder', width: 80 },
  {
    title: t('system.colStatus'),
    key: 'status',
    width: 90,
    exportValue: (record) =>
      record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled'),
  },
  { title: t('system.colAction'), key: 'action', width: 160, fixed: 'right' },
]);

async function load() {
  loading.value = true;
  try {
    items.value = await fetchDepts({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
    });
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  void load();
}

function openCreate() {
  editing.value = null;
  form.parentId = 0;
  form.name = '';
  form.sortOrder = 0;
  modalOpen.value = true;
}

function openEdit(record: DeptRow) {
  editing.value = record;
  form.parentId = record.parentId;
  form.name = record.name;
  form.sortOrder = record.sortOrder;
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await updateDept(editing.value.id, { ...form });
    } else {
      await createDept({ ...form });
    }
    message.success(t('common.success'));
    modalOpen.value = false;
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

async function handleDelete(record: DeptRow) {
  try {
    await deleteDept(record.id);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(load);
</script>
