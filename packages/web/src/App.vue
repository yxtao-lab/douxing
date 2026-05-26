<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="brand">
        <span class="logo">兜</span>
        <span class="title">{{ t('app.name') }}</span>
      </div>
      <nav v-if="userStore.token" class="nav">
        <router-link to="/">{{ t('web.home') }}</router-link>
        <router-link to="/routes">{{ t('web.routes') }}</router-link>
        <router-link to="/orders">{{ t('web.orders') }}</router-link>
        <router-link to="/checkins">{{ t('web.checkins') }}</router-link>
        <router-link to="/checkins/map">{{ t('web.checkinMap') }}</router-link>
        <router-link to="/attractions/pending">{{ t('web.attractionsPending') }}</router-link>
        <a href="#" @click.prevent="handleLogout">{{ t('web.logout') }}</a>
      </nav>
      <label v-if="userStore.token" class="locale-switch">
        <span class="sr-only">Language</span>
        <select :value="currentLocale" @change="onLocaleChange">
          <option v-for="item in localeOptions" :key="item.code" :value="item.code">
            {{ item.label }}
          </option>
        </select>
      </label>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';
import { useLocale } from '@/i18n/useLocale';
import type { LocaleCode } from '@douxing/shared';

const userStore = useUserStore();
const router = useRouter();
const { t, currentLocale, localeOptions, setLocale } = useLocale();

function onLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  setLocale(value as LocaleCode);
}

function handleLogout() {
  userStore.logout();
  router.push('/login');
}
</script>
