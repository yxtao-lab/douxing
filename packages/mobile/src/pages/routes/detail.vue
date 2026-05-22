<template>
  <AiPlanBlockingOverlay />
  <view class="page" v-if="route">
    <view class="hero">
      <text class="title">{{ route.name }}</text>
      <text class="meta">{{ route.days }}天 · {{ route.budgetRange }} · {{ tags }}</text>
      <text class="desc">{{ route.description }}</text>
      <view class="stats-row">
        <text class="stat">浏览 {{ route.viewCount ?? 0 }}</text>
        <text class="stat">点赞 {{ route.likeCount ?? 0 }}</text>
        <text class="stat">收藏 {{ route.collectCount ?? 0 }}</text>
        <text class="stat">评论 {{ route.commentCount ?? 0 }}</text>
      </view>
      <text v-if="route.creatorNickname && !isOwner" class="author">分享者 @{{ route.creatorNickname }}</text>
    </view>

    <view v-if="showShareSetting" class="card share-card">
      <view class="share-row">
        <view>
          <text class="share-title">公开分享到广场</text>
          <text class="share-hint">开启后所有人可浏览、点赞、收藏与评论</text>
        </view>
        <switch :checked="route.isPublic" :disabled="sharing" @change="handleShareToggle" color="#1677ff" />
      </view>
    </view>

    <view v-if="showInteraction" class="card interact-card">
      <button class="btn-interact" :class="{ active: route.isLiked }" @click="handleLike">
        {{ route.isLiked ? '已赞' : '点赞' }}
      </button>
      <button class="btn-interact" :class="{ active: route.isFavorited }" @click="handleFavorite">
        {{ route.isFavorited ? '已藏' : '收藏' }}
      </button>
    </view>

    <view v-if="showDraftEdit" class="card edit-card">
      <text class="edit-title">编辑草稿</text>
      <input v-model="editName" class="edit-input" placeholder="路线名称" />
      <textarea v-model="editDesc" class="edit-textarea" placeholder="路线简介" />
      <button class="btn-save-draft" :loading="savingDraft" @click="handleSaveDraft">保存草稿</button>
    </view>

    <view class="card" v-if="!isUnlocked">
      <text class="lock-tip">完整行程需解锁后查看</text>
      <text class="price">¥{{ unlockPrice }}</text>
      <button class="btn-primary" :loading="paying" @click="handleUnlock">{{ unlockPayLabel }}</button>
    </view>

    <view class="card" v-else>
      <view v-for="(day, idx) in days" :key="idx" class="day-block">
        <text class="day-title">{{ day.date }} · {{ day.title }}</text>
        <view v-for="(spot, si) in day.attractions" :key="si" class="spot">
          <text class="spot-name">{{ spot.name }}</text>
          <text class="spot-time">{{ spot.time }} · ¥{{ spot.cost }}</text>
          <text class="spot-desc">{{ spot.description }}</text>
          <button size="mini" class="btn-checkin" @click="handleCheckIn(spot)">在此打卡</button>
        </view>
      </view>
    </view>

    <view v-if="canRegenerate" class="card regenerate-card">
      <text class="regenerate-title">不满意？修改需求重新生成</text>
      <text class="regenerate-hint">{{ regenerateHint }}</text>
      <textarea
        v-model="regeneratePrompt"
        class="regenerate-input"
        placeholder="描述你想要的行程，例如：增加西湖、减少购物、预算控制在3000"
        :maxlength="200"
      />
      <button class="btn-regenerate" :loading="aiPlanning" :disabled="aiPlanning" @click="handleRegenerate">
        重新生成
      </button>
    </view>

    <view v-if="showComments" class="card comments-card">
      <text class="comments-title">评论</text>
      <view v-if="comments.length === 0" class="comments-empty">暂无评论，来说两句吧</view>
      <view v-for="c in comments" :key="c.id" class="comment-item">
        <text class="comment-user">{{ c.userNickname }}</text>
        <text class="comment-content">{{ c.content }}</text>
      </view>
      <textarea
        v-model="commentText"
        class="comment-input"
        placeholder="写下你的看法…"
        :maxlength="500"
      />
      <button class="btn-comment" :loading="postingComment" @click="handlePostComment">发表评论</button>
    </view>

    <view class="actions">
      <button v-if="route.status !== publishedStatus" class="btn-outline" @click="handlePublish">发布路线</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { RouteDayAttraction, TravelRouteInfo, RouteCommentInfo } from '@douxing/shared';
