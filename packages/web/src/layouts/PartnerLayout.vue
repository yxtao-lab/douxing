<template>
  <a-layout class="partner-layout">
    <PartnerSider />
    <a-layout class="partner-main">
      <a-layout-header class="partner-header">
        <div class="partner-header-inner">
          <span class="partner-brand">{{ t('partner.brand') }}</span>
          <div class="partner-header-actions">
            <a-select
              class="locale-select"
              :value="currentLocale"
              :options="localeSelectOptions"
              size="small"
              @change="onLocaleChange"
            />
            <span v-if="userStore.user" class="partner-user">{{ userStore.user.nickname || userStore.user.username }}</span>
            <a-button type="link" @click="handleLogout">{{ t('common.logout') }}</a-button>
          </div>
        </div>
      </a-layout-header>
      <a-layout-content class="partner-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { isLocaleCode } from '@douxing/shared';
import PartnerSider from './components/PartnerSider.vue';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale, localeOptions, setLocale } = useLocale();

const localeSelectOptions = computed(() =>
  localeOptions.map((item) => ({ value: item.code, label: item.label })),
);

/**
 * 切换界面语言。
 *
 * @param value - 选中的 locale code
 */
function onLocaleChange(value: unknown) {
  if (typeof value === 'string' && isLocaleCode(value)) {
    setLocale(value);
  }
}

/**
 * 退出商户工作台并返回登录页。
 */
function handleLogout() {
  userStore.logout();
  router.push({ name: 'login', query: { portal: 'partner' } });
}
</script>

<style scoped>
.partner-layout {
  min-height: 100vh;
}

.partner-main {
  min-height: 100vh;
}

.partner-header {
  background: #fff;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.partner-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.partner-brand {
  font-size: 16px;
  font-weight: 600;
  color: #1677ff;
}

.partner-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.partner-user {
  color: #666;
  font-size: 14px;
}

.locale-select {
  width: 108px;
}

.partner-content {
  padding: 24px;
  background: #f5f7fa;
  min-height: calc(100vh - 56px);
}
</style>
