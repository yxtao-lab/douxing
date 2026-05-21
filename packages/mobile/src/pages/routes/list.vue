<template>
  <view class="page tab-page">
    <view class="tabs">
      <text
        v-for="tab in scopeTabs"
        :key="tab.id"
        class="tab"
        :class="{ active: activeScope === tab.id }"
        @click="switchScope(tab.id)"
      >
        {{ tab.label }}
      </text>
    </view>

    <view v-if="activeScope === 'mine'" class="filters">
      <text
        v-for="f in statusFilters"
        :key="f.value"
        class="chip"
        :class="{ active: statusFilter === f.value }"
        @click="statusFilter = f.value"
      >
        {{ f.label }}
      </text>
    </view>

    <scroll-view scroll-y class="scroll" enable-back-to-top>
      <view class="list-inner">
        <view v-if="routes.length === 0" class="empty">
          <text>{{ emptyText }}</text>
          <text v-if="activeScope === 'mine' && currentUserLabel" class="empty-user">
            当前账号：{{ currentUserLabel }}
          </text>
          <text v-if="activeScope === 'mine' && statusFilter !== undefined" class="empty-hint">
            已筛选「{{ statusFilterLabel }}」，可点「全部」查看
          </text>
          <button v-if="activeScope === 'mine'" class="btn" @click="goPlan">去规划</button>
        </view>
        <view v-for="item in routes" :key="item.id" class="card" @click="goDetail(item.id)">
          <view class="card-head">
            <text class="name">{{ item.name }}</text>
            <text class="tag" v-if="item.isAiGenerated">AI</text>
          </view>
          <text class="meta">{{ item.days }}天 · 预算 {{ item.budgetRange || '待定' }}</text>
          <text v-if="activeScope === 'plaza' && item.creatorNickname" class="author">
            @{{ item.creatorNickname }}
          </text>
          <text class="desc">{{ item.description }}</text>
          <view class="stats">
            <text class="stat">👁 {{ item.viewCount ?? 0 }}</text>
            <text class="stat">♥ {{ item.likeCount ?? 0 }}</text>
            <text class="stat">★ {{ item.collectCount ?? 0 }}</text>
            <text class="stat">💬 {{ item.commentCount ?? 0 }}</text>
          </view>
          <view class="footer">
            <text class="status">{{ footerLabel(item) }}</text>
            <text class="arrow">查看 ›</text>
          </view>
        </view>
      </view>
    </scroll-view>
    <DouxingTabBar :current="2" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { TravelRouteInfo, RouteListScope } from '@douxing/shared';
import { fetchRoutes } from '@/api/routes';
import { RouteStatus } from '@douxing/shared';
import { getStoredUser } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';

const routes = ref<TravelRouteInfo[]>([]);
const activeScope = ref<RouteListScope>('mine');
const statusFilter = ref<number | undefined>(undefined);
const currentUserLabel = ref('');
const loadError = ref('');

const scopeTabs = [
  { id: 'mine' as RouteListScope, label: '我的' },
  { id: 'plaza' as RouteListScope, label: '广场' },
  { id: 'favorites' as RouteListScope, label: '收藏' },
];

const statusFilters = [
  { label: '全部', value: undefined as number | undefined },
  { label: '草稿', value: RouteStatus.DRAFT },
  { label: '已发布', value: RouteStatus.PUBLISHED },
];

const statusFilterLabel = computed(() => {
  if (statusFilter.value === RouteStatus.PUBLISHED) return '已发布';
  if (statusFilter.value === RouteStatus.DRAFT) return '草稿';
  return '全部';
});

const emptyText = computed(() => {
  if (loadError.value) return loadError.value;
  if (activeScope.value === 'plaza') return '广场还没有公开路线，发布并分享一条吧';
  if (activeScope.value === 'favorites') return '还没有收藏，去热门看看吧';
  return '暂无路线，去「规划」生成一条吧';
});

function statusText(status: number) {
  if (status === RouteStatus.PUBLISHED) return '已发布';
  if (status === RouteStatus.ARCHIVED) return '已归档';
  return '草稿';
}

function footerLabel(item: TravelRouteInfo) {
  if (activeScope.value === 'plaza') return '公开分享';
  return statusText(item.status);
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${id}` });
}

function goPlan() {
  uni.switchTab({ url: '/pages/plan/plan' });
}

async function loadRoutes() {
  loadError.value = '';
  try {
    routes.value = await fetchRoutes({
      scope: activeScope.value,
      status: activeScope.value === 'mine' ? statusFilter.value : undefined,
      sort: activeScope.value === 'plaza' ? 'hot' : 'recent',
    });
  } catch (e) {
    routes.value = [];
    const msg = e instanceof Error ? e.message : '加载失败';
    loadError.value = msg;
    uni.showToast({ title: msg, icon: 'none' });
  }
}

function switchScope(scope: RouteListScope) {
  activeScope.value = scope;
  if (scope !== 'mine') {
    statusFilter.value = undefined;
  }
  loadRoutes();
}

onShow(async () => {
  uni.hideTabBar({ animation: false });
  const user = getStoredUser();
  if (!user) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  currentUserLabel.value = user.nickname || user.username || `用户#${user.id}`;
  await loadRoutes();
});

watch(statusFilter, () => {
  if (activeScope.value === 'mine') loadRoutes();
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

.tabs {
  display: flex;
  background: #fff;
  padding: 16rpx 24rpx 0;
  gap: 32rpx;
  flex-shrink: 0;
}

.tab {
  font-size: 28rpx;
  color: #6b7280;
  padding-bottom: 16rpx;
  border-bottom: 4rpx solid transparent;
}

.tab.active {
  color: #1677ff;
  font-weight: 600;
  border-bottom-color: #1677ff;
}

.filters {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #fff;
  flex-shrink: 0;
}

.chip {
  font-size: 24rpx;
  color: #6b7280;
  background: #f3f4f6;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
}

.chip.active {
  background: #e8f3ff;
  color: #1677ff;
}

.scroll {
  flex: 1;
  height: 0;
  width: 100%;
}

.list-inner {
  padding: 24rpx;
  padding-bottom: calc(32rpx + 120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
  color: #6b7280;
}

.empty-user,
.empty-hint {
  display: block;
  font-size: 24rpx;
  margin-top: 16rpx;
  color: #9ca3af;
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

.author {
  display: block;
  color: #1677ff;
  font-size: 22rpx;
  margin-top: 6rpx;
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

.stats {
  display: flex;
  gap: 24rpx;
  margin-top: 12rpx;
}

.stat {
  font-size: 22rpx;
  color: #9ca3af;
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
