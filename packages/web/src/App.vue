<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="brand">
        <span class="logo">兜</span>
        <span class="title">{{ APP_NAME }}</span>
      </div>
      <nav v-if="userStore.token">
        <router-link to="/">首页</router-link>
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
