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
        :key="String(f.value)"
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
            {{ emptyAccountLine }}
          </text>
          <text v-if="activeScope === 'mine' && statusFilter !== undefined" class="empty-hint">
            {{ emptyFilterHintLine }}
          </text>
          <button v-if="activeScope === 'mine'" class="btn" @click="goPlan">{{ t('routes.goPlan') }}</button>
        </view>
        <view v-for="item in routes" :key="item.id" class="card" @click="goDetail(item)">
          <view class="card-head">
            <text class="name">{{ item.name }}</text>
            <text class="tag" v-if="item.isAiGenerated">AI</text>
          </view>
          <text class="meta">{{ cardMeta(item) }}</text>
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
            <text class="arrow">{{ t('routes.viewDetail') }}</text>
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
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.routes');

const routes = ref<TravelRouteInfo[]>([]);
const activeScope = ref<RouteListScope>('mine');
const statusFilter = ref<number | undefined>(undefined);
const currentUserLabel = ref('');
const loadError = ref('');

const scopeTabs = computed(() => [
  { id: 'mine' as RouteListScope, label: t('routes.scopeMine') },
  { id: 'plaza' as RouteListScope, label: t('routes.scopePlaza') },
  { id: 'favorites' as RouteListScope, label: t('routes.scopeFavorites') },
]);

const statusFilters = computed(() => [
  { label: t('routes.filterAll'), value: undefined as number | undefined },
  { label: t('routes.filterDraft'), value: RouteStatus.DRAFT },
  { label: t('routes.filterPublished'), value: RouteStatus.PUBLISHED },
]);

const statusFilterLabel = computed(() => {
  if (statusFilter.value === RouteStatus.PUBLISHED) return t('routes.filterPublished');
  if (statusFilter.value === RouteStatus.DRAFT) return t('routes.filterDraft');
  return t('routes.filterAll');
});

const emptyText = computed(() => {
  if (loadError.value) return loadError.value;
  if (activeScope.value === 'plaza') return t('routes.emptyPlaza');
  if (activeScope.value === 'favorites') return t('routes.emptyFavorites');
  return t('routes.emptyMine');
});

const emptyAccountLine = computed(() =>
  tf('routes.emptyAccount', { label: currentUserLabel.value }),
);

const emptyFilterHintLine = computed(() =>
  tf('routes.emptyFilterHint', { filter: statusFilterLabel.value }),
);

function statusText(status: number) {
  if (status === RouteStatus.PUBLISHED) return t('routes.statusPublished');
  if (status === RouteStatus.ARCHIVED) return t('routes.statusArchived');
  return t('routes.statusDraft');
}

function footerLabel(item: TravelRouteInfo) {
  if (activeScope.value === 'plaza') return t('routes.statusPublicShare');
  return statusText(item.status);
}

function cardMeta(item: TravelRouteInfo) {
  return tf('routes.cardMeta', {
    days: item.days,
    budget: item.budgetRange || t('routes.budgetTbd'),
  });
}

function goDetail(item: TravelRouteInfo) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${item.id}` });
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
    const msg = e instanceof Error ? e.message : t('routes.loadFailed');
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
  currentUserLabel.value =
    user.nickname || user.username || tf('routes.userFallback', { id: user.id });
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
