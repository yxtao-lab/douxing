import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { MenuProps } from 'ant-design-vue';
import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  BlockOutlined,
  BookOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  FormOutlined,
  GlobalOutlined,
  HddOutlined,
  HomeOutlined,
  IdcardOutlined,
  MenuOutlined,
  NotificationOutlined,
  PictureOutlined,
  RadarChartOutlined,
  ReadOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  GiftOutlined,
  HistoryOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

export const menuIconMap: Record<string, Component> = {
  HomeOutlined,
  UnorderedListOutlined,
  ShoppingOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  AuditOutlined,
  PictureOutlined,
  BookOutlined,
  BarChartOutlined,
  UserOutlined,
  TeamOutlined,
  MenuOutlined,
  ApartmentOutlined,
  IdcardOutlined,
  ReadOutlined,
  FormOutlined,
  NotificationOutlined,
  SettingOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  RadarChartOutlined,
  DesktopOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  HddOutlined,
  BlockOutlined,
  FileTextOutlined,
  CrownOutlined,
  GiftOutlined,
  HistoryOutlined,
};

/** 可选图标列表（按名称排序，供菜单图标选择器使用） */
export const menuIconOptions = Object.keys(menuIconMap).sort();

const MENU_GROUPS = [
  { key: 'web.menu.data', groupId: 'group-data', icon: 'BarChartOutlined' },
  { key: 'web.menu.biz', groupId: 'group-biz', icon: 'UnorderedListOutlined' },
  { key: 'web.menu.content', groupId: 'group-content', icon: 'AuditOutlined' },
  { key: 'web.menu.system', groupId: 'group-system', icon: 'SettingOutlined' },
  { key: 'web.menu.monitor', groupId: 'group-monitor', icon: 'RadarChartOutlined' },
  { key: 'web.menu.log', groupId: 'group-log', icon: 'FileTextOutlined' },
] as const;

/** 二级菜单下的三级分组（如：业务管理 → 会员 → 会员管理） */
const MENU_SUB_GROUPS = [
  {
    key: 'web.menu.membership',
    groupId: 'subgroup-membership',
    icon: 'CrownOutlined',
    parentGroupKey: 'web.menu.biz',
    sortAfterPath: 'orders',
  },
] as const;

export interface AppRouteMeta {
  requiresAuth?: boolean;
  titleKey?: string;
  menuGroupKey?: string;
  /** 三级菜单分组键（需配合 menuGroupKey 使用） */
  menuSubGroupKey?: string;
  icon?: keyof typeof menuIconMap;
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

export function renderMenuIcon(name?: string | null) {
  if (!name || !menuIconMap[name]) return undefined;
  return () => h(menuIconMap[name]);
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

    const toMenuItem = (item: MenuRouteItem) => ({
      key: toMenuPath(item.path),
      icon: renderMenuIcon(item.meta?.icon),
      label: t(item.meta!.titleKey!),
      title: t(item.meta!.titleKey!),
    });

    const buildSubGroupMenu = (
      subGroup: (typeof MENU_SUB_GROUPS)[number],
      groupRoutes: MenuRouteItem[],
    ) => ({
      key: subGroup.groupId,
      icon: renderMenuIcon(subGroup.icon),
      label: t(subGroup.key),
      title: t(subGroup.key),
      children: groupRoutes
        .filter((item) => item.meta?.menuSubGroupKey === subGroup.key)
        .map(toMenuItem),
    });

    const buildGroupChildren = (groupKey: string, groupRoutes: MenuRouteItem[]) => {
      const directRoutes = groupRoutes.filter((item) => !item.meta?.menuSubGroupKey);
      const subGroups = MENU_SUB_GROUPS.filter((item) => item.parentGroupKey === groupKey);
      const children: NonNullable<MenuProps['items']> = [];

      for (const item of directRoutes) {
        children.push(toMenuItem(item));
        for (const subGroup of subGroups) {
          if ('sortAfterPath' in subGroup && subGroup.sortAfterPath === item.path) {
            const subMenu = buildSubGroupMenu(subGroup, groupRoutes);
            if (subMenu.children?.length) children.push(subMenu);
          }
        }
      }

      for (const subGroup of subGroups) {
        if ('sortAfterPath' in subGroup && subGroup.sortAfterPath) continue;
        const subMenu = buildSubGroupMenu(subGroup, groupRoutes);
        if (subMenu.children?.length) children.push(subMenu);
      }

      return children;
    };

    const groups: NonNullable<MenuProps['items']> = [];
    workbench.forEach((item) => groups.push(toMenuItem(item)));

    for (const group of MENU_GROUPS) {
      const groupRoutes = visible.filter((item) => item.meta?.menuGroupKey === group.key);
      if (groupRoutes.length) {
        groups.push({
          key: group.groupId,
          icon: renderMenuIcon(group.icon),
          label: t(group.key),
          title: t(group.key),
          children: buildGroupChildren(group.key, groupRoutes),
        });
      }
    }

    return groups;
  });

  const selectedKeys = computed(() => [route.path]);

  const openKeys = computed(() => {
    const keys: string[] = [];
    const groupKey = route.meta.menuGroupKey as string | undefined;
    const matched = MENU_GROUPS.find((g) => g.key === groupKey);
    if (matched) keys.push(matched.groupId);

    const subGroupKey = route.meta.menuSubGroupKey as string | undefined;
    const matchedSub = MENU_SUB_GROUPS.find((g) => g.key === subGroupKey);
    if (matchedSub) keys.push(matchedSub.groupId);

    return keys;
  });

  const breadcrumbItems = computed(() => {
    const items: { title: string }[] = [{ title: t('web.layout.breadcrumbHome') }];
    const subGroupKey = route.meta.menuSubGroupKey as string | undefined;
    if (subGroupKey) {
      items.push({ title: t(subGroupKey) });
    }
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
