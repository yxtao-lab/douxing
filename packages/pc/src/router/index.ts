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
          meta: { titleKey: 'pc.nav.home', navKey: 'home', petFloating: true },
        },
        {
          path: 'plan',
          name: 'plan',
          component: () => import('@/views/PlanView.vue'),
          meta: { titleKey: 'pc.nav.plan', navKey: 'plan', requiresAuth: true, petFloating: true },
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('@/views/RoutesView.vue'),
          meta: { titleKey: 'pc.nav.routes', navKey: 'routes', requiresAuth: true, petFloating: true },
        },
        {
          path: 'routes/:id',
          name: 'route-detail',
          component: () => import('@/views/RouteDetailView.vue'),
          meta: {
            titleKey: 'nav.routeDetail',
            navKey: 'routes',
            requiresAuth: true,
            petFloating: true,
          },
        },
        {
          path: 'scenes/:slug',
          name: 'scene-detail',
          component: () => import('@/views/SceneDetailView.vue'),
          meta: { titleKey: 'scenes.pageTitle', navKey: 'home' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { titleKey: 'pc.nav.profile', navKey: 'profile', requiresAuth: true, petFloating: true },
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
          path: 'profile/pet-memories',
          name: 'pet-memories',
          component: () => import('@/views/PetMemoriesView.vue'),
          meta: { titleKey: 'nav.petMemories', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'journey-albums',
          name: 'journey-albums',
          component: () => import('@/views/JourneyAlbumsView.vue'),
          meta: { titleKey: 'nav.myAlbum', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'journey-albums/:albumId',
          name: 'journey-album-detail',
          component: () => import('@/views/JourneyAlbumDetailView.vue'),
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
          meta: {
            titleKey: 'nav.checkinMap',
            navKey: 'profile',
            requiresAuth: true,
            hidePetFloating: true,
          },
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
        {
          path: 'marketplace',
          name: 'marketplace-hall',
          component: () => import('@/views/MarketplaceHallView.vue'),
          meta: { titleKey: 'marketplace.pageTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/create',
          name: 'marketplace-create',
          component: () => import('@/views/MarketplaceCreateView.vue'),
          meta: { titleKey: 'marketplace.createTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/mine',
          name: 'marketplace-mine',
          component: () => import('@/views/MarketplaceMineView.vue'),
          meta: { titleKey: 'marketplace.mineTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/groups',
          name: 'marketplace-groups',
          component: () => import('@/views/MarketplaceGroupsView.vue'),
          meta: { titleKey: 'marketplace.groupsTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/groups/create',
          name: 'marketplace-group-create',
          component: () => import('@/views/MarketplaceGroupCreateView.vue'),
          meta: { titleKey: 'marketplace.groupCreateTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/groups/:id',
          name: 'marketplace-group-detail',
          component: () => import('@/views/MarketplaceGroupDetailView.vue'),
          meta: { titleKey: 'marketplace.groupDetailTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/products/:id',
          name: 'marketplace-product-detail',
          component: () => import('@/views/MarketplaceProductDetailView.vue'),
          meta: { titleKey: 'marketplace.productDetailTitle', navKey: 'profile', requiresAuth: true },
        },
        {
          path: 'marketplace/:id',
          name: 'marketplace-detail',
          component: () => import('@/views/MarketplaceDetailView.vue'),
          meta: { titleKey: 'marketplace.detailTitle', navKey: 'profile', requiresAuth: true },
        },
      ],
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('@/views/MaintenanceView.vue'),
      meta: { hideNav: true, titleKey: 'siteStatus.pageTitle' },
    },
    {
      path: '/share/routes/:id',
      name: 'share-route',
      component: () => import('@/views/ShareRouteView.vue'),
      meta: { hideNav: true, titleKey: 'shareRoute.pageTitle' },
    },
    {
      path: '/share/journey-albums/:token',
      name: 'share-journey-album',
      component: () => import('@/views/ShareJourneyAlbumView.vue'),
      meta: { hideNav: true, titleKey: 'shareJourneyAlbum.pageTitle' },
    },
  ],
});

import { isPublicSiteOnline } from '@/utils/site-status-guard';

router.beforeEach(async (to) => {
  const onMaintenancePage = to.name === 'maintenance';
  const online = await isPublicSiteOnline();
  if (!online && !onMaintenancePage) {
    return { name: 'maintenance' };
  }
  if (online && onMaintenancePage) {
    return { name: 'home' };
  }

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
