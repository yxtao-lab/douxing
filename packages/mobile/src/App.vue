<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { APP_NAME } from '@douxing/shared';

onLaunch(() => {
  console.log(`${APP_NAME} 移动端启动`);
  // H5 不支持 pages.json custom-tab-bar 目录方案，使用页面内 DouxingTabBar + 隐藏原生栏
  hideNativeTabBar();
});

function hideNativeTabBar() {
  try {
    uni.hideTabBar({ animation: false });
  } catch {
    // 非 Tab 页可能失败，忽略
  }
}
</script>

<style>
@import '@/static/iconfont/iconfont.css';

page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* Tab 页底部留白，避免被自定义 tabBar 遮挡（子页面 padding 简写会覆盖 bottom，需分边设置） */
.tab-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}
</style>
