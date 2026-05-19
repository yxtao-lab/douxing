<template>
  <div class="home-page">
    <section class="welcome-card">
      <h2>欢迎，{{ userStore.user?.nickname || userStore.user?.username }}</h2>
      <p>兜行 Web 管理端已就绪，可在此基础上扩展业务模块。</p>
      <ul class="info-list">
        <li><strong>角色：</strong>{{ userStore.user?.roles?.join('、') || '-' }}</li>
        <li><strong>邮箱：</strong>{{ userStore.user?.email || '-' }}</li>
      </ul>
    </section>
    <section class="status-card" v-if="health">
      <h3>服务状态</h3>
      <p>{{ health.name }} — {{ health.status }}</p>
      <small>{{ health.timestamp }}</small>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import http from '@/api/http';
import type { ApiResponse } from '@douxing/shared';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const health = ref<{ name: string; status: string; timestamp: string } | null>(null);

onMounted(async () => {
  try {
    const { data } = await http.get<ApiResponse<{ name: string; status: string; timestamp: string }>>(
      '/health',
    );
    health.value = data.data;
  } catch {
    /* ignore */
  }
});
</script>
