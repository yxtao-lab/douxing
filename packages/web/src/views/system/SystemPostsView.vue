<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>
            {{ t('system.add') }}
          </a-button>
        </template>
        <template #right>
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="reload">
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
      :pagination="pagination"
      @change="handleTableChange"
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
        <a-form-item :label="t('system.colCode')">
          <a-input v-model:value="form.code" :disabled="Boolean(editing)" />
        </a-form-item>
        <a-form-item :label="t('system.colName')">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="t('system.colRemark')">
          <a-input v-model:value="form.remark" />
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
import { createPost, deletePost, fetchPostsPage, updatePost, type PostRow } from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.sysPosts');

const { t } = useI18n();
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<PostRow | null>(null);
const form = reactive({ code: '', name: '', remark: '', sortOrder: 0, status: 1 });

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<PostRow>(fetchPostsPage);

const columns = computed<TableColumnsType<PostRow>>(() => [
  { title: t('system.colCode'), dataIndex: 'code', width: 120 },
  { title: t('system.colName'), dataIndex: 'name' },
  { title: t('system.colRemark'), dataIndex: 'remark', ellipsis: true },
  { title: t('system.colStatus'), key: 'status', width: 90 },
  { title: t('system.colAction'), key: 'action', width: 160, fixed: 'right' },
]);

function openCreate() {
  editing.value = null;
  form.code = '';
  form.name = '';
  form.remark = '';
  modalOpen.value = true;
}

function openEdit(record: PostRow) {
  editing.value = record;
  form.code = record.code;
  form.name = record.name;
  form.remark = record.remark ?? '';
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await updatePost(editing.value.id, { name: form.name, remark: form.remark });
    } else {
      await createPost({ code: form.code, name: form.name, remark: form.remark });
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

async function handleDelete(record: PostRow) {
  try {
    await deletePost(record.id);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(load);
</script>
