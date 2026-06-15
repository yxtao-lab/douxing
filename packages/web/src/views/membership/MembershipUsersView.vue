<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('membershipAdmin.colKeyword')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('membershipAdmin.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colLevel')">
          <a-select
            v-model:value="levelFilter"
            :options="levelOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('membershipAdmin.allLevels')"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
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
      :empty-text="t('membershipAdmin.emptyUsers')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'memberLevel'">
          {{ memberLevelLabel(record.memberLevel) }}
        </template>
        <template v-else-if="column.key === 'effectiveLevel'">
          <a-tag :color="record.isExpired ? 'default' : 'processing'">
            {{ memberLevelLabel(record.effectiveLevel) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'memberExpiresAt'">
          <span v-if="record.memberExpiresAt">
            {{ formatDate(record.memberExpiresAt) }}
            <a-tag v-if="record.isExpired" color="error" style="margin-left: 4px">
              {{ t('membershipAdmin.expired') }}
            </a-tag>
          </span>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="edit"
              :label="t('membershipAdmin.adjust')"
              @click="openEditModal(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="editModalOpen"
      :title="t('membershipAdmin.adjustTitle')"
      @ok="submitEdit"
      :confirm-loading="saving"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('membershipAdmin.colUsername')">
          <a-input :value="currentUser?.username" disabled />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colLevel')">
          <a-select v-model:value="editLevel" :options="levelOptionsWithoutAll" />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colExpiresAt')">
          <a-date-picker
            v-model:value="editExpiresAt"
            show-time
            style="width: 100%"
            :placeholder="t('membershipAdmin.expiresPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colRemark')">
          <a-textarea v-model:value="editRemark" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import {
  MemberLevel,
  getMemberLevelI18nKey,
  type AdminMembershipUserRow,
} from '@douxing/shared';
import { fetchMembershipUsersPage, updateMembershipUser } from '@/api/membership';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.membershipUsers');

const { t } = useI18n();
const keyword = ref('');
const levelFilter = ref<number | undefined>(undefined);
const editModalOpen = ref(false);
const saving = ref(false);
const currentUser = ref<AdminMembershipUserRow | null>(null);
const editLevel = ref<number>(MemberLevel.FREE);
const editExpiresAt = ref<Dayjs | undefined>(undefined);
const editRemark = ref('');

const levelOptions = computed(() => [
  { label: t('membershipAdmin.allLevels'), value: undefined },
  { label: t(getMemberLevelI18nKey(MemberLevel.FREE)), value: MemberLevel.FREE },
  { label: t(getMemberLevelI18nKey(MemberLevel.SILVER)), value: MemberLevel.SILVER },
  { label: t(getMemberLevelI18nKey(MemberLevel.GOLD)), value: MemberLevel.GOLD },
  { label: t(getMemberLevelI18nKey(MemberLevel.VIP)), value: MemberLevel.VIP },
]);

const levelOptionsWithoutAll = computed(() => levelOptions.value.filter((item) => item.value !== undefined));

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<AdminMembershipUserRow>((page, pageSize) =>
    fetchMembershipUsersPage(page, pageSize, {
      keyword: keyword.value.trim() || undefined,
      level: levelFilter.value,
    }),
  );

const columns = computed<TableColumnsType<AdminMembershipUserRow>>(() => [
  { title: t('membershipAdmin.colUsername'), dataIndex: 'username', width: 120 },
  { title: t('membershipAdmin.colNickname'), dataIndex: 'nickname', width: 120 },
  { title: t('membershipAdmin.colPhone'), dataIndex: 'phone', width: 130 },
  { title: t('membershipAdmin.colStoredLevel'), key: 'memberLevel', width: 110 },
  { title: t('membershipAdmin.colEffectiveLevel'), key: 'effectiveLevel', width: 120 },
  { title: t('membershipAdmin.colExpiresAt'), key: 'memberExpiresAt', width: 180 },
  {
    title: t('membershipAdmin.colCreatedAt'),
    dataIndex: 'createdAt',
    width: 160,
    customRender: ({ text }) => formatDate(String(text)),
  },
  { title: t('membershipAdmin.colAction'), key: 'action', width: 120, fixed: 'right' },
]);

function memberLevelLabel(level: number) {
  return t(getMemberLevelI18nKey(level));
}

function formatDate(value: string) {
  return value.slice(0, 16).replace('T', ' ');
}

function resetSearch() {
  keyword.value = '';
  levelFilter.value = undefined;
  reload();
}

function openEditModal(record: AdminMembershipUserRow) {
  currentUser.value = record;
  editLevel.value = record.memberLevel;
  editExpiresAt.value = record.memberExpiresAt ? dayjs(record.memberExpiresAt) : undefined;
  editRemark.value = '';
  editModalOpen.value = true;
}

async function submitEdit() {
  if (!currentUser.value) return;
  saving.value = true;
  try {
    await updateMembershipUser(currentUser.value.id, {
      memberLevel: editLevel.value,
      memberExpiresAt: editLevel.value > MemberLevel.FREE
        ? editExpiresAt.value?.toISOString() ?? null
        : null,
      remark: editRemark.value.trim() || undefined,
    });
    message.success(t('membershipAdmin.updateSuccess'));
    editModalOpen.value = false;
    await reload();
  } catch {
    message.error(t('membershipAdmin.updateFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
