<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
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
import type { TableColumnsType } from 'ant-design-vue';
import { fetchConfigs, updateConfig, type ConfigRow } from '@/api/system';
import { updateSiteOnline } from '@/api/site-status';
import { SystemConfigKey } from '@douxing/shared';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.sysConfig');

const { t } = useI18n();
const items = ref<ConfigRow[]>([]);
const loading = ref(false);
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<ConfigRow | null>(null);
const form = reactive({ configValue: '', remark: '' });
const MAINTENANCE_MODE_KEY = SystemConfigKey.MAINTENANCE_MODE;
const savingKey = ref<string | null>(null);

const columns = computed<TableColumnsType<ConfigRow>>(() => [
  { title: t('system.colConfigKey'), dataIndex: 'configKey', width: 180 },
  { title: t('system.colConfigValue'), key: 'configValue', dataIndex: 'configValue', ellipsis: true },
  { title: t('system.colRemark'), dataIndex: 'remark', ellipsis: true },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'updatedAt',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
  { title: t('system.colAction'), key: 'action', width: 120, fixed: 'right' },
]);

async function load() {
  loading.value = true;
  try {
    items.value = await fetchConfigs();
  } finally {
    loading.value = false;
  }
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
