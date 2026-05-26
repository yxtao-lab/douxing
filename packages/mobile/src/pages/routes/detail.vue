<template>
  <AiPlanBlockingOverlay />
  <view class="page" v-if="route">
    <view class="hero">
      <text class="title">{{ route.name }}</text>
      <text class="meta">{{ heroMeta }}</text>
      <text class="desc">{{ route.description }}</text>
      <view class="stats-row">
        <text class="stat">{{ statViews }}</text>
        <text class="stat">{{ statLikes }}</text>
        <text class="stat">{{ statCollects }}</text>
        <text class="stat">{{ statComments }}</text>
      </view>
      <text v-if="route.creatorNickname && !isOwner" class="author">{{ authorLine }}</text>
    </view>

    <view v-if="showShareSetting" class="card share-card">
      <view class="share-row">
        <view>
          <text class="share-title">{{ t('routes.shareTitle') }}</text>
          <text class="share-hint">{{ t('routes.shareHint') }}</text>
        </view>
        <switch :checked="route.isPublic" :disabled="sharing" @change="handleShareToggle" color="#1677ff" />
      </view>
    </view>

    <view v-if="showInteraction" class="card interact-card">
      <button class="btn-interact" :class="{ active: route.isLiked }" @click="handleLike">
        {{ route.isLiked ? t('routes.liked') : t('routes.like') }}
      </button>
      <button class="btn-interact" :class="{ active: route.isFavorited }" @click="handleFavorite">
        {{ route.isFavorited ? t('routes.favorited') : t('routes.favorite') }}
      </button>
    </view>

    <view v-if="showDraftEdit" class="card edit-card">
      <text class="edit-title">{{ t('routes.editDraftTitle') }}</text>
      <input v-model="editName" class="edit-input" :placeholder="t('routes.namePlaceholder')" />
      <textarea v-model="editDesc" class="edit-textarea" :placeholder="t('routes.descPlaceholder')" />
      <button class="btn-save-draft" :loading="savingDraft" @click="handleSaveDraft">{{ t('routes.saveDraft') }}</button>
    </view>

    <view class="card" v-if="!isUnlocked">
      <text class="lock-tip">{{ t('routes.lockTip') }}</text>
      <text class="price">¥{{ unlockPrice }}</text>
      <button class="btn-primary" :loading="paying" @click="handleUnlock">{{ unlockPayLabel }}</button>
    </view>

    <view class="card" v-else>
      <view v-for="(day, idx) in days" :key="idx" class="day-block">
        <text class="day-title">{{ dayTitle(day) }}</text>
        <view v-for="(spot, si) in day.attractions" :key="si" class="spot">
          <text class="spot-name">{{ spot.name }}</text>
          <text class="spot-time">{{ spot.time }} · ¥{{ spot.cost }}</text>
          <text class="spot-desc">{{ spot.description }}</text>
          <button size="mini" class="btn-checkin" @click="handleCheckIn(spot)">{{ t('routes.checkInHere') }}</button>
        </view>
      </view>
    </view>

    <view v-if="canRegenerate" class="card regenerate-card">
      <text class="regenerate-title">{{ t('routes.regenerateTitle') }}</text>
      <text class="regenerate-hint">{{ regenerateHint }}</text>
      <textarea
        v-model="regeneratePrompt"
        class="regenerate-input"
        :placeholder="t('routes.regeneratePlaceholder')"
        :maxlength="200"
      />
      <button class="btn-regenerate" :loading="aiPlanning" :disabled="aiPlanning" @click="handleRegenerate">
        {{ t('routes.regenerateBtn') }}
      </button>
    </view>

    <view v-if="showComments" class="card comments-card">
      <text class="comments-title">{{ t('routes.commentsTitle') }}</text>
      <view v-if="comments.length === 0" class="comments-empty">{{ t('routes.commentsEmpty') }}</view>
      <view v-for="c in comments" :key="c.id" class="comment-item">
        <text class="comment-user">{{ c.userNickname }}</text>
        <text class="comment-content">{{ c.content }}</text>
      </view>
      <textarea
        v-model="commentText"
        class="comment-input"
        :placeholder="t('routes.commentPlaceholder')"
        :maxlength="500"
      />
      <button class="btn-comment" :loading="postingComment" @click="handlePostComment">{{ t('routes.postComment') }}</button>
    </view>

    <view class="actions">
      <button v-if="route.status !== publishedStatus" class="btn-outline" @click="handlePublish">{{ t('routes.publishRoute') }}</button>
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
import { aiPlanLoadingState, isAiPlanCancelledError } from '@/utils/ai-plan-loading';
import { getStoredUser } from '@/utils/request';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.routeDetail');

const { joinLabels } = useInterestTagLabel();

const route = ref<TravelRouteInfo | null>(null);
const publishedStatus = RouteStatus.PUBLISHED;
const paying = ref(false);
const routeUnlockPaymentRequired = ref(false);
const unlockPayLabel = computed(() => getUnlockPayButtonLabel());
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
    ? t('routes.regenerateHintUnlockReset')
    : t('routes.regenerateHint'),
);

const authorLine = computed(() => {
  if (!route.value?.creatorNickname) return '';
  return tf('routes.authorShare', { name: route.value.creatorNickname });
});

