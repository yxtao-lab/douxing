import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { MenuProps } from 'ant-design-vue';
import {
  AuditOutlined,
  BarChartOutlined,
  BookOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  HomeOutlined,
  PictureOutlined,
  ShoppingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

const iconMap: Record<string, Component> = {
  HomeOutlined,
  UnorderedListOutlined,
  ShoppingOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  AuditOutlined,
  PictureOutlined,
  BookOutlined,
  BarChartOutlined,
};

export interface AppRouteMeta {
  requiresAuth?: boolean;
  titleKey?: string;
  menuGroupKey?: string;
  icon?: keyof typeof iconMap;
  hideInMenu?: boolean;
  hideInTabs?: boolean;
}

interface MenuRouteItem {
  path: string;
  name?: string;
  meta?: AppRouteMeta;
}

function toMenuPath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function renderIcon(name?: string) {
  if (!name || !iconMap[name]) return undefined;
  return () => h(iconMap[name]);
}

export function useAppMenu() {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const menuRoutes = computed(() => {
    const layoutRoute = router.getRoutes().find((item) => item.name === 'layout');
    return (layoutRoute?.children ?? []) as MenuRouteItem[];
  });

  const menuItems = computed<MenuProps['items']>(() => {
    const visible = menuRoutes.value.filter((item) => !item.meta?.hideInMenu && item.meta?.titleKey);
    const workbench = visible.filter((item) => !item.meta?.menuGroupKey);
    const biz = visible.filter((item) => item.meta?.menuGroupKey === 'web.menu.biz');
    const content = visible.filter((item) => item.meta?.menuGroupKey === 'web.menu.content');
    const data = visible.filter((item) => item.meta?.menuGroupKey === 'web.menu.data');

    const toMenuItem = (item: MenuRouteItem) => ({
      key: toMenuPath(item.path),
      icon: renderIcon(item.meta?.icon),
      label: t(item.meta!.titleKey!),
      title: t(item.meta!.titleKey!),
    });

    const groups: NonNullable<MenuProps['items']> = [];

    workbench.forEach((item) => groups.push(toMenuItem(item)));

    if (biz.length) {
      groups.push({
        key: 'group-biz',
        label: t('web.menu.biz'),
        title: t('web.menu.biz'),
        children: biz.map(toMenuItem),
      });
    }

    if (content.length) {
      groups.push({
        key: 'group-content',
        label: t('web.menu.content'),
        title: t('web.menu.content'),
        children: content.map(toMenuItem),
      });
    }

    if (data.length) {
      groups.push({
        key: 'group-data',
        label: t('web.menu.data'),
        title: t('web.menu.data'),
        children: data.map(toMenuItem),
      });
    }

    return groups;
  });

  const selectedKeys = computed(() => [route.path]);

  const openKeys = computed(() => {
    const group = route.meta.menuGroupKey as string | undefined;
    if (group === 'web.menu.biz') return ['group-biz'];
    if (group === 'web.menu.content') return ['group-content'];
    if (group === 'web.menu.data') return ['group-data'];
    return [];
  });

  const breadcrumbItems = computed(() => {
    const items: { title: string }[] = [{ title: t('web.layout.breadcrumbHome') }];
    if (route.meta.titleKey) {
      items.push({ title: t(route.meta.titleKey as string) });
    }
    return items;
  });

  return {
    menuItems,
    selectedKeys,
    openKeys,
    breadcrumbItems,
  };
}
