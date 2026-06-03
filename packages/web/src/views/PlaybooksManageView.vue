<template>
  <PageContainer :title="t('playbooks.title')" :description="t('playbooks.desc')">
    <template #extra>
      <a-space>
        <a-button :loading="loading" @click="loadList">{{ t('common.refresh') }}</a-button>
        <a-button type="primary" @click="openCreate">{{ t('playbooks.create') }}</a-button>
      </a-space>
    </template>

    <a-space class="filters" wrap>
      <a-input-search
        v-model:value="keyword"
        :placeholder="t('playbooks.searchPlaceholder')"
        style="width: 280px"
        @search="loadList"
      />
      <a-input
        v-model:value="cityFilter"
        :placeholder="t('playbooks.cityFilter')"
        style="width: 140px"
        @press-enter="loadList"
      />
      <a-button :loading="loading" @click="loadList">{{ t('common.search') }}</a-button>
    </a-space>

    <DouxingAdminTable
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :error="error"
      :empty-text="t('playbooks.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'id'">
          <code>{{ record.id }}</code>
        </template>
        <template v-else-if="column.key === 'themes'">
          {{ record.themes.join('、') }}
        </template>
        <template v-else-if="column.key === 'order'">
          {{ record.classicOrder.length }}
        </template>
        <template v-else-if="column.key === 'enabled'">
          <a-tag :color="record.enabled ? 'success' : 'default'">
            {{ record.enabled ? t('playbooks.enabledYes') : t('playbooks.enabledNo') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(record)">
              {{ t('common.edit') }}
            </a-button>
            <a-popconfirm
              :title="t('playbooks.deleteConfirm', { id: record.id })"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>{{ t('common.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="editorOpen"
      :title="editingId ? t('playbooks.editTitle') : t('playbooks.createTitle')"
      width="640px"
      :footer="null"
      @cancel="closeEditor"
    >
      <a-steps :current="formStep" size="small" class="form-steps">
        <a-step :title="t('playbooks.stepBasic')" />
        <a-step :title="t('playbooks.stepContent')" />
        <a-step :title="t('playbooks.stepAdvanced')" />
      </a-steps>

      <a-form layout="vertical" class="form-body">
        <template v-if="formStep === 0">
          <a-form-item v-if="!editingId" :label="t('playbooks.fieldId')" required>
            <a-input v-model:value="form.id" :placeholder="t('playbooks.fieldIdHint')" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldCity')" required>
            <a-input v-model:value="form.city" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldScope')" required>
            <a-input v-model:value="form.scope" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldKeywords')">
            <a-input v-model:value="form.keywordsText" :placeholder="t('playbooks.commaSeparated')" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldThemes')">
            <a-input v-model:value="form.themesText" :placeholder="t('playbooks.commaSeparated')" />
          </a-form-item>
        </template>

        <template v-else-if="formStep === 1">
          <a-form-item :label="t('playbooks.fieldClassicOrder')" required>
            <a-textarea v-model:value="form.classicOrderText" :rows="5" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldSummaryZh')" required>
            <a-textarea v-model:value="form.summaryZh" :rows="4" />
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldSummaryEn')" required>
            <a-textarea v-model:value="form.summaryEn" :rows="4" />
          </a-form-item>
        </template>

        <template v-else>
          <a-form-item :label="t('playbooks.fieldSegments')">
            <a-textarea v-model:value="form.segmentsJson" :rows="8" :placeholder="t('playbooks.segmentsHint')" />
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="form.enabled">{{ t('playbooks.fieldEnabled') }}</a-checkbox>
          </a-form-item>
          <a-form-item :label="t('playbooks.fieldSortOrder')">
            <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
          </a-form-item>
        </template>

        <a-alert v-if="formError" type="error" :message="formError" show-icon />
      </a-form>

      <div class="modal-footer">
        <a-space>
          <a-button v-if="formStep > 0" @click="formStep -= 1">{{ t('playbooks.stepPrev') }}</a-button>
          <a-button @click="closeEditor">{{ t('common.cancel') }}</a-button>
          <a-button v-if="formStep < 2" type="primary" @click="formStep += 1">
            {{ t('playbooks.stepNext') }}
          </a-button>
          <a-button v-else type="primary" :loading="saving" @click="handleSave">
            {{ t('common.save') }}
          </a-button>
        </a-space>
      </div>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import type { RoutePlaybookInfo, RoutePlaybookSegmentEdge } from '@douxing/shared';
import {
  createPlaybook,
  deletePlaybook,
  fetchAdminPlaybooksPage,
  updatePlaybook,
} from '@/api/playbooks';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import { getAppErrorMessage } from '@/utils/error-message';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.playbooksManage');

const { t } = useI18n();
const keyword = ref('');
const cityFilter = ref('');
const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination((page, pageSize) =>
    fetchAdminPlaybooksPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      city: cityFilter.value.trim() || undefined,
    }),
  );
const saving = ref(false);
const error = ref('');
const formError = ref('');
const editorOpen = ref(false);
const editingId = ref<string | null>(null);
const formStep = ref(0);

const form = reactive({
  id: '',
  city: '',
  scope: '',
  keywordsText: '',
  themesText: '',
  classicOrderText: '',
  summaryZh: '',
  summaryEn: '',
  segmentsJson: '[]',
  enabled: true,
  sortOrder: 0,
});

function splitCsv(text: string): string[] {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resetForm() {
  form.id = '';
  form.city = '';
  form.scope = '';
  form.keywordsText = '';
  form.themesText = '';
  form.classicOrderText = '';
  form.summaryZh = '';
  form.summaryEn = '';
  form.segmentsJson = '[]';
  form.enabled = true;
  form.sortOrder = 0;
  formError.value = '';
  formStep.value = 0;
}

function fillForm(item: RoutePlaybookInfo) {
  form.id = item.id;
  form.city = item.city;
  form.scope = item.scope;
  form.keywordsText = item.keywords.join('、');
  form.themesText = item.themes.join('、');
  form.classicOrderText = item.classicOrder.join('\n');
  form.summaryZh = item.summaryZh;
  form.summaryEn = item.summaryEn;
  form.segmentsJson = JSON.stringify(item.segments, null, 2);
  form.enabled = item.enabled;
  form.sortOrder = item.sortOrder;
  formStep.value = 0;
}

function openCreate() {
  editingId.value = null;
  resetForm();
  editorOpen.value = true;
}

function openEdit(item: RoutePlaybookInfo) {
  editingId.value = item.id;
  fillForm(item);
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
  formError.value = '';
  formStep.value = 0;
}

async function loadList() {
  error.value = '';
  reload();
}

function buildPayload(): RoutePlaybookInfo | null {
  let segments: RoutePlaybookSegmentEdge[] = [];
  try {
    segments = JSON.parse(form.segmentsJson || '[]') as RoutePlaybookSegmentEdge[];
    if (!Array.isArray(segments)) throw new Error('not array');
  } catch {
    formError.value = t('playbooks.segmentsInvalid');
    return null;
  }

  const classicOrder = splitLines(form.classicOrderText);
  if (classicOrder.length === 0) {
    formError.value = t('playbooks.classicOrderRequired');
    return null;
  }

  return {
    id: form.id.trim(),
    city: form.city.trim(),
    scope: form.scope.trim(),
    keywords: splitCsv(form.keywordsText),
    themes: splitCsv(form.themesText),
    classicOrder,
    segments,
    summaryZh: form.summaryZh.trim(),
    summaryEn: form.summaryEn.trim(),
    enabled: form.enabled,
    sortOrder: form.sortOrder,
  };
}

async function handleSave() {
  formError.value = '';
  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;
  try {
    if (editingId.value) {
      const { id: _id, ...rest } = payload;
      await updatePlaybook(editingId.value, rest);
    } else {
      await createPlaybook(payload);
    }
    closeEditor();
    await loadList();
  } catch (e) {
    formError.value = getAppErrorMessage(e, t('playbooks.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function handleDelete(item: RoutePlaybookInfo) {
  error.value = '';
  try {
    await deletePlaybook(item.id);
    await loadList();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('playbooks.deleteFailed'));
  }
}

const columns = computed<TableColumnsType<RoutePlaybookInfo>>(() => [
  { title: t('playbooks.colId'), key: 'id', width: 160 },
  { title: t('playbooks.colCity'), dataIndex: 'city', width: 100 },
  { title: t('playbooks.colScope'), dataIndex: 'scope', ellipsis: true },
  { title: t('playbooks.colThemes'), key: 'themes', ellipsis: true },
  { title: t('playbooks.colOrder'), key: 'order', width: 80 },
  { title: t('playbooks.colEnabled'), key: 'enabled', width: 80 },
  { title: t('playbooks.colAction'), key: 'action', width: 140 },
]);

onMounted(load);
</script>

<style scoped>
.filters {
  margin-bottom: 16px;
}

.form-steps {
  margin-bottom: 20px;
}

.form-body {
  min-height: 280px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
