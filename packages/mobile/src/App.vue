<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { APP_NAME, AnalyticsEventName } from '@douxing/shared';
import { initAppTheme } from '@/i18n/useTheme';
import { guardSiteOnlineRoute } from '@/utils/site-status-guard';
import { initAnalytics, trackAnalytics } from '@/utils/analytics';
import { setUnauthorizedHandler } from '@/utils/request';

onLaunch(async () => {
  setUnauthorizedHandler(() => {
    uni.reLaunch({ url: '/pages/login/login' });
  });
  initAppTheme();
  initAnalytics();
  trackAnalytics(AnalyticsEventName.APP_LAUNCH);
  console.log(`${APP_NAME} 移动端启动`);
  await guardSiteOnlineRoute();
});

onShow(() => {
  void guardSiteOnlineRoute();
});
</script>

<style>
@import '@/static/iconfont/iconfont.css';
@import '@/styles/theme.css';
@import '@/styles/h5-viewport.css';

page {
  background-color: var(--dx-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--dx-text);
}

/* Tab 页底部留白，避免被自定义 tabBar 遮挡（子页面 padding 简写会覆盖 bottom，需分边设置） */
.tab-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}
</style>
