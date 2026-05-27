<template>
  <div class="routes-page">
    <h2>{{ t('routes.title') }}</h2>
    <p class="desc">{{ t('routes.desc') }}</p>
    <table class="table" v-if="routes.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>{{ t('routes.colName') }}</th>
          <th>{{ t('routes.colDays') }}</th>
          <th>{{ t('routes.colBudget') }}</th>
          <th>{{ t('routes.colStatus') }}</th>
          <th>{{ t('routes.colViews') }}</th>
          <th>{{ t('routes.colLikes') }}</th>
          <th>{{ t('routes.colFavorites') }}</th>
          <th>{{ t('routes.colCreator') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in routes" :key="r.id">
          <td>{{ r.id }}</td>
          <td>{{ r.name }}</td>
          <td>{{ r.days }}</td>
          <td>{{ r.budgetRange || '-' }}</td>
          <td>{{ statusLabel(r.status) }}</td>
          <td>{{ r.viewCount ?? 0 }}</td>
          <td>{{ r.likeCount ?? 0 }}</td>
          <td>{{ r.collectCount ?? 0 }}</td>
          <td>{{ r.creatorId }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">{{ t('common.noData') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchAllRoutes } from '@/api/routes';

const { t } = useI18n();
const routes = ref<TravelRouteInfo[]>([]);

function statusLabel(status: number) {
  if (status === RouteStatus.PUBLISHED) return t('routeStatus.published');
  if (status === RouteStatus.ARCHIVED) return t('routeStatus.archived');
  return t('routeStatus.draft');
}

onMounted(async () => {
  try {
    routes.value = await fetchAllRoutes();
  } catch {
    routes.value = [];
  }
});
</script>

<style scoped>
.routes-page {
  max-width: 960px;
}
.desc {
  color: #6b7280;
  margin-bottom: 24px;
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
