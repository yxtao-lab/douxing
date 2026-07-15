<template>
  <a-layout-sider class="partner-sider" :width="220" theme="light">
    <div class="partner-sider-title">{{ t('partner.menuTitle') }}</div>
    <a-menu mode="inline" :selected-keys="[selectedKey]" @click="onMenuClick">
      <a-menu-item v-for="item in menuItems" :key="item.key">
        <component :is="item.icon" />
        <span>{{ t(item.labelKey) }}</span>
      </a-menu-item>
    </a-menu>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AccountBookOutlined,
  AppstoreOutlined,
  AuditOutlined,
  CalendarOutlined,
  FileSearchOutlined,
  HomeOutlined,
  ShoppingOutlined,
  TagOutlined,
} from '@ant-design/icons-vue';
import { useLocale } from '@/i18n/useLocale';

const route = useRoute();
const router = useRouter();
const { t } = useLocale();

const menuItems = [
  { key: 'partner-home', labelKey: 'partner.nav.home', icon: HomeOutlined },
  { key: 'partner-onboard', labelKey: 'partner.nav.onboard', icon: AuditOutlined },
  { key: 'partner-demands', labelKey: 'partner.nav.demands', icon: FileSearchOutlined },
  { key: 'partner-quotes', labelKey: 'partner.nav.quotes', icon: TagOutlined },
  { key: 'partner-orders', labelKey: 'partner.nav.orders', icon: ShoppingOutlined },
  { key: 'partner-schedule', labelKey: 'partner.nav.schedule', icon: CalendarOutlined },
  { key: 'partner-settlements', labelKey: 'partner.nav.settlements', icon: AccountBookOutlined },
  { key: 'partner-admin-link', labelKey: 'partner.nav.adminPortal', icon: AppstoreOutlined },
];

const selectedKey = computed(() => {
  const name = route.name as string | undefined;
  if (name?.startsWith('partner-demand')) return 'partner-demands';
  if (name?.startsWith('partner-order')) return 'partner-orders';
  if (name?.startsWith('partner-schedule')) return 'partner-schedule';
  if (name?.startsWith('partner-settlement')) return 'partner-settlements';
  if (name?.startsWith('partner-org') || name?.startsWith('partner-provider')) return 'partner-onboard';
  return name ?? 'partner-home';
});

/**
 * 侧栏菜单点击跳转。
 *
 * @param info - Ant Design Menu 点击事件
 */
function onMenuClick(info: { key: string | number }) {
  const key = String(info.key);
  if (key === 'partner-admin-link') {
    window.location.href = '/';
    return;
  }
  router.push({ name: key });
}
</script>

<style scoped>
.partner-sider {
  border-right: 1px solid #f0f0f0;
}

.partner-sider-title {
  padding: 20px 16px 12px;
  font-weight: 600;
  font-size: 14px;
  color: #333;
}
</style>
