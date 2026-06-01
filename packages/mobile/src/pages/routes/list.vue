<template>
  <view class="page tab-page" :class="themeClass">
    <view class="page-header">
      <view class="routes-hero">
        <view class="hero-bg" />
        <view class="hero-content">
          <view class="header-brand">
            <view class="logo-mark">
              <text class="iconfont icon-routes hero-icon" aria-hidden="true" />
            </view>
            <view class="header-copy">
              <text class="title">{{ t('nav.routes') }}</text>
              <text class="hero-desc">{{ t('routes.pageDesc') }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="scope-panel">
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
      </view>
    </view>

    <scroll-view scroll-y class="scroll" enable-back-to-top>
      <view class="list-inner">
        <DouxingEmptyState
          v-if="routes.length === 0"
          :variant="emptyVariant"
          :title="emptyText"
          :description="emptyDescription"
          :hints="emptyHints"
          :action-label="emptyActionLabel"
          :secondary-action-label="emptySecondaryActionLabel"
          @action="handleEmptyAction"
          @secondary-action="handleEmptySecondaryAction"
        />
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
import { getStoredUser, getAppErrorMessage } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import type { DouxingEmptyVariant } from '@/components/douxing-empty-state/empty-state-variants';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
const { themeClass } = useTheme();
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

const emptyVariant = computed((): DouxingEmptyVariant => {
  if (loadError.value) return 'error';
  if (activeScope.value === 'plaza') return 'plaza';
  if (activeScope.value === 'favorites') return 'favorites';
  return 'routes';
});

const emptyDescription = computed(() => {
  if (loadError.value) return '';
  if (activeScope.value === 'plaza') return t('emptyState.routesPlazaDesc');
  if (activeScope.value === 'favorites') return t('emptyState.routesFavoritesDesc');
  return t('emptyState.routesMineDesc');
});

const emptyHints = computed(() => {
  const hints: string[] = [];
  if (loadError.value) return hints;
  if (activeScope.value === 'mine' && currentUserLabel.value) {
    hints.push(emptyAccountLine.value);
  }
  if (activeScope.value === 'mine' && statusFilter.value !== undefined) {
    hints.push(emptyFilterHintLine.value);
  }
  return hints;
});

const emptyActionLabel = computed(() => {
  if (loadError.value) return t('common.refresh');
  if (activeScope.value === 'mine') return t('routes.goPlan');
  if (activeScope.value === 'favorites') return t('emptyState.explorePlaza');
  return t('routes.goPlan');
});

const emptySecondaryActionLabel = computed(() => {
  if (activeScope.value === 'mine' && statusFilter.value !== undefined) {
    return t('emptyState.filterReset');
  }
  return undefined;
});

function handleEmptyAction() {
  if (loadError.value) {
    void loadRoutes();
    return;
  }
  if (activeScope.value === 'favorites') {
    uni.setStorageSync('routes_initial_scope', 'plaza');
    switchScope('plaza');
    return;
  }
  goPlan();
}

function handleEmptySecondaryAction() {
  statusFilter.value = undefined;
  void loadRoutes();
}

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
    loadError.value = getAppErrorMessage(e, t('routes.loadFailed'));
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
  const pendingScope = uni.getStorageSync('routes_initial_scope');
  if (pendingScope === 'plaza' || pendingScope === 'favorites') {
    activeScope.value = pendingScope;
    uni.removeStorageSync('routes_initial_scope');
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
  --page-gutter: 32rpx;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dx-bg);
  box-sizing: border-box;
  overflow: hidden;
}
.page-header {
  flex-shrink: 0;
}
.routes-hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 28rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.header-brand {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.logo-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-icon {
  color: var(--dx-text-inverse);
  font-size: 32rpx;
}
.header-copy {
  flex: 1;
  min-width: 0;
}
.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}
.hero-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}
.scope-panel {
  margin: 0 var(--page-gutter) 16rpx;
  padding: 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.tabs {
  display: flex;
  background: var(--dx-bg);
  padding: 8rpx;
  border-radius: var(--dx-radius-lg);
  gap: 8rpx;
}
.tab {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  padding: 12rpx 8rpx;
  border-radius: var(--dx-radius-md);
}
.tab.active {
  background: var(--dx-surface);
  color: var(--dx-primary);
  font-weight: 600;
  box-shadow: var(--dx-shadow-sm);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}
.chip {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  background: var(--dx-bg);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
.chip.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}
.scroll {
  flex: 1;
  height: 0;
  width: 100%;
}
.list-inner {
  padding: 0 var(--page-gutter) 24rpx;
  padding-bottom: calc(32rpx + 120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--dx-shadow-sm);
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
  color: var(--dx-text);
}
.tag {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}
.meta {
  display: block;
  color: var(--dx-text-secondary);
  font-size: 24rpx;
  margin-top: 8rpx;
}
.author {
  display: block;
  color: var(--dx-primary);
  font-size: 22rpx;
  margin-top: 6rpx;
}
.desc {
  display: block;
  color: var(--dx-text);
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
  color: var(--dx-text-muted);
}
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
}
.status {
  color: var(--dx-primary);
  font-size: 24rpx;
}
.arrow {
  color: var(--dx-text-muted);
  font-size: 24rpx;
}
</style>
