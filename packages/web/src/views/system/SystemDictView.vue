<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="applyTypeFilter" @reset="resetTypeSearch">
        <a-form-item :label="t('system.colName')">
          <a-input
            v-model:value="typeSearch.dictName"
            :placeholder="t('system.searchDictName')"
            allow-clear
            style="width: 220px"
            @press-enter="applyTypeFilter"
          />
        </a-form-item>
        <a-form-item :label="t('system.colDictType')">
          <a-input
            v-model:value="typeSearch.dictType"
            :placeholder="t('system.searchDictType')"
            allow-clear
            style="width: 220px"
            @press-enter="applyTypeFilter"
          />
        </a-form-item>
        <a-form-item :label="t('system.colStatus')">
          <a-select
            v-model:value="typeSearch.status"
            :placeholder="t('system.dictStatusPlaceholder')"
            allow-clear
            style="width: 160px"
            :options="statusOptions"
          />
        </a-form-item>
        <a-form-item :label="t('system.colCreatedAt')">
          <a-range-picker
            v-model:value="typeSearch.dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            :placeholder="[t('common.dateRangeStart'), t('common.dateRangeEnd')]"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-button type="primary" @click="openTypeCreate">
            <template #icon><PlusOutlined /></template>
            {{ t('system.add') }}
          </a-button>
        </template>
        <template #right>
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="loadAll">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <div class="admin-split-panels">
      <div class="admin-sub-card">
        <div class="admin-sub-card-head">{{ t('system.colDictType') }}</div>
        <div class="admin-sub-card-body">
          <DouxingAdminTable
            :columns="typeColumns"
            :data-source="filteredDictTypes"
            :loading="loading"
            row-key="id"
            :pagination="false"
            :custom-row="typeRowProps"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">
                  {{ record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled') }}
                </a-tag>
              </template>
            </template>
          </DouxingAdminTable>
        </div>
      </div>
      <div class="admin-sub-card">
        <div class="admin-sub-card-head">
          <span>{{ selectedType ? selectedType.dictName : t('system.colDictLabel') }}</span>
          <a-button type="link" size="small" :disabled="!selectedType" @click="openDataCreate">
            {{ t('system.add') }}
          </a-button>
        </div>
        <div class="admin-sub-card-body">
          <DouxingAdminTable
            :columns="dataColumns"
            :data-source="dictData"
            :loading="dataLoading"
            row-key="id"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <TableActionBar
                  @edit="openDataEdit(record as DictDataRow)"
                  @delete="handleDeleteData(record as DictDataRow)"
                />
              </template>
            </template>
          </DouxingAdminTable>
        </div>
      </div>
    </div>

    <a-modal v-model:open="typeModalOpen" :title="t('system.add')" @ok="submitType" :confirm-loading="saving">
      <a-form layout="vertical">
        <a-form-item :label="t('system.colDictType')">
          <a-input v-model:value="typeForm.dictType" />
        </a-form-item>
        <a-form-item :label="t('system.colName')">
          <a-input v-model:value="typeForm.dictName" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="dataModalOpen"
      :title="dataEditing ? t('system.edit') : t('system.add')"
      @ok="submitData"
      :confirm-loading="saving"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('system.colDictLabel')">
          <a-input v-model:value="dataForm.dictLabel" />
        </a-form-item>
        <a-form-item :label="t('system.colDictValue')">
          <a-input v-model:value="dataForm.dictValue" />
        </a-form-item>
        <a-form-item :label="t('system.colSort')">
          <a-input-number v-model:value="dataForm.sortOrder" :min="0" class="w-full" />
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
import {
  createDictData,
  createDictType,
  deleteDictData,
  fetchDictData,
  fetchDictTypes,
  updateDictData,
  type DictDataRow,
  type DictTypeRow,
} from '@/api/system';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.sysDict');

const { t } = useI18n();
const loading = ref(false);
const dataLoading = ref(false);
const saving = ref(false);
const allDictTypes = ref<DictTypeRow[]>([]);
const dictData = ref<DictDataRow[]>([]);
const selectedType = ref<DictTypeRow | null>(null);
const typeModalOpen = ref(false);
const dataModalOpen = ref(false);
const dataEditing = ref<DictDataRow | null>(null);
const typeForm = reactive({ dictType: '', dictName: '' });
const dataForm = reactive({ dictLabel: '', dictValue: '', sortOrder: 0 });

const typeSearch = reactive<{
  dictName: string;
  dictType: string;
  status: number | undefined;
  dateRange: [string, string] | undefined;
}>({
  dictName: '',
  dictType: '',
  status: undefined,
  dateRange: undefined,
});

const appliedTypeSearch = ref({ ...typeSearch });

const statusOptions = computed(() => [
  { label: t('system.statusNormal'), value: 1 },
  { label: t('system.statusDisabled'), value: 0 },
]);

const filteredDictTypes = computed(() => {
  const filters = appliedTypeSearch.value;
  const nameKeyword = filters.dictName.trim().toLowerCase();
  const typeKeyword = filters.dictType.trim().toLowerCase();
  const [startDate, endDate] = filters.dateRange ?? [];

  return allDictTypes.value.filter((row) => {
    if (nameKeyword && !row.dictName.toLowerCase().includes(nameKeyword)) return false;
    if (typeKeyword && !row.dictType.toLowerCase().includes(typeKeyword)) return false;
    if (filters.status != null && row.status !== filters.status) return false;
    if (startDate || endDate) {
      const created = row.createdAt.slice(0, 10);
      if (startDate && created < startDate) return false;
      if (endDate && created > endDate) return false;
    }
    return true;
  });
});

const typeColumns = computed(() => [
  { title: t('system.colDictType'), dataIndex: 'dictType', width: 160 },
  { title: t('system.colName'), dataIndex: 'dictName', width: 140 },
  { title: t('system.colStatus'), key: 'status', width: 90 },
  {
    title: t('system.colCreatedAt'),
    dataIndex: 'createdAt',
    width: 160,
    customRender: ({ text }: { text: string }) => String(text).slice(0, 16).replace('T', ' '),
  },
]);

const dataColumns = computed(() => [
  { title: t('system.colDictLabel'), dataIndex: 'dictLabel', width: 140 },
  { title: t('system.colDictValue'), dataIndex: 'dictValue', width: 100 },
  { title: t('system.colSort'), dataIndex: 'sortOrder', width: 70 },
  { title: t('system.colAction'), key: 'action', width: 160, fixed: 'right' as const },
]);

function applyTypeFilter() {
  appliedTypeSearch.value = {
    dictName: typeSearch.dictName,
    dictType: typeSearch.dictType,
    status: typeSearch.status,
    dateRange: typeSearch.dateRange,
  };
  if (!filteredDictTypes.value.some((row) => row.id === selectedType.value?.id)) {
    const next = filteredDictTypes.value[0];
    if (next) {
      void selectType(next);
      return;
    }
    selectedType.value = null;
    dictData.value = [];
  }
}

function resetTypeSearch() {
  typeSearch.dictName = '';
  typeSearch.dictType = '';
  typeSearch.status = undefined;
  typeSearch.dateRange = undefined;
  appliedTypeSearch.value = { ...typeSearch };
  if (filteredDictTypes.value[0]) {
    void selectType(filteredDictTypes.value[0]);
  } else {
    selectedType.value = null;
    dictData.value = [];
  }
}

function typeRowProps(record: DictTypeRow) {
  return {
    onClick: () => selectType(record),
    class: selectedType.value?.id === record.id ? 'ant-table-row-selected' : '',
  };
}

async function loadTypes() {
  loading.value = true;
  try {
    allDictTypes.value = await fetchDictTypes();
    if (!selectedType.value && filteredDictTypes.value[0]) {
      await selectType(filteredDictTypes.value[0]);
    }
  } finally {
    loading.value = false;
  }
}

async function selectType(record: DictTypeRow) {
  selectedType.value = record;
  dataLoading.value = true;
  try {
    dictData.value = await fetchDictData(record.dictType);
  } finally {
    dataLoading.value = false;
  }
}

async function loadAll() {
  await loadTypes();
  if (selectedType.value) await selectType(selectedType.value);
}

function openTypeCreate() {
  typeForm.dictType = '';
  typeForm.dictName = '';
  typeModalOpen.value = true;
}

async function submitType() {
  saving.value = true;
  try {
    await createDictType({ ...typeForm });
    message.success(t('common.success'));
    typeModalOpen.value = false;
    await loadTypes();
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

function openDataCreate() {
  dataEditing.value = null;
  dataForm.dictLabel = '';
  dataForm.dictValue = '';
  dataForm.sortOrder = 0;
  dataModalOpen.value = true;
}

function openDataEdit(record: DictDataRow) {
  dataEditing.value = record;
  dataForm.dictLabel = record.dictLabel;
  dataForm.dictValue = record.dictValue;
  dataForm.sortOrder = record.sortOrder;
  dataModalOpen.value = true;
}

async function submitData() {
  if (!selectedType.value) return;
  saving.value = true;
  try {
    if (dataEditing.value) {
      await updateDictData(dataEditing.value.id, { ...dataForm });
    } else {
      await createDictData({ dictType: selectedType.value.dictType, ...dataForm });
    }
    message.success(t('common.success'));
    dataModalOpen.value = false;
    await selectType(selectedType.value);
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

async function handleDeleteData(record: DictDataRow) {
  try {
    await deleteDictData(record.id);
    message.success(t('common.success'));
    if (selectedType.value) await selectType(selectedType.value);
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  }
}

onMounted(loadTypes);
</script>

<style scoped>
:deep(.ant-table-row-selected) > td {
  background: var(--color-primary-light) !important;
}
</style>
