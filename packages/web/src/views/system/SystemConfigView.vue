<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colConfigKey')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchConfigKeyword')"
            allow-clear
            style="width: 280px"
            @press-enter="load"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton :columns="columns" :rows="items" name-key="web.sysConfig" />
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
        <template v-if="column.key === 'configValue' && record.configKey === MAINTENANCE_MODE_KEY">
          <a-switch
            :checked="isMaintenanceConfigOnline(record.configValue)"
            :loading="savingKey === record.configKey"
            :checked-children="t('system.siteOnline')"
            :un-checked-children="t('system.siteOffline')"
            @change="(checked) => toggleMaintenance(record, checked === true)"
          />
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-delete="false" @edit="openEdit(record)" />
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal v-model:open="modalOpen" :title="t('system.edit')" @ok="submit" :confirm-loading="saving">
      <a-form layout="vertical">
        <a-form-item :label="t('system.colConfigKey')">
          <a-input :value="editing?.configKey" disabled />
        </a-form-item>
        <a-form-item :label="t('system.colConfigValue')">
          <a-input v-model:value="form.configValue" />
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
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchConfigs, updateConfig, type ConfigRow } from '@/api/system';
import { updateSiteOnline } from '@/api/site-status';
import { SystemConfigKey } from '@douxing/shared';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';

usePageTitle('web.sysConfig');

const { t } = useI18n();
const keyword = ref('');
const items = ref<ConfigRow[]>([]);
const loading = ref(false);
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<ConfigRow | null>(null);
const form = reactive({ configValue: '', remark: '' });
const MAINTENANCE_MODE_KEY = SystemConfigKey.MAINTENANCE_MODE;
const savingKey = ref<string | null>(null);

const columns = computed<AdminExportColumn<ConfigRow>[]>(() => [
  { title: t('system.colConfigKey'), dataIndex: 'configKey', width: 180 },
  {
    title: t('system.colConfigValue'),
    key: 'configValue',
    dataIndex: 'configValue',
    ellipsis: true,
    exportValue: (record) =>
      record.configKey === MAINTENANCE_MODE_KEY
        ? isMaintenanceConfigOnline(record.configValue)
          ? t('system.siteOnline')
          : t('system.siteOffline')
        : record.configValue,
  },
  { title: t('system.colRemark'), dataIndex: 'remark', ellipsis: true },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'updatedAt',
    width: 180,
  },
  { title: t('system.colAction'), key: 'action', width: 120, fixed: 'right' },
]);

async function load() {
  loading.value = true;
  try {
    items.value = await fetchConfigs({
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

function isMaintenanceConfigOnline(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !(normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on');
}

function openEdit(record: ConfigRow) {
  editing.value = record;
  form.configValue = record.configValue;
  form.remark = record.remark ?? '';
  modalOpen.value = true;
}

async function submit() {
  if (!editing.value) return;
  saving.value = true;
  try {
    await updateConfig(editing.value.id, form.configValue, form.remark);
    message.success(t('common.success'));
    modalOpen.value = false;
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

async function toggleMaintenance(record: ConfigRow, online: boolean) {
  savingKey.value = record.configKey;
  try {
    await updateSiteOnline(online);
    message.success(t('system.siteStatusUpdated'));
    await load();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    savingKey.value = null;
  }
}

onMounted(load);
</script>
