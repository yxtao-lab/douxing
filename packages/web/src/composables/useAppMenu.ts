import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { MenuProps } from 'ant-design-vue';
import {
  ApartmentOutlined,
  ApiOutlined,
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
import type { NavMenuNode } from '@/api/system';
import { useMenuStore } from '@/stores/menu';
import { resolveMenuLabel } from '@/utils/menu-i18n';

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
  ApiOutlined,
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

export interface AppRouteMeta {
  requiresAuth?: boolean;
  titleKey?: string;
  menuGroupKey?: string;
  /** 三级菜单分组键（需配合 menuGroupKey 使用） */
  menuSubGroupKey?: string;
  /** S1 RBAC：菜单权限标识，与 sys_menu.perms 对齐 */
  perm?: string;
  icon?: keyof typeof menuIconMap;
  hideInMenu?: boolean;
  hideInTabs?: boolean;
}

function toMenuPath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function renderMenuIcon(name?: string | null) {
  if (!name || !menuIconMap[name]) return undefined;
  return () => h(menuIconMap[name]);
}

function navNodeKey(node: NavMenuNode): string {
  if (node.path) return toMenuPath(node.path);
  return `menu-${node.menuKey}`;
}

function navNodeToMenuItem(
  node: NavMenuNode,
  t: (key: string) => string,
): NonNullable<MenuProps['items']>[number] {
  const label = resolveMenuLabel(node.menuKey, node.menuName, t);
  const base = {
    key: navNodeKey(node),
    icon: renderMenuIcon(node.icon),
    label,
    title: label,
  };
  if (node.children?.length) {
    return {
      ...base,
      children: node.children.map((child) => navNodeToMenuItem(child, t)),
    };
  }
  return base;
}

function findNavChain(
  nodes: NavMenuNode[],
  targetPath: string,
  chain: NavMenuNode[] = [],
): NavMenuNode[] | null {
  for (const node of nodes) {
    const next = [...chain, node];
    if (node.path && toMenuPath(node.path) === targetPath) {
      return next;
    }
    if (node.children?.length) {
      const found = findNavChain(node.children, targetPath, next);
      if (found) return found;
    }
  }
  return null;
}

function findOpenKeysForPath(
  nodes: NavMenuNode[],
  targetPath: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    const nodeKey = navNodeKey(node);
    if (node.path && toMenuPath(node.path) === targetPath) {
      return ancestors;
    }
    if (node.children?.length) {
      const found = findOpenKeysForPath(node.children, targetPath, [...ancestors, nodeKey]);
      if (found !== null) return found;
    }
  }
  return null;
}

export function useAppMenu() {
  const { t } = useI18n();
  const route = useRoute();
  const menuStore = useMenuStore();

  const menuItems = computed<MenuProps['items']>(() =>
    menuStore.navTree.map((node) => navNodeToMenuItem(node, t)),
  );

  const selectedKeys = computed(() => [route.path]);

  const openKeys = computed(() => {
    const keys = findOpenKeysForPath(menuStore.navTree, route.path);
    return keys ?? [];
  });

  const breadcrumbItems = computed(() => {
    const items: { title: string }[] = [{ title: t('web.layout.breadcrumbHome') }];
    if (route.path === '/') return items;

    const chain = findNavChain(menuStore.navTree, route.path);
    if (chain) {
      for (const node of chain) {
        items.push({ title: resolveMenuLabel(node.menuKey, node.menuName, t) });
      }
      return items;
    }

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
