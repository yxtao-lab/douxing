<template>
  <div class="routes-page">
    <h2>路线管理</h2>
    <p class="desc">查看平台全部用户路线（MVP 管理端）</p>
    <table class="table" v-if="routes.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>天数</th>
          <th>预算</th>
          <th>状态</th>
          <th>浏览</th>
          <th>点赞</th>
          <th>收藏</th>
          <th>创建者</th>
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
    <p v-else class="empty">暂无数据</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import { fetchAllRoutes } from '@/api/routes';

const routes = ref<TravelRouteInfo[]>([]);

function statusLabel(status: number) {
  if (status === RouteStatus.PUBLISHED) return '已发布';
  if (status === RouteStatus.ARCHIVED) return '已归档';
  return '草稿';
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
