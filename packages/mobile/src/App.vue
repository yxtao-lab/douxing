<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { APP_NAME } from '@douxing/shared';

onLaunch(() => {
  console.log(`${APP_NAME} 移动端启动`);
});
</script>

<style>
page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
