<template>
  <view class="page tab-page">
    <scroll-view scroll-y class="scroll" enable-back-to-top>
      <view class="list-inner">
        <view v-if="routes.length === 0" class="empty">
          <text>暂无路线，去「规划」生成一条吧</text>
          <button class="btn" @click="goPlan">去规划</button>
        </view>
        <view v-for="item in routes" :key="item.id" class="card" @click="goDetail(item.id)">
          <view class="card-head">
            <text class="name">{{ item.name }}</text>
            <text class="tag" v-if="item.isAiGenerated">AI</text>
          </view>
          <text class="meta">{{ item.days }}天 · 预算 {{ item.budgetRange || '待定' }}</text>
          <text class="desc">{{ item.description }}</text>
          <view class="footer">
            <text class="status">{{ statusText(item.status) }}</text>
            <text class="arrow">查看 ›</text>
          </view>
        </view>
      </view>
    </scroll-view>
    <DouxingTabBar :current="2" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { TravelRouteInfo } from '@douxing/shared';
import { fetchRoutes } from '@/api/routes';
import { RouteStatus } from '@douxing/shared';
import { getStoredUser } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';

const routes = ref<TravelRouteInfo[]>([]);

function statusText(status: number) {
  if (status === RouteStatus.PUBLISHED) return '已发布';
  if (status === RouteStatus.ARCHIVED) return '已归档';
  return '草稿';
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${id}` });
}

function goPlan() {
  uni.switchTab({ url: '/pages/plan/plan' });
}

onShow(async () => {
  uni.hideTabBar({ animation: false });
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  try {
    routes.value = await fetchRoutes();
  } catch {
    routes.value = [];
  }
});
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  box-sizing: border-box;
  overflow: hidden;
}

.scroll {
  flex: 1;
  height: 0;
  width: 100%;
}

.list-inner {
  padding: 24rpx;
  /* 为底部固定 TabBar（约 100rpx）+ 安全区预留空间 */
  padding-bottom: calc(32rpx + 120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
  color: #6b7280;
}

.btn {
  margin-top: 24rpx;
  background: #1677ff;
  color: #fff;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card:last-child {
  margin-bottom: 0;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.name {
  font-size: 32rpx;
  font-weight: 600;
  flex: 1;
}

.tag {
  background: #1677ff;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.meta {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
  margin-top: 8rpx;
}

.desc {
  display: block;
  color: #374151;
  font-size: 26rpx;
  margin-top: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
}

.status {
  color: #1677ff;
  font-size: 24rpx;
}

.arrow {
  color: #9ca3af;
  font-size: 24rpx;
}
</style>
