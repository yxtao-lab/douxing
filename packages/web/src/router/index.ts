import { createRouter, createWebHistory } from 'vue-router';
import { i18n } from '@/i18n';
import { useLayoutStore } from '@/stores/layout';
import { useUserStore } from '@/stores/user';
import BasicLayout from '@/layouts/BasicLayout.vue';
import UserLayout from '@/layouts/UserLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: UserLayout,
      meta: { hideInMenu: true, hideInTabs: true },
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/views/LoginView.vue'),
        },
      ],
    },
    {
      path: '/',
      name: 'layout',
      component: BasicLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.home',
            icon: 'HomeOutlined',
          },
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('@/views/RoutesView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.routes',
            menuGroupKey: 'web.menu.biz',
            icon: 'UnorderedListOutlined',
          },
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/OrdersView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.orders',
            menuGroupKey: 'web.menu.biz',
            icon: 'ShoppingOutlined',
          },
        },
        {
          path: 'checkins',
          name: 'checkins',
          component: () => import('@/views/CheckInsView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.checkins',
            menuGroupKey: 'web.menu.biz',
            icon: 'EnvironmentOutlined',
          },
        },
        {
          path: 'checkins/map',
          name: 'checkins-map',
          component: () => import('@/views/CheckInsMapView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.checkinMap',
            menuGroupKey: 'web.menu.biz',
            icon: 'GlobalOutlined',
          },
        },
        {
          path: 'attractions/pending',
          name: 'attractions-pending',
          component: () => import('@/views/AttractionsPendingView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.attractionsPending',
            menuGroupKey: 'web.menu.content',
            icon: 'AuditOutlined',
          },
        },
        {
          path: 'attractions/manage',
          name: 'attractions-manage',
          component: () => import('@/views/AttractionsManageView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.attractionsManage',
            menuGroupKey: 'web.menu.content',
            icon: 'PictureOutlined',
          },
        },
        {
          path: 'playbooks/manage',
          name: 'playbooks-manage',
          component: () => import('@/views/PlaybooksManageView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.playbooksManage',
            menuGroupKey: 'web.menu.content',
            icon: 'BookOutlined',
          },
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: () => import('@/views/AnalyticsDashboardView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.analytics',
            menuGroupKey: 'web.menu.data',
            icon: 'BarChartOutlined',
          },
        },
        {
          path: 'system/users',
          name: 'sys-users',
          component: () => import('@/views/system/SystemUsersView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysUsers',
            menuGroupKey: 'web.menu.system',
            icon: 'UserOutlined',
          },
        },
        {
          path: 'system/roles',
          name: 'sys-roles',
          component: () => import('@/views/system/SystemRolesView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysRoles',
            menuGroupKey: 'web.menu.system',
            icon: 'TeamOutlined',
          },
        },
        {
          path: 'system/menus',
          name: 'sys-menus',
          component: () => import('@/views/system/SystemMenusView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysMenus',
            menuGroupKey: 'web.menu.system',
            icon: 'MenuOutlined',
          },
        },
        {
          path: 'system/depts',
          name: 'sys-depts',
          component: () => import('@/views/system/SystemDeptsView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysDepts',
            menuGroupKey: 'web.menu.system',
            icon: 'ApartmentOutlined',
          },
        },
        {
          path: 'system/posts',
          name: 'sys-posts',
          component: () => import('@/views/system/SystemPostsView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysPosts',
            menuGroupKey: 'web.menu.system',
            icon: 'IdcardOutlined',
          },
        },
        {
          path: 'system/dict',
          name: 'sys-dict',
          component: () => import('@/views/system/SystemDictView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysDict',
            menuGroupKey: 'web.menu.system',
            icon: 'ReadOutlined',
          },
        },
        {
          path: 'system/config',
          name: 'sys-config',
          component: () => import('@/views/system/SystemConfigView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysConfig',
            menuGroupKey: 'web.menu.system',
            icon: 'FormOutlined',
          },
        },
        {
          path: 'system/notices',
          name: 'sys-notices',
          component: () => import('@/views/system/SystemNoticesView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.sysNotices',
            menuGroupKey: 'web.menu.system',
            icon: 'NotificationOutlined',
          },
        },
        {
          path: 'monitor/online',
          name: 'monitor-online',
          component: () => import('@/views/monitor/MonitorOnlineView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorOnline',
            menuGroupKey: 'web.menu.monitor',
            icon: 'WifiOutlined',
          },
        },
        {
          path: 'monitor/jobs',
          name: 'monitor-jobs',
          component: () => import('@/views/monitor/MonitorJobsView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorJobs',
            menuGroupKey: 'web.menu.monitor',
            icon: 'ClockCircleOutlined',
          },
        },
        {
          path: 'monitor/data',
          name: 'monitor-data',
          component: () => import('@/views/monitor/MonitorDataView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorData',
            menuGroupKey: 'web.menu.monitor',
            icon: 'RadarChartOutlined',
          },
        },
        {
          path: 'monitor/server',
          name: 'monitor-server',
          component: () => import('@/views/monitor/MonitorServerView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorServer',
            menuGroupKey: 'web.menu.monitor',
            icon: 'DesktopOutlined',
          },
        },
        {
          path: 'monitor/cache',
          name: 'monitor-cache',
          component: () => import('@/views/monitor/MonitorCacheView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorCache',
            menuGroupKey: 'web.menu.monitor',
            icon: 'HddOutlined',
          },
        },
        {
          path: 'monitor/cache-list',
          name: 'monitor-cache-list',
          component: () => import('@/views/monitor/MonitorCacheListView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.monitorCacheList',
            menuGroupKey: 'web.menu.monitor',
            icon: 'BlockOutlined',
          },
        },
        {
          path: 'log/oper',
          name: 'log-oper',
          component: () => import('@/views/log/LogOperView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.logOper',
            menuGroupKey: 'web.menu.log',
            icon: 'FileTextOutlined',
          },
        },
        {
          path: 'log/login',
          name: 'log-login',
          component: () => import('@/views/log/LogLoginView.vue'),
          meta: {
            requiresAuth: true,
            titleKey: 'web.logLogin',
            menuGroupKey: 'web.menu.log',
            icon: 'AuditOutlined',
          },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const userStore = useUserStore();
  if (to.meta.requiresAuth && !userStore.token) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && userStore.token) {
    return { name: 'home' };
  }
});

router.afterEach((to) => {
  const layoutStore = useLayoutStore();
  layoutStore.addView(to);

  const titleKey = to.meta.titleKey as string | undefined;
  if (titleKey) {
    const { t } = i18n.global;
    document.title = `${t(titleKey)} · ${t('app.name')}`;
  } else if (to.name === 'login') {
    const { t } = i18n.global;
    document.title = `${t('common.login')} · ${t('app.name')}`;
  }
});

export default router;
