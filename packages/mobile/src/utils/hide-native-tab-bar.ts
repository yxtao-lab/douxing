/** pages.json tabBar.list 中的页面路径 */
const TAB_BAR_ROUTES = new Set([
  'pages/index/index',
  'pages/plan/plan',
  'pages/routes/list',
  'pages/profile/profile',
]);

function getCurrentRoute(): string {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return current?.route ?? '';
}

/** 仅在 Tab 页隐藏原生 tabBar，供自定义 DouxingTabBar 使用 */
export function hideNativeTabBar(): void {
  if (!TAB_BAR_ROUTES.has(getCurrentRoute())) {
    return;
  }

  uni.hideTabBar({
    animation: false,
    fail: () => {
      /* 微信端以 fail 回调报错，try/catch 无法捕获 */
    },
  });
}
