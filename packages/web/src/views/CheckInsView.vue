<template>
  <div class="checkins-page">
    <h2>打卡记录</h2>
    <table class="table" v-if="list.length">
      <thead>
        <tr>
          <th>用户</th>
          <th>路线</th>
          <th>地点</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td>{{ c.userId }}</td>
          <td>{{ c.routeId }}</td>
          <td>{{ c.location.placeName || '-' }}</td>
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
