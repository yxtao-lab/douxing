import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/routes',
      name: 'routes',
      component: () => import('@/views/RoutesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/OrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/checkins',
      name: 'checkins',
      component: () => import('@/views/CheckInsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/checkins/map',
      name: 'checkins-map',
      component: () => import('@/views/CheckInsMapView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/attractions/pending',
      name: 'attractions-pending',
      component: () => import('@/views/AttractionsPendingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
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

export default router;
