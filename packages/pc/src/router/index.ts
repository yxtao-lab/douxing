import { createRouter, createWebHistory } from 'vue-router';
import { i18n } from '@/i18n';
import { useUserStore } from '@/stores/user';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: AuthLayout,
      meta: { hideNav: true },
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
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'pc.nav.home', navKey: 'home' },
        },
        {
          path: 'plan',
          name: 'plan',
          component: () => import('@/views/PlanView.vue'),
          meta: { titleKey: 'pc.nav.plan', navKey: 'plan', requiresAuth: true },
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('@/views/RoutesView.vue'),
          meta: { titleKey: 'pc.nav.routes', navKey: 'routes', requiresAuth: true },
        },
        {
          path: 'routes/:id',
          name: 'route-detail',
          component: () => import('@/views/RouteDetailView.vue'),
          meta: { titleKey: 'nav.routeDetail', navKey: 'routes', requiresAuth: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { titleKey: 'pc.nav.profile', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'profile/edit',
          name: 'profile-edit',
          component: () => import('@/views/ProfileEditView.vue'),
          meta: { titleKey: 'nav.profileEdit', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'profile/membership',
          name: 'membership',
          component: () => import('@/views/MembershipView.vue'),
          meta: { titleKey: 'nav.membership', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'journey-albums',
          name: 'journey-albums',
          component: () => import('@/views/JourneyAlbumsView.vue'),
          meta: { titleKey: 'nav.myAlbum', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'achievements',
          name: 'achievements',
          component: () => import('@/views/AchievementsView.vue'),
          meta: { titleKey: 'nav.achievements', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'badges',
          name: 'badges',
          component: () => import('@/views/BadgesView.vue'),
          meta: { titleKey: 'nav.badges', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'checkins',
          name: 'checkins',
          component: () => import('@/views/CheckinsView.vue'),
          meta: { titleKey: 'nav.checkins', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'checkins/map',
          name: 'checkins-map',
          component: () => import('@/views/CheckinsMapView.vue'),
          meta: { titleKey: 'nav.checkinMap', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'leaderboard',
          name: 'leaderboard',
          component: () => import('@/views/LeaderboardView.vue'),
          meta: { titleKey: 'nav.leaderboard', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/OrdersView.vue'),
          meta: { titleKey: 'nav.orders', navKey: 'profile', requiresAuth: true },
        },
      ],
    },
    {
      path: '/share/routes/:id',
      name: 'share-route',
      component: () => import('@/views/ShareRouteView.vue'),
      meta: { hideNav: true, titleKey: 'shareRoute.pageTitle' },
    },
  ],
});

router.beforeEach((to) => {
  const userStore = useUserStore();
  if (to.meta.requiresAuth && !userStore.token) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && userStore.token) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/';
    return redirect;
  }
});

router.afterEach((to) => {
  const titleKey = to.meta.titleKey as string | undefined;
  const { t } = i18n.global;
  if (titleKey) {
    document.title = `${t(titleKey)} · ${t('app.name')}`;
  } else if (to.name === 'login') {
    document.title = `${t('common.login')} · ${t('app.name')}`;
  }
});

export default router;
