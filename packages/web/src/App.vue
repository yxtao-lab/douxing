<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="brand">
        <span class="logo">兜</span>
        <span class="title">{{ APP_NAME }}</span>
      </div>
      <nav v-if="userStore.token" class="nav">
        <router-link to="/">首页</router-link>
        <router-link to="/routes">路线</router-link>
        <router-link to="/orders">订单</router-link>
        <router-link to="/checkins">打卡</router-link>
        <router-link to="/checkins/map">打卡地图</router-link>
        <router-link to="/attractions/pending">景点审核</router-link>
        <a href="#" @click.prevent="handleLogout">退出</a>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { APP_NAME } from '@douxing/shared';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

function handleLogout() {
  userStore.logout();
  router.push('/login');
}
</script>
