<template>
  <div class="home-page">
    <section class="welcome-card">
      <h2>{{ welcomeText }}</h2>
      <p>{{ t('home.desc') }}</p>
      <div class="quick-links">
        <router-link to="/routes">{{ t('web.routes') }}</router-link>
        <router-link to="/orders">{{ t('web.orders') }}</router-link>
        <router-link to="/checkins">{{ t('web.checkins') }}</router-link>
        <router-link to="/checkins/map">{{ t('web.checkinMap') }}</router-link>
        <router-link to="/attractions/pending">{{ t('web.attractionsPending') }}</router-link>
        <router-link to="/attractions/manage">{{ t('web.attractionsManage') }}</router-link>
        <router-link to="/playbooks/manage">{{ t('web.playbooksManage') }}</router-link>
      </div>
      <ul class="info-list">
        <li><strong>{{ t('home.role') }}：</strong>{{ userStore.user?.roles?.join('、') || '-' }}</li>
        <li><strong>{{ t('home.email') }}：</strong>{{ userStore.user?.email || '-' }}</li>
      </ul>
    </section>
    <section class="status-card" v-if="health">
      <h3>{{ t('home.serviceStatus') }}</h3>
      <p>{{ health.name }} — {{ health.status }}</p>
      <small>{{ health.timestamp }}</small>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import http from '@/api/http';
import type { ApiResponse } from '@douxing/shared';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const userStore = useUserStore();
const health = ref<{ name: string; status: string; timestamp: string } | null>(null);

const welcomeText = computed(() =>
  t('home.welcome', {
    name: userStore.user?.nickname || userStore.user?.username || '',
  }),
);

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

<style scoped>
.home-page {
  max-width: 720px;
}
.welcome-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0;
}
.quick-links a {
  color: #1677ff;
  text-decoration: none;
  padding: 8px 16px;
  background: #f0f7ff;
  border-radius: 8px;
  font-size: 14px;
}
.info-list {
  margin: 0;
  padding-left: 20px;
  color: #374151;
}
.status-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>
