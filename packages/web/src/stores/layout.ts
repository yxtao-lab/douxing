import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RouteLocationNormalized, Router } from 'vue-router';

export interface VisitedTab {
  path: string;
  name?: string | symbol;
  titleKey?: string;
  fullPath: string;
}

export const useLayoutStore = defineStore('layout', () => {
  const collapsed = ref(false);
  const visitedViews = ref<VisitedTab[]>([]);

  function toggleCollapsed() {
    collapsed.value = !collapsed.value;
  }

  function setCollapsed(value: boolean) {
    collapsed.value = value;
  }

  function addView(route: RouteLocationNormalized) {
    if (route.meta?.hideInTabs || !route.meta?.requiresAuth) return;

    const path = route.path || '/';
    const existing = visitedViews.value.find((item) => item.path === path);
    if (existing) {
      existing.fullPath = route.fullPath;
      existing.titleKey = route.meta.titleKey as string | undefined;
      return;
    }

    visitedViews.value.push({
      path,
      name: route.name ?? undefined,
      titleKey: route.meta.titleKey as string | undefined,
      fullPath: route.fullPath,
    });
  }

  function removeView(path: string) {
    visitedViews.value = visitedViews.value.filter((item) => item.path !== path);
  }

  function clearViews() {
    visitedViews.value = [];
  }

  function closeOtherViews(currentPath: string) {
    visitedViews.value = visitedViews.value.filter((item) => item.path === currentPath);
  }

  function closeAllViews() {
    visitedViews.value = visitedViews.value.filter((item) => item.path === '/');
  }

  function closeView(path: string, currentPath: string, router: Router) {
    if (visitedViews.value.length <= 1) return;

    const index = visitedViews.value.findIndex((item) => item.path === path);
    if (index === -1) return;

    visitedViews.value.splice(index, 1);

    if (currentPath !== path) return;

    const next = visitedViews.value[index] ?? visitedViews.value[index - 1];
    if (next) {
      router.push(next.fullPath);
    } else {
      router.push('/');
    }
  }

  return {
    collapsed,
    visitedViews,
    toggleCollapsed,
    setCollapsed,
    addView,
    removeView,
    clearViews,
    closeOtherViews,
    closeAllViews,
    closeView,
  };
});