import {
  fetchRouteDetail,
  publishRoute,
  regenerateRoute,
  updateRouteDraft,
  toggleRouteLike,
  toggleRouteFavorite,
  setRoutePublicShare,
  fetchRouteComments,
  createRouteComment,
} from '@/api/routes';
import { completeRouteUnlockPayment, getUnlockPayButtonLabel } from '@/utils/order-payment';
import { fetchOrderPaymentConfig } from '@/api/orders';
import { createCheckIn, uploadCheckInPhoto } from '@/api/checkins';
import { getCurrentLocation } from '@/utils/location';
import { RouteStatus } from '@douxing/shared';
import AiPlanBlockingOverlay from '@/components/ai-plan-blocking-overlay/AiPlanBlockingOverlay.vue';
import { aiPlanLoadingState, AI_PLAN_CANCELLED_MESSAGE } from '@/utils/ai-plan-loading';
import { getStoredUser } from '@/utils/request';

const route = ref<TravelRouteInfo | null>(null);
const publishedStatus = RouteStatus.PUBLISHED;
const paying = ref(false);
const routeUnlockPaymentRequired = ref(false);
const unlockPayLabel = getUnlockPayButtonLabel();
const regeneratePrompt = ref('');
const editName = ref('');
const editDesc = ref('');
const savingDraft = ref(false);
const sharing = ref(false);
const comments = ref<RouteCommentInfo[]>([]);
const commentText = ref('');
const postingComment = ref(false);
const aiPlanning = computed(() => aiPlanLoadingState.active);
let routeId = 0;

const currentUserId = computed(() => getStoredUser()?.id ?? 0);

const isOwner = computed(
  () => route.value != null && route.value.creatorId === currentUserId.value,
);

const isDraft = computed(() => route.value?.status === RouteStatus.DRAFT);

const allowDraftEdit = ref(false);

const showDraftEdit = computed(
  () => isDraft.value && isOwner.value && allowDraftEdit.value,
);

const showShareSetting = computed(
  () => isOwner.value && route.value?.status === RouteStatus.PUBLISHED,
);

const showInteraction = computed(() => route.value?.isPublic === true);

const showComments = computed(() => route.value?.isPublic === true);

const canRegenerate = computed(
  () =>
    route.value?.isAiGenerated === true && route.value?.status === RouteStatus.DRAFT,
);

const isUnlocked = computed(() => {
  if (route.value?.isPublic && !isOwner.value) return true;
  if (!routeUnlockPaymentRequired.value && isOwner.value) return true;
  const detail = route.value?.routeDetail as Record<string, unknown> | null;
  return detail?.isUnlocked === true || (route.value?.unlockPrice ?? 0) === 0;
});

const regenerateHint = computed(() =>
  routeUnlockPaymentRequired.value
    ? '将覆盖当前草稿行程，解锁状态会重置'
    : '将覆盖当前草稿行程',
);

const unlockPrice = computed(() => {
  const detail = route.value?.routeDetail as Record<string, unknown> | null;
  return (detail?.unlockPrice as number) ?? route.value?.unlockPrice ?? 9.9;
});

const tags = computed(() => route.value?.interestTags?.join('、') ?? '');

const matchedCity = computed(() => {
  const detail = route.value?.routeDetail as { matchedCity?: string } | null;
  return detail?.matchedCity;
});

const days = computed(() => {
  const detail = route.value?.routeDetail as { days?: Array<{
    date: string;
    title: string;
    attractions: RouteDayAttraction[];
  }> } | null;
  return detail?.days ?? [];
});

async function loadComments() {
  if (!route.value?.isPublic) {
    comments.value = [];
    return;
  }
  try {
    comments.value = await fetchRouteComments(routeId);
  } catch {
    comments.value = [];
  }
}

