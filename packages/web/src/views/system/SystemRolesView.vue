<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="load"
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
          <AdminTableExportButton :columns="columns" :rows="items" name-key="web.sysRoles" />
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
        <template v-if="column.key === 'action'">
          <TableActionBar
            :show-delete="record.code !== 'admin' && record.code !== 'user'"
            @edit="openEdit(record)"
            @delete="handleDelete(record)"
          />
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('system.edit') : t('system.add')"
      @ok="submit"
      :confirm-loading="saving"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('system.colCode')">
          <a-input v-model:value="form.code" :disabled="Boolean(editingId)" />
        </a-form-item>
        <a-form-item :label="t('system.colName')">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="t('system.colDescription')">
          <a-input v-model:value="form.description" />
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
import type { TableColumnsType } from 'ant-design-vue';
import { createRole, deleteRole, fetchRoles, updateRole, type RoleRow } from '@/api/system';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.sysRoles');

const { t } = useI18n();
const keyword = ref('');
const items = ref<RoleRow[]>([]);
const loading = ref(false);
const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ code: '', name: '', description: '' });

const columns = computed<TableColumnsType<RoleRow>>(() => [
  { title: t('system.colCode'), dataIndex: 'code', width: 120 },
  { title: t('system.colName'), dataIndex: 'name', width: 140 },
  { title: t('system.colDescription'), dataIndex: 'description', ellipsis: true },
  { title: t('system.colUserCount'), dataIndex: 'userCount', width: 100 },
  { title: t('system.colAction'), key: 'action', width: 160, fixed: 'right' },
]);

async function load() {
  loading.value = true;
  try {
    items.value = await fetchRoles({
      keyword: keyword.value.trim() || undefined,
    });
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  keyword.value = '';
  void load();
}

function openCreate() {
  editingId.value = null;
  form.code = '';
  form.name = '';
  form.description = '';
  modalOpen.value = true;
}

function openEdit(record: RoleRow) {
  editingId.value = record.id;
  form.code = record.code;
  form.name = record.name;
  form.description = record.description ?? '';
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editingId.value) {
      await updateRole(editingId.value, { name: form.name, description: form.description });
    } else {
      await createRole({ code: form.code, name: form.name, description: form.description });
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

async function handleDelete(record: RoleRow) {
  try {
    await deleteRole(record.id);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(load);
</script>
