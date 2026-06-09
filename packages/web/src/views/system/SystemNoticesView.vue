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
        <template v-if="column.key === 'noticeType'">
          {{ record.noticeType === 2 ? t('system.noticeTypeAnnounce') : t('system.noticeTypeNotify') }}
        </template>
        <template v-else-if="column.key === 'status'">
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
      width="640px"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('system.colTitle')">
          <a-input v-model:value="form.title" />
        </a-form-item>
        <a-form-item :label="t('system.colType')">
          <a-radio-group v-model:value="form.noticeType">
            <a-radio :value="1">{{ t('system.noticeTypeNotify') }}</a-radio>
            <a-radio :value="2">{{ t('system.noticeTypeAnnounce') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('system.colContent')">
          <a-textarea v-model:value="form.content" :rows="6" />
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
import {
  createNotice,
  deleteNotice,
  fetchNoticesPage,
  updateNotice,
  type NoticeRow,
} from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.sysNotices');

const { t } = useI18n();
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<NoticeRow | null>(null);
const form = reactive({ title: '', noticeType: 1, status: 1, content: '' });

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<NoticeRow>(fetchNoticesPage);

const columns = computed<TableColumnsType<NoticeRow>>(() => [
  { title: t('system.colTitle'), dataIndex: 'title', ellipsis: true },
  { title: t('system.colType'), key: 'noticeType', width: 90 },
  { title: t('system.colStatus'), key: 'status', width: 90 },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'createdAt',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
  { title: t('system.colAction'), key: 'action', width: 160, fixed: 'right' },
]);

function openCreate() {
  editing.value = null;
  form.title = '';
  form.noticeType = 1;
  form.content = '';
  modalOpen.value = true;
}

function openEdit(record: NoticeRow) {
  editing.value = record;
  form.title = record.title;
  form.noticeType = record.noticeType;
  form.content = record.content;
  modalOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    if (editing.value) {
      await updateNotice(editing.value.id, { ...form });
    } else {
      await createNotice({ ...form });
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

async function handleDelete(record: NoticeRow) {
  try {
    await deleteNotice(record.id);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(load);
</script>
