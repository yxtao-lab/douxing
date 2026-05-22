<template>
  <div class="checkins-page">
    <div class="page-head">
      <h2>打卡记录</h2>
      <router-link class="map-link" to="/checkins/map">地图视图 ›</router-link>
    </div>
    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>用户</th>
          <th>路线</th>
          <th>地点</th>
          <th>城市</th>
          <th>积分</th>
          <th>照片</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td>{{ c.userId }}</td>
          <td>{{ c.routeId }}</td>
          <td>{{ c.location.placeName || '-' }}</td>
          <td>{{ c.city || c.cityCode }}</td>
          <td>{{ c.pointsEarned }}</td>
          <td>{{ c.photos.length > 0 ? `${c.photos.length} 张` : '-' }}</td>
          <td>{{ c.checkedAt.slice(0, 16).replace('T', ' ') }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">暂无打卡</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CheckInInfo } from '@douxing/shared';
import { fetchAllCheckIns } from '@/api/checkins';

const list = ref<CheckInInfo[]>([]);

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
