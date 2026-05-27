<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ t('attractions.title') }}</h2>
        <p class="desc">{{ t('attractions.desc') }}</p>
      </div>
      <button class="btn-refresh" :disabled="loading" @click="loadList">{{ t('common.refresh') }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>{{ t('attractions.colName') }}</th>
          <th>{{ t('attractions.colCity') }}</th>
          <th>{{ t('attractions.colType') }}</th>
          <th>{{ t('attractions.colCoord') }}</th>
          <th>{{ t('attractions.colSource') }}</th>
          <th>{{ t('attractions.colPrice') }}</th>
          <th>{{ t('attractions.colAction') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id">
          <td>{{ item.id }}</td>
          <td>
            <div class="name-cell">
              <span>{{ item.name }}</span>
              <small v-if="item.description" class="sub">{{ item.description }}</small>
            </div>
          </td>
          <td>{{ item.city }}</td>
          <td>{{ categoryLabel(item.category) }}</td>
          <td>
            <span v-if="hasCoords(item)" class="coord ok">
              {{ formatCoord(item.latitude!) }}, {{ formatCoord(item.longitude!) }}
            </span>
            <span v-else class="coord warn">{{ t('attractions.missingCoord') }}</span>
          </td>
          <td>{{ sourceLabel(item.source) }}</td>
          <td>{{ item.ticketPrice > 0 ? `¥${item.ticketPrice}` : '-' }}</td>
          <td>
            <button
              class="btn-approve"
              :disabled="approvingId === item.id"
              @click="handleApprove(item)"
            >
              {{ approvingId === item.id ? t('attractions.approving') : t('attractions.approve') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!loading && !error" class="empty">{{ t('attractions.empty') }}</p>
    <p v-if="loading" class="loading">{{ t('common.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AttractionInfo } from '@douxing/shared';
import { approveAttraction, fetchPendingAttractions } from '@/api/attractions';

const { t } = useI18n();
const list = ref<AttractionInfo[]>([]);
const loading = ref(false);
const error = ref('');
const approvingId = ref<number | null>(null);

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    attraction: t('attractions.typeAttraction'),
    restaurant: t('attractions.typeRestaurant'),
    hotel: t('attractions.typeHotel'),
  };
  return map[category] ?? category;
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    seed: t('attractions.sourceSeed'),
    llm: t('attractions.sourceLlm'),
    manual: t('attractions.sourceManual'),
    amap: t('attractions.sourceAmap'),
  };
  return map[source] ?? source;
}

function hasCoords(item: AttractionInfo) {
  return item.latitude != null && item.longitude != null;
}

function formatCoord(value: number) {
  return value.toFixed(4);
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    list.value = await fetchPendingAttractions();
  } catch (e) {
    list.value = [];
    error.value = e instanceof Error ? e.message : t('common.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function handleApprove(item: AttractionInfo) {
  if (!hasCoords(item)) {
    const ok = window.confirm(t('attractions.approveConfirm', { name: item.name }));
    if (!ok) return;
  }

  approvingId.value = item.id;
  error.value = '';
  try {
    await approveAttraction(item.id);
    list.value = list.value.filter((row) => row.id !== item.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('attractions.approveFailed');
  } finally {
    approvingId.value = null;
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
  margin-bottom: 24px;
}
.desc {
  color: #6b7280;
  margin-top: 8px;
}
.btn-refresh {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
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
.coord.ok {
  color: #059669;
}
.coord.warn {
  color: #d97706;
  font-weight: 500;
}
.btn-approve {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: #1677ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn-approve:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
