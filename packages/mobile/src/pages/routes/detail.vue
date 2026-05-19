<template>
  <view class="page" v-if="route">
    <view class="hero">
      <text class="title">{{ route.name }}</text>
      <text class="meta">{{ route.days }}天 · {{ route.budgetRange }} · {{ tags }}</text>
      <text class="desc">{{ route.description }}</text>
    </view>

    <view class="card" v-if="!isUnlocked">
      <text class="lock-tip">完整行程需解锁后查看</text>
      <text class="price">¥{{ unlockPrice }}</text>
      <button class="btn-primary" :loading="paying" @click="handleUnlock">解锁路线（模拟支付）</button>
    </view>

    <view class="card" v-else>
      <view v-for="(day, idx) in days" :key="idx" class="day-block">
        <text class="day-title">{{ day.date }} · {{ day.title }}</text>
        <view v-for="(spot, si) in day.attractions" :key="si" class="spot">
          <text class="spot-name">{{ spot.name }}</text>
          <text class="spot-time">{{ spot.time }} · ¥{{ spot.cost }}</text>
          <text class="spot-desc">{{ spot.description }}</text>
          <button size="mini" class="btn-checkin" @click="handleCheckIn(spot.name)">在此打卡</button>
        </view>
      </view>
    </view>

    <view class="actions">
      <button v-if="route.status !== publishedStatus" class="btn-outline" @click="handlePublish">发布路线</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { TravelRouteInfo } from '@douxing/shared';
import { fetchRouteDetail, publishRoute } from '@/api/routes';
import { createUnlockOrder, payOrder } from '@/api/orders';
import { createCheckIn } from '@/api/checkins';
import { RouteStatus } from '@douxing/shared';

const route = ref<TravelRouteInfo | null>(null);
const publishedStatus = RouteStatus.PUBLISHED;
const paying = ref(false);
let routeId = 0;

const isUnlocked = computed(() => {
  const detail = route.value?.routeDetail as Record<string, unknown> | null;
  return detail?.isUnlocked === true || (route.value?.unlockPrice ?? 0) === 0;
});

const unlockPrice = computed(() => {
  const detail = route.value?.routeDetail as Record<string, unknown> | null;
  return (detail?.unlockPrice as number) ?? route.value?.unlockPrice ?? 9.9;
});

const tags = computed(() => route.value?.interestTags?.join('、') ?? '');

const days = computed(() => {
  const detail = route.value?.routeDetail as { days?: Array<{
    date: string;
    title: string;
    attractions: Array<{ name: string; time: string; cost: number; description: string }>;
  }> } | null;
  return detail?.days ?? [];
});

async function loadDetail() {
  try {
    route.value = await fetchRouteDetail(routeId);
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' });
  }
}

async function handleUnlock() {
  paying.value = true;
  try {
    const order = await createUnlockOrder(routeId);
    await payOrder(order.id);
    uni.showToast({ title: '解锁成功', icon: 'success' });
    await loadDetail();
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '支付失败', icon: 'none' });
  } finally {
    paying.value = false;
  }
}

async function handlePublish() {
  try {
    route.value = await publishRoute(routeId);
    uni.showToast({ title: '已发布', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '发布失败', icon: 'none' });
  }
}

async function handleCheckIn(placeName: string) {
  try {
    const result = await createCheckIn({
      routeId,
      location: { placeName, address: placeName },
    });
    let msg = '打卡成功';
    if (result.newAchievements.length > 0) {
      msg += `，解锁成就 ${result.newAchievements.length} 个`;
    }
    uni.showToast({ title: msg, icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '打卡失败', icon: 'none' });
  }
}

onLoad((query) => {
  routeId = parseInt(String(query?.id ?? '0'), 10);
  if (routeId) loadDetail();
});
</script>

<style scoped>
.page {
  padding: 24rpx;
  background: #f5f7fa;
  min-height: 100vh;
}
.hero {
  background: linear-gradient(135deg, #1677ff, #69b1ff);
  color: #fff;
  padding: 40rpx 32rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}
.title {
  font-size: 36rpx;
  font-weight: 600;
  display: block;
}
.meta {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 8rpx;
  display: block;
}
.desc {
  font-size: 26rpx;
  margin-top: 16rpx;
  display: block;
  line-height: 1.5;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.lock-tip {
  display: block;
  color: #6b7280;
}
.price {
  font-size: 48rpx;
  color: #1677ff;
  font-weight: 600;
  margin: 16rpx 0;
  display: block;
}
.btn-primary {
  background: #1677ff;
  color: #fff;
}
.day-title {
  font-weight: 600;
  font-size: 30rpx;
  display: block;
  margin-bottom: 16rpx;
}
.spot {
  border-left: 4rpx solid #1677ff;
  padding-left: 20rpx;
  margin-bottom: 24rpx;
}
.spot-name {
  font-size: 28rpx;
  font-weight: 500;
  display: block;
}
.spot-time {
  color: #6b7280;
  font-size: 24rpx;
  display: block;
  margin-top: 4rpx;
}
.spot-desc {
  color: #374151;
  font-size: 24rpx;
  display: block;
  margin-top: 4rpx;
}
.btn-checkin {
  margin-top: 12rpx;
  background: #e8f3ff;
  color: #1677ff;
}
.actions {
  padding-bottom: 48rpx;
}
.btn-outline {
  background: #fff;
  color: #1677ff;
  border: 1rpx solid #1677ff;
}
</style>
