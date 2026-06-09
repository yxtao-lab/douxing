<template>
  <div class="app-header">
    <div class="app-header-left">
      <a-button type="text" class="collapse-btn" @click="layoutStore.toggleCollapsed()">
        <MenuUnfoldOutlined v-if="layoutStore.collapsed" />
        <MenuFoldOutlined v-else />
      </a-button>
    </div>

    <a-breadcrumb class="app-breadcrumb">
      <a-breadcrumb-item v-for="(item, index) in breadcrumbItems" :key="index">
        {{ item.title }}
      </a-breadcrumb-item>
    </a-breadcrumb>

    <div class="app-header-right">
      <a-select
        class="locale-select"
        :value="currentLocale"
        :options="localeSelectOptions"
        @change="onLocaleChange"
      />
      <a-dropdown>
        <a class="user-trigger" @click.prevent>
          <a-avatar size="small" class="user-avatar">
            {{ avatarText }}
          </a-avatar>
          <span class="user-name">{{ displayName }}</span>
          <DownOutlined />
        </a>
        <template #overlay>
          <a-menu>
            <a-menu-item key="logout" @click="handleLogout">
              {{ t('web.logout') }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons-vue';
import { isLocaleCode } from '@douxing/shared';
import { useAppMenu } from '@/composables/useAppMenu';
import { useLocale } from '@/i18n/useLocale';
import { useLayoutStore } from '@/stores/layout';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const layoutStore = useLayoutStore();
const userStore = useUserStore();
const { t, currentLocale, localeOptions, setLocale } = useLocale();
const { breadcrumbItems } = useAppMenu();

const localeSelectOptions = computed(() =>
  localeOptions.map((item) => ({ value: item.code, label: item.label })),
);

const displayName = computed(
  () => userStore.user?.nickname || userStore.user?.username || t('web.layout.userFallback'),
);

const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase());

function onLocaleChange(value: unknown) {
  if (typeof value === 'string' && isLocaleCode(value)) {
    setLocale(value);
  }
}

function handleLogout() {
  userStore.logout();
  layoutStore.clearViews();
  router.push('/login');
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 56px;
  padding: 0 24px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.collapse-btn {
  font-size: 16px;
}

.app-breadcrumb {
  flex: 1;
  min-width: 0;
}

.app-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.locale-select {
  width: 120px;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #1f2937;
}

.user-avatar {
  background: var(--color-primary);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .app-breadcrumb,
  .user-name {
    display: none;
  }
}
</style>
