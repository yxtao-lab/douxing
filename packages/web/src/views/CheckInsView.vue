<template>
  <div class="checkins-page">
    <div class="page-head">
      <h2>{{ t('checkins.title') }}</h2>
      <router-link class="map-link" to="/checkins/map">{{ t('checkins.mapLink') }}</router-link>
    </div>
    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>{{ t('checkins.colUser') }}</th>
          <th>{{ t('checkins.colRoute') }}</th>
          <th>{{ t('checkins.colPlace') }}</th>
          <th>{{ t('checkins.colCity') }}</th>
          <th>{{ t('checkins.colPoints') }}</th>
          <th>{{ t('checkins.colPhotos') }}</th>
          <th>{{ t('checkins.colTime') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td>{{ c.userId }}</td>
          <td>{{ c.routeId }}</td>
          <td>{{ c.location.placeName || '-' }}</td>
          <td>{{ c.city || c.cityCode }}</td>
          <td>{{ c.pointsEarned }}</td>
          <td>{{ photoLabel(c.photos.length) }}</td>
          <td>{{ c.checkedAt.slice(0, 16).replace('T', ' ') }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">{{ t('checkins.empty') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CheckInInfo } from '@douxing/shared';
import { fetchAllCheckIns } from '@/api/checkins';

const { t } = useI18n();
const list = ref<CheckInInfo[]>([]);

function photoLabel(count: number) {
  return count > 0 ? t('checkins.photoCount', { count }) : '-';
}

onMounted(async () => {
  try {
    list.value = await fetchAllCheckIns();
  } catch {
    list.value = [];
  }
});
</script>

<style scoped>
.checkins-page {
  max-width: 960px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-head h2 {
  margin: 0;
}
.map-link {
  color: #1677ff;
  text-decoration: none;
  font-size: 14px;
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
}
th {
  background: #f9fafb;
  font-weight: 600;
}
.empty {
  color: #9ca3af;
}
</style>
