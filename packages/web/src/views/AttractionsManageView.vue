<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ t('attractions.manageTitle') }}</h2>
        <p class="desc">{{ t('attractions.manageDesc') }}</p>
      </div>
      <button class="btn-refresh" :disabled="loading" @click="loadList">{{ t('common.refresh') }}</button>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        class="filter-input"
        :placeholder="t('attractions.searchPlaceholder')"
        @keyup.enter="loadList"
      />
      <button class="btn-search" :disabled="loading" @click="loadList">{{ t('common.search') }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>{{ t('attractions.colCover') }}</th>
          <th>{{ t('attractions.colName') }}</th>
          <th>{{ t('attractions.colCity') }}</th>
          <th>{{ t('attractions.colImageSource') }}</th>
          <th>{{ t('attractions.colAction') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id">
          <td>
            <div class="cover-cell">
              <img v-if="item.coverImageUrl" :src="item.coverImageUrl" class="cover-thumb" alt="" />
              <span v-else class="cover-empty">{{ t('attractions.noCover') }}</span>
            </div>
          </td>
          <td>
            <div class="name-cell">
              <span>{{ item.name }}</span>
              <small v-if="item.description" class="sub">{{ item.description }}</small>
            </div>
          </td>
          <td>{{ item.city }}</td>
          <td>{{ imageSourceLabel(item.imageSource) }}</td>
          <td>
            <div class="action-cell">
              <label class="btn-upload">
                <input
                  type="file"
                  accept="image/*"
                  class="file-input"
                  :disabled="uploadingId === item.id || refreshingId === item.id"
                  @change="(e) => handleUpload(item, e)"
                />
                {{
                  uploadingId === item.id
                    ? t('attractions.uploadingCover')
                    : t('attractions.uploadCover')
                }}
              </label>
              <button
                v-if="item.imageSource !== 'manual'"
                class="btn-refresh-cover"
                type="button"
                :disabled="uploadingId === item.id || refreshingId === item.id"
                @click="handleRefreshCover(item)"
              >
                {{
                  refreshingId === item.id
                    ? t('attractions.refreshingCover')
                    : t('attractions.refreshCover')
                }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!loading && !error" class="empty">{{ t('attractions.manageEmpty') }}</p>
    <p v-if="loading" class="loading">{{ t('common.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AttractionInfo } from '@douxing/shared';
import { fetchAdminAttractionCatalog, uploadAttractionCover, refreshAttractionCoverFromAmap } from '@/api/attractions';
import { getAppErrorMessage } from '@/utils/error-message';

const { t } = useI18n();
const list = ref<AttractionInfo[]>([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');
const uploadingId = ref<number | null>(null);
const refreshingId = ref<number | null>(null);

function imageSourceLabel(source?: string | null) {
  if (!source) return t('attractions.imageSourceNone');
  const map: Record<string, string> = {
    manual: t('attractions.imageSourceManual'),
    amap: t('attractions.imageSourceAmap'),
    wikimedia: t('attractions.imageSourceWikimedia'),
    ugc: t('attractions.imageSourceUgc'),
    generated: t('attractions.imageSourceGenerated'),
  };
  return map[source] ?? source;
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    list.value = await fetchAdminAttractionCatalog({
      keyword: keyword.value.trim() || undefined,
      limit: 100,
    });
  } catch (e) {
    list.value = [];
    error.value = getAppErrorMessage(e, t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleRefreshCover(item: AttractionInfo) {
  refreshingId.value = item.id;
  error.value = '';
  try {
    const updated = await refreshAttractionCoverFromAmap(item.id);
    list.value = list.value.map((row) => (row.id === item.id ? updated : row));
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.refreshCoverFailed'));
  } finally {
    refreshingId.value = null;
  }
}

async function handleUpload(item: AttractionInfo, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  uploadingId.value = item.id;
  error.value = '';
  try {
    const updated = await uploadAttractionCover(item.id, file);
    list.value = list.value.map((row) => (row.id === item.id ? updated : row));
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.uploadCoverFailed'));
  } finally {
    uploadingId.value = null;
  }
}

onMounted(loadList);
</script>

<style scoped>
.page {
  max-width: 1100px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
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
.btn-search,
.btn-refresh {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.btn-search:disabled,
.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
th,
td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  vertical-align: top;
}
th {
  background: #f9fafb;
  font-weight: 600;
}
.cover-cell {
  width: 72px;
}
.cover-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.cover-empty {
  color: #9ca3af;
  font-size: 12px;
}
.name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sub {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
}
.action-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.btn-refresh-cover {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  cursor: pointer;
  font-size: 13px;
}
.btn-refresh-cover:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-upload {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 6px;
  background: #1677ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.file-input {
  display: none;
}
.error {
  color: #dc2626;
  margin-bottom: 16px;
}
.empty,
.loading {
  color: #9ca3af;
}
</style>