async function loadDetail() {
  try {
    route.value = await fetchRouteDetail(routeId);
    editName.value = route.value?.name ?? '';
    editDesc.value = route.value?.description ?? '';
    if (route.value?.sourcePrompt) {
      regeneratePrompt.value = route.value.sourcePrompt;
    } else if (canRegenerate.value && !regeneratePrompt.value) {
      regeneratePrompt.value = route.value?.description ?? '';
    }
    await loadComments();
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' });
  }
}

async function handleShareToggle(e: { detail: { value: boolean } }) {
  const next = e.detail.value;
  sharing.value = true;
  try {
    route.value = await setRoutePublicShare(routeId, { isPublic: next });
    uni.showToast({ title: next ? '已公开到广场' : '已取消公开', icon: 'success' });
    await loadComments();
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '设置失败', icon: 'none' });
    await loadDetail();
  } finally {
    sharing.value = false;
  }
}

async function handlePostComment() {
  const text = commentText.value.trim();
  if (!text) {
    uni.showToast({ title: '请输入评论', icon: 'none' });
    return;
  }
  postingComment.value = true;
  try {
    const created = await createRouteComment(routeId, { content: text });
    comments.value = [created, ...comments.value];
    if (route.value) {
      route.value.commentCount = (route.value.commentCount ?? 0) + 1;
    }
    commentText.value = '';
    uni.showToast({ title: '评论成功', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '评论失败', icon: 'none' });
  } finally {
    postingComment.value = false;
  }
}

async function handleLike() {
  try {
    const result = await toggleRouteLike(routeId);
    if (route.value) {
      route.value.isLiked = result.liked;
      route.value.likeCount = result.likeCount;
    }
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
  }
}

async function handleFavorite() {
  try {
    const result = await toggleRouteFavorite(routeId);
    if (route.value) {
      route.value.isFavorited = result.favorited;
      route.value.collectCount = result.collectCount;
    }
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
  }
}

async function handleSaveDraft() {
  const name = editName.value.trim();
  if (!name) {
    uni.showToast({ title: '请输入路线名称', icon: 'none' });
    return;
  }
  savingDraft.value = true;
  try {
    route.value = await updateRouteDraft(routeId, {
      name,
      description: editDesc.value.trim() || null,
    });
    uni.showToast({ title: '草稿已保存', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '保存失败', icon: 'none' });
  } finally {
    savingDraft.value = false;
  }
}

async function handleRegenerate() {
  if (aiPlanLoadingState.active) return;
  const text = regeneratePrompt.value.trim();
  if (!text) {
    uni.showToast({ title: '请输入旅行需求', icon: 'none' });
    return;
  }
  try {
    const result = await regenerateRoute(routeId, { prompt: text });
    let tip = '已重新生成（模板模式）';
    if (result.generationSource === 'llm') {
      tip =
        result.llmProvider === 'deepseek'
          ? 'DeepSeek 重新生成成功'
          : result.llmProvider === 'lmstudio'
            ? '本地模型重新生成成功'
            : 'AI 重新生成成功';
    }
    uni.showToast({ title: tip, icon: 'success' });
    route.value = result;
    regeneratePrompt.value = result.sourcePrompt ?? text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '重新生成失败';
    if (msg !== AI_PLAN_CANCELLED_MESSAGE) {
      uni.showToast({ title: msg, icon: 'none' });
    }
  }
}

async function handleUnlock() {
  paying.value = true;
  try {
    await completeRouteUnlockPayment(routeId);
    uni.showToast({ title: '解锁成功', icon: 'success' });
    await loadDetail();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '支付失败';
    if (msg !== '已取消支付') {
      uni.showToast({ title: msg, icon: 'none' });
    }
  } finally {
    paying.value = false;
  }
}

async function handlePublish() {
  try {
    route.value = await publishRoute(routeId);
    uni.showToast({ title: '已发布，可开启广场分享', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '发布失败', icon: 'none' });
  }
}

