<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ t('playbooks.title') }}</h2>
        <p class="desc">{{ t('playbooks.desc') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn-secondary" :disabled="loading" @click="loadList">{{ t('common.refresh') }}</button>
        <button class="btn-primary" @click="openCreate">{{ t('playbooks.create') }}</button>
      </div>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        class="filter-input"
        :placeholder="t('playbooks.searchPlaceholder')"
        @keyup.enter="loadList"
      />
      <input v-model="cityFilter" class="filter-input narrow" :placeholder="t('playbooks.cityFilter')" />
      <button class="btn-search" :disabled="loading" @click="loadList">{{ t('common.search') }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>{{ t('playbooks.colId') }}</th>
          <th>{{ t('playbooks.colCity') }}</th>
          <th>{{ t('playbooks.colScope') }}</th>
          <th>{{ t('playbooks.colThemes') }}</th>
          <th>{{ t('playbooks.colOrder') }}</th>
          <th>{{ t('playbooks.colEnabled') }}</th>
          <th>{{ t('playbooks.colAction') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id">
          <td><code>{{ item.id }}</code></td>
          <td>{{ item.city }}</td>
          <td>{{ item.scope }}</td>
          <td>{{ item.themes.join('、') }}</td>
          <td>{{ item.classicOrder.length }}</td>
          <td>{{ item.enabled ? t('playbooks.enabledYes') : t('playbooks.enabledNo') }}</td>
          <td>
            <div class="action-cell">
              <button class="btn-link" type="button" @click="openEdit(item)">{{ t('common.edit') }}</button>
              <button class="btn-link danger" type="button" @click="handleDelete(item)">
                {{ t('common.delete') }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!loading && !error" class="empty">{{ t('playbooks.empty') }}</p>
    <p v-if="loading" class="loading">{{ t('common.loading') }}</p>

    <div v-if="editorOpen" class="modal-backdrop" @click.self="closeEditor">
      <div class="modal">
        <h3>{{ editingId ? t('playbooks.editTitle') : t('playbooks.createTitle') }}</h3>
        <form class="form" @submit.prevent="handleSave">
          <label v-if="!editingId">
            <span>{{ t('playbooks.fieldId') }}</span>
            <input v-model="form.id" required pattern="[a-z0-9-]+" :placeholder="t('playbooks.fieldIdHint')" />
          </label>
          <label>
            <span>{{ t('playbooks.fieldCity') }}</span>
            <input v-model="form.city" required />
          </label>
          <label>
            <span>{{ t('playbooks.fieldScope') }}</span>
            <input v-model="form.scope" required />
          </label>
          <label>
            <span>{{ t('playbooks.fieldKeywords') }}</span>
            <input v-model="form.keywordsText" :placeholder="t('playbooks.commaSeparated')" />
          </label>
          <label>
            <span>{{ t('playbooks.fieldThemes') }}</span>
            <input v-model="form.themesText" :placeholder="t('playbooks.commaSeparated')" />
          </label>
          <label>
            <span>{{ t('playbooks.fieldClassicOrder') }}</span>
            <textarea v-model="form.classicOrderText" rows="4" required />
          </label>
          <label>
            <span>{{ t('playbooks.fieldSummaryZh') }}</span>
            <textarea v-model="form.summaryZh" rows="3" required />
          </label>
          <label>
            <span>{{ t('playbooks.fieldSummaryEn') }}</span>
            <textarea v-model="form.summaryEn" rows="3" required />
          </label>
          <label>
            <span>{{ t('playbooks.fieldSegments') }}</span>
            <textarea v-model="form.segmentsJson" rows="8" :placeholder="t('playbooks.segmentsHint')" />
          </label>
          <label class="inline">
            <input v-model="form.enabled" type="checkbox" />
            <span>{{ t('playbooks.fieldEnabled') }}</span>
          </label>
          <label>
            <span>{{ t('playbooks.fieldSortOrder') }}</span>
            <input v-model.number="form.sortOrder" type="number" min="0" />
          </label>
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeEditor">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoutePlaybookInfo, RoutePlaybookSegmentEdge } from '@douxing/shared';
import {
  createPlaybook,
  deletePlaybook,
  fetchAdminPlaybooks,
  updatePlaybook,
} from '@/api/playbooks';
import { getAppErrorMessage } from '@/utils/error-message';

const { t } = useI18n();
const list = ref<RoutePlaybookInfo[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const keyword = ref('');
const cityFilter = ref('');
const editorOpen = ref(false);
const editingId = ref<string | null>(null);

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
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    list.value = await fetchAdminPlaybooks({
      keyword: keyword.value.trim() || undefined,
      city: cityFilter.value.trim() || undefined,
      limit: 100,
    });
  } catch (e) {
    list.value = [];
    error.value = getAppErrorMessage(e, t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
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
  if (!window.confirm(t('playbooks.deleteConfirm', { id: item.id }))) return;
  error.value = '';
  try {
    await deletePlaybook(item.id);
    await loadList();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('playbooks.deleteFailed'));
  }
}

onMounted(loadList);
</script>

<style scoped>
.page {
  max-width: 1200px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.desc {
  color: #6b7280;
  margin-top: 8px;
}
.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.filter-input {
  flex: 1;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}
.filter-input.narrow {
  max-width: 140px;
}
.btn-search,
.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #d1d5db;
}
.btn-primary {
  background: #1677ff;
  color: #fff;
  border-color: #1677ff;
}
.btn-secondary {
  background: #fff;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.table th,
.table td {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
  vertical-align: top;
}
.action-cell {
  display: flex;
  gap: 12px;
}
.btn-link {
  background: none;
  border: none;
  color: #1677ff;
  cursor: pointer;
  padding: 0;
}
.btn-link.danger {
  color: #dc2626;
}
.error {
  color: #dc2626;
  margin-bottom: 12px;
}
.empty,
.loading {
  color: #6b7280;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: min(640px, 100%);
  max-height: 90vh;
  overflow: auto;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 14px;
}
.form label.inline {
  flex-direction: row;
  align-items: center;
}
.form input,
.form textarea {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font: inherit;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
