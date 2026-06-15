<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('system.colUsername')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchUser')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.sysUsers"
          />
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
        <template v-else-if="column.key === 'roles'">
          {{ formatAdminTableCell(record.roles.join(', ')) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <template #prefix>
              <a-switch
                :checked="record.status === 1"
                size="small"
                @change="(checked) => handleToggleStatus(record, checked === true)"
              />
            </template>
            <TableActionButton
              variant="primary"
              :icon="TeamOutlined"
              :label="t('system.assignRoles')"
              @click="openRolesModal(record)"
            />
            <TableActionButton
              variant="warning"
              :label="t('system.resetPassword')"
              @click="openPasswordModal(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="rolesModalOpen"
      :title="t('system.assignRoles')"
      @ok="submitRoles"
      :confirm-loading="saving"
    >
      <a-checkbox-group v-model:value="selectedRoles" :options="roleOptions" />
    </a-modal>

    <a-modal
      v-model:open="passwordModalOpen"
      :title="t('system.resetPassword')"
      @ok="submitPassword"
      :confirm-loading="saving"
    >
      <a-input-password v-model:value="newPassword" :placeholder="t('system.newPassword')" />
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  fetchAdminUsersPage,
  fetchRoles,
  resetUserPassword,
  updateUserRoles,
  updateUserStatus,
  type AdminUserRow,
  type RoleRow,
} from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { formatAdminTableCell } from '@/utils/adminTableColumns';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('web.sysUsers');

const { t } = useI18n();
const keyword = ref('');
const roles = ref<RoleRow[]>([]);
const rolesModalOpen = ref(false);
const passwordModalOpen = ref(false);
const saving = ref(false);
const currentUser = ref<AdminUserRow | null>(null);
const selectedRoles = ref<string[]>([]);
const newPassword = ref('');

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<AdminUserRow>((page, pageSize) =>
    fetchAdminUsersPage(page, pageSize, keyword.value.trim() || undefined),
  );

const roleOptions = computed(() => roles.value.map((r) => ({ label: r.name, value: r.code })));

const columns = computed<AdminExportColumn<AdminUserRow>[]>(() => [
  { title: t('system.colUsername'), dataIndex: 'username', width: 120 },
  { title: t('system.colNickname'), dataIndex: 'nickname', width: 120 },
  { title: t('system.colPhone'), dataIndex: 'phone', width: 130 },
  { title: t('system.colEmail'), dataIndex: 'email', ellipsis: true },
  {
    title: t('system.colRoles'),
    key: 'roles',
    width: 140,
    exportValue: (record) => record.roles.join(', '),
  },
  {
    title: t('system.colStatus'),
    key: 'status',
    width: 90,
    exportValue: (record) =>
      record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled'),
  },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'createdAt',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
  { title: t('system.colAction'), key: 'action', width: 300, fixed: 'right' },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchAdminUsersPage(page, pageSize, keyword.value.trim() || undefined),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  reload();
}

async function loadRoles() {
  try {
    roles.value = await fetchRoles();
  } catch {
    /* ignore */
  }
}

async function handleToggleStatus(record: AdminUserRow, checked: boolean) {
  try {
    await updateUserStatus(record.id, checked ? 1 : 0);
    message.success(t('common.success'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

function openRolesModal(record: AdminUserRow) {
  currentUser.value = record;
  selectedRoles.value = [...record.roles];
  rolesModalOpen.value = true;
}

function openPasswordModal(record: AdminUserRow) {
  currentUser.value = record;
  newPassword.value = '';
  passwordModalOpen.value = true;
}

async function submitRoles() {
  if (!currentUser.value) return;
  saving.value = true;
  try {
    await updateUserRoles(currentUser.value.id, selectedRoles.value);
    message.success(t('common.success'));
    rolesModalOpen.value = false;
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

async function submitPassword() {
  if (!currentUser.value || newPassword.value.length < 6) {
    message.warning(t('system.newPassword'));
    return;
  }
  saving.value = true;
  try {
    await resetUserPassword(currentUser.value.id, newPassword.value);
    message.success(t('common.success'));
    passwordModalOpen.value = false;
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadRoles();
  void load();
});
</script>