const statViews = computed(() =>
  tf('routes.statViews', { count: route.value?.viewCount ?? 0 }),
);
const statLikes = computed(() =>
  tf('routes.statLikes', { count: route.value?.likeCount ?? 0 }),
);
const statCollects = computed(() =>
  tf('routes.statCollects', { count: route.value?.collectCount ?? 0 }),
);
const statComments = computed(() =>
  tf('routes.statComments', { count: route.value?.commentCount ?? 0 }),
);

const checkInSheetItems = computed(() => [
  t('routes.checkInDirect'),
  t('routes.checkInWithPhoto'),
]);

function dayTitle(day: { date: string; title: string }) {
  return tf('routes.dayTitle', { date: day.date, title: day.title });
}

const unlockPrice = computed(() => {
  const detail = route.value?.routeDetail as Record<string, unknown> | null;
  return (detail?.unlockPrice as number) ?? route.value?.unlockPrice ?? 9.9;
});

const tags = computed(() => joinLabels.value(route.value?.interestTags));

const heroMeta = computed(() => {
  if (!route.value) return '';
  return tf('routes.metaHero', {
    days: route.value.days,
    budget: route.value.budgetRange ?? '',
    tags: tags.value,
  });
});

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
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.loadFailed'), icon: 'none' });
  }
}

async function handleShareToggle(e: { detail: { value: boolean } }) {
  const next = e.detail.value;
  sharing.value = true;
  try {
    route.value = await setRoutePublicShare(routeId, { isPublic: next });
    uni.showToast({ title: next ? t('routes.shareOn') : t('routes.shareOff'), icon: 'success' });
    await loadComments();
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : t('routes.shareSetFailed'), icon: 'none' });
    await loadDetail();
  } finally {
    sharing.value = false;
  }
}

async function handlePostComment() {
  const text = commentText.value.trim();
  if (!text) {
    uni.showToast({ title: t('routes.commentRequired'), icon: 'none' });
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
    uni.showToast({ title: t('routes.commentSuccess'), icon: 'success' });
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : t('routes.commentFailed'), icon: 'none' });
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
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.operationFailed'), icon: 'none' });
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
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.operationFailed'), icon: 'none' });
  }
}

async function handleSaveDraft() {
  const name = editName.value.trim();
  if (!name) {
    uni.showToast({ title: t('routes.nameRequired'), icon: 'none' });
    return;
  }
  savingDraft.value = true;
  try {
    route.value = await updateRouteDraft(routeId, {
      name,
      description: editDesc.value.trim() || null,
    });
    uni.showToast({ title: t('routes.draftSaved'), icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.saveFailed'), icon: 'none' });
  } finally {
    savingDraft.value = false;
  }
}

async function handleRegenerate() {
  if (aiPlanLoadingState.active) return;
  const text = regeneratePrompt.value.trim();
  if (!text) {
    uni.showToast({ title: t('routes.regeneratePromptRequired'), icon: 'none' });
    return;
  }
  try {
    const result = await regenerateRoute(routeId, { prompt: text });
    let tip = t('routes.regenerateTemplate');
    if (result.generationSource === 'llm') {
      tip =
        result.llmProvider === 'ai-service'
          ? t('routes.regenerateAiService')
          : result.llmProvider === 'deepseek'
            ? t('routes.regenerateDeepseek')
            : result.llmProvider === 'lmstudio'
              ? t('routes.regenerateLmstudio')
              : t('routes.regenerateAi');
    }
    uni.showToast({ title: tip, icon: 'success' });
    route.value = result;
    regeneratePrompt.value = result.sourcePrompt ?? text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('routes.regenerateFailed');
    if (!isAiPlanCancelledError(e)) {
      uni.showToast({ title: msg, icon: 'none' });
    }
  }
}

async function handleUnlock() {
  paying.value = true;
  try {
    await completeRouteUnlockPayment(routeId);
    uni.showToast({ title: t('routes.unlockSuccess'), icon: 'success' });
    await loadDetail();
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('routes.payFailed');
    if (msg !== t('routes.payCancelled')) {
      uni.showToast({ title: msg, icon: 'none' });
    }
  } finally {
    paying.value = false;
  }
}

async function handlePublish() {
  try {
    route.value = await publishRoute(routeId);
    uni.showToast({ title: t('routes.publishSuccess'), icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.publishFailed'), icon: 'none' });
  }
}

async function handleCheckIn(spot: RouteDayAttraction) {
  try {
    uni.showActionSheet({
      itemList: checkInSheetItems.value,
      success: async (res) => {
        try {
          uni.showLoading({ title: t('routes.locating') });
          const gps = await getCurrentLocation();

          let photos: string[] | undefined;
          if (res.tapIndex === 1) {
            uni.showLoading({ title: t('routes.uploading') });
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

          uni.showLoading({ title: t('routes.checkingIn') });
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

          let msg = tf('routes.checkInSuccess', { points: result.checkIn.pointsEarned });
          if (result.newAchievements.length > 0) {
            msg += tf('routes.checkInAchievements', { count: result.newAchievements.length });
          }
          if (result.newBadges?.length > 0) {
            msg += tf('routes.checkInBadges', { count: result.newBadges.length });
          }
          uni.showToast({ title: msg, icon: 'success' });
        } catch (e) {
          uni.showToast({ title: e instanceof Error ? e.message : t('routes.checkInFailed'), icon: 'none' });
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