async function handleCheckIn(spot: RouteDayAttraction) {
  try {
    uni.showActionSheet({
      itemList: ['直接打卡', '添加照片打卡'],
      success: async (res) => {
        try {
          uni.showLoading({ title: '定位中...' });
          const gps = await getCurrentLocation();

          let photos: string[] | undefined;
          if (res.tapIndex === 1) {
            uni.showLoading({ title: '上传中...' });
            const choose = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
              uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: resolve,
                fail: reject,
              });
            });
            const filePath = choose.tempFilePaths[0];
            if (filePath) {
              const url = await uploadCheckInPhoto(filePath);
              photos = [url];
            }
          }

          uni.showLoading({ title: '打卡中...' });
          const result = await createCheckIn({
            routeId,
            attractionId: spot.attractionId,
            cityName: matchedCity.value,
            targetLatitude: spot.latitude,
            targetLongitude: spot.longitude,
            gpsAccuracy: gps.accuracy,
            location: {
              placeName: spot.name,
              address: spot.name,
              latitude: gps.latitude,
              longitude: gps.longitude,
            },
            photos,
          });

          let msg = `打卡成功 +${result.checkIn.pointsEarned} 积分`;
          if (result.newAchievements.length > 0) {
            msg += `，解锁成就 ${result.newAchievements.length} 个`;
          }
          if (result.newBadges?.length > 0) {
            msg += `，解锁徽章 ${result.newBadges.length} 个`;
          }
          uni.showToast({ title: msg, icon: 'success' });
        } catch (e) {
          uni.showToast({ title: e instanceof Error ? e.message : '打卡失败', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      },
    });
  } catch {
    // 用户取消选择
  }
}

onLoad((query) => {
  routeId = parseInt(String(query?.id ?? '0'), 10);
  allowDraftEdit.value = query?.edit === '1';
  if (getStoredUser()) {
    fetchOrderPaymentConfig()
      .then((config) => {
        routeUnlockPaymentRequired.value = config.routeUnlockPaymentRequired === true;
      })
      .catch(() => {
        routeUnlockPaymentRequired.value = false;
      });
  }
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
.stats-row {
  display: flex;
  gap: 24rpx;
  margin-top: 16rpx;
  opacity: 0.9;
}
.stat {
  font-size: 22rpx;
}
.author {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.95;
}
.share-card {
  border: 2rpx solid #e8f3ff;
}
.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.share-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
}
.share-hint {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 8rpx;
  display: block;
}
.interact-card {
  display: flex;
  gap: 24rpx;
}
.btn-interact {
  flex: 1;
  background: #f3f4f6;
  color: #374151;
  font-size: 28rpx;
}
.btn-interact.active {
  background: #e8f3ff;
  color: #1677ff;
}
.edit-card {
  border: 2rpx dashed #d1d5db;
}
.edit-title {
  font-size: 28rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 16rpx;
}
.edit-input {
  width: 100%;
  font-size: 28rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}
.edit-textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 26rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 8rpx;
}
.btn-save-draft {
  margin-top: 20rpx;
  background: #1677ff;
  color: #fff;
}
.comments-card {
  margin-bottom: 24rpx;
}
.comments-title {
  font-size: 30rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 16rpx;
}
.comments-empty {
  color: #9ca3af;
  font-size: 24rpx;
  margin-bottom: 16rpx;
}
.comment-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}
.comment-user {
  font-size: 24rpx;
  color: #1677ff;
  display: block;
}
.comment-content {
  font-size: 26rpx;
  color: #374151;
  margin-top: 8rpx;
  display: block;
  line-height: 1.5;
}
.comment-input {
  width: 100%;
  min-height: 120rpx;
  margin-top: 16rpx;
  font-size: 26rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 8rpx;
  box-sizing: border-box;
}
.btn-comment {
  margin-top: 16rpx;
  background: #1677ff;
  color: #fff;
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
.regenerate-card {
  border: 2rpx dashed #d1d5db;
}
.regenerate-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
}
.regenerate-hint {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 8rpx;
  display: block;
}
.regenerate-input {
  width: 100%;
  min-height: 160rpx;
  margin-top: 20rpx;
  font-size: 26rpx;
  line-height: 1.5;
}
.btn-regenerate {
  margin-top: 24rpx;
  background: #fff7ed;
  color: #d97706;
  border: 1rpx solid #fcd34d;
  border-radius: 12rpx;
}
</style>
