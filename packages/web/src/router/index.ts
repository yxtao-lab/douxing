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
