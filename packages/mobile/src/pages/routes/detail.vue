<template>
  <AiPlanBlockingOverlay />
  <view class="page" v-if="route">
    <view class="hero">
      <view class="hero-top">
        <view class="hero-title-wrap">
          <view class="title-row">
            <text class="title">{{ route.name }}</text>
            <text v-if="isOwner" class="status-badge" :class="routeStatusClass">{{ routeStatusLabel }}</text>
          </view>
          <text class="meta">{{ heroMeta }}</text>
        </view>
        <view
          v-if="canEditRouteInfo"
          class="hero-edit-btn"
          :aria-label="t('routes.editRouteInfo')"
          @click.stop="openEditModal"
        >
          <image class="hero-edit-icon" src="/static/iconfont/svg/edit.svg" mode="aspectFit" />
        </view>
      </view>
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

    <view v-if="isUnlocked && routePath" class="card map-card">
      <RouteMapPlayer :route-path="routePath" :auto-play="true" />
    </view>

    <view v-if="showInteraction" class="card interact-card">
      <button class="btn-interact" :class="{ active: route.isLiked }" @click="handleLike">
        {{ route.isLiked ? t('routes.liked') : t('routes.like') }}
      </button>
      <button class="btn-interact" :class="{ active: route.isFavorited }" @click="handleFavorite">
        {{ route.isFavorited ? t('routes.favorited') : t('routes.favorite') }}
      </button>
    </view>

    <view v-if="editModalVisible" class="edit-modal-mask" @click="closeEditModal">
      <view class="edit-modal" @click.stop>
        <view class="edit-modal-header">
          <text class="edit-modal-title">{{ t('routes.editDraftTitle') }}</text>
          <text class="edit-modal-close" @click="closeEditModal">×</text>
        </view>
        <text class="edit-modal-hint">{{ t('routes.editDraftHint') }}</text>
        <scroll-view scroll-y class="edit-modal-body" :show-scrollbar="true">
          <view class="edit-field">
            <text class="edit-label">{{ t('routes.editNameLabel') }}</text>
            <textarea
              v-model="editName"
              class="edit-textarea edit-textarea--name"
              :style="{ minHeight: editNameMinHeight }"
              :placeholder="t('routes.nameInputPlaceholder')"
              auto-height
              :maxlength="128"
            />
          </view>
          <view class="edit-field">
            <text class="edit-label">{{ t('routes.editDescLabel') }}</text>
            <textarea
              v-model="editDesc"
              class="edit-textarea"
              :style="{ minHeight: editDescMinHeight }"
              :placeholder="t('routes.descInputPlaceholder')"
              auto-height
              :maxlength="500"
            />
          </view>
        </scroll-view>
        <view class="edit-modal-actions">
          <button class="btn-edit-cancel" @click="closeEditModal">{{ t('routes.editCancel') }}</button>
          <button class="btn-save-draft" :loading="savingDraft" @click="handleSaveDraft">
            {{ t('routes.saveDraft') }}
          </button>
        </view>
      </view>
    </view>

    <view class="card" v-if="!isUnlocked">
      <text class="lock-tip">{{ t('routes.lockTip') }}</text>
      <text class="price">¥{{ unlockPrice }}</text>
      <button class="btn-primary" :loading="paying" @click="handleUnlock">{{ unlockPayLabel }}</button>
    </view>

    <view class="card" v-else>
      <RouteDayFlowChart
        :days="days"
        show-check-in
        @check-in="handleCheckIn"
      />
      <view v-for="(day, idx) in days" :key="`warn-${idx}`">
        <view v-if="day.warnings?.length" class="day-warnings">
          <text v-for="(warn, wi) in day.warnings" :key="`w-${wi}`" class="warning-text">{{ warn }}</text>
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
import type {
  RouteDayAttraction,
  RouteDayPlan,
  RouteDetailPayload,
  TravelRouteInfo,
  RouteCommentInfo,
} from '@douxing/shared';
import { buildRoutePathFromDetail } from '@douxing/shared';
import {
  fetchRouteDetail,
  fetchRouteMapPath,
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
import RouteMapPlayer from '@/components/route-map/RouteMapPlayer.vue';
import RouteDayFlowChart from '@/components/route-day-flow/RouteDayFlowChart.vue';
import { aiPlanLoadingState, isAiPlanCancelledError } from '@/utils/ai-plan-loading';
import { getStoredUser } from '@/utils/request';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.routeDetail');

const { joinLabels } = useInterestTagLabel();

const route = ref<TravelRouteInfo | null>(null);
const routePath = ref<ReturnType<typeof buildRoutePathFromDetail>>(null);
const publishedStatus = RouteStatus.PUBLISHED;
const paying = ref(false);
const routeUnlockPaymentRequired = ref(false);
const unlockPayLabel = computed(() => getUnlockPayButtonLabel());
const regeneratePrompt = ref('');
const editName = ref('');
const editDesc = ref('');
const editModalVisible = ref(false);
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

const canEditRouteInfo = computed(
  () => isOwner.value && route.value?.status === RouteStatus.DRAFT,
);

const routeStatusLabel = computed(() => {
  if (!route.value) return '';
  if (route.value.status === RouteStatus.PUBLISHED) return t('routes.statusPublished');
  if (route.value.status === RouteStatus.ARCHIVED) return t('routes.statusArchived');
  return t('routes.statusDraft');
});

const routeStatusClass = computed(() => {
  if (!route.value) return '';
  if (route.value.status === RouteStatus.PUBLISHED) return 'status-published';
  if (route.value.status === RouteStatus.ARCHIVED) return 'status-archived';
  return 'status-draft';
});

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

const days = computed((): RouteDayPlan[] => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return detail?.days ?? [];
});

async function loadRouteMapPath() {
  if (!route.value?.routeDetail || !isUnlocked.value) {
    routePath.value = null;
    return;
  }

  try {
    routePath.value = await fetchRouteMapPath(routeId);
  } catch {
    routePath.value = buildRoutePathFromDetail(
      route.value.routeDetail as unknown as RouteDetailPayload,
      {
        routeId: route.value.id,
        name: route.value.name,
      },
    );
  }
}

const editDescMinHeight = computed(() =>
  computeTextareaMinHeight(editDesc.value || '', { minRpx: 160, maxRpx: 560, charsPerLine: 18 }),
);

const editNameMinHeight = computed(() =>
  computeTextareaMinHeight(editName.value || '', { minRpx: 88, maxRpx: 240, charsPerLine: 14 }),
);

function computeTextareaMinHeight(
  text: string,
  options: { minRpx: number; maxRpx: number; charsPerLine: number },
) {
  const lineCount = text.split('\n').reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / options.charsPerLine));
  }, 0);
  const heightRpx = Math.max(options.minRpx, Math.min(lineCount * 42 + 32, options.maxRpx));
  return `${heightRpx}rpx`;
}

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
    await loadRouteMapPath();
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : t('routes.loadFailed'), icon: 'none' });
  }
}

function openEditModal() {
  if (!canEditRouteInfo.value) return;
  editName.value = route.value?.name ?? '';
  editDesc.value = route.value?.description ?? '';
  editModalVisible.value = true;
}

function closeEditModal() {
  editModalVisible.value = false;
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
    editModalVisible.value = false;
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
    await loadRouteMapPath();
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
.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.hero-title-wrap {
  flex: 1;
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.title {
  font-size: 36rpx;
  font-weight: 600;
}
.status-badge {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  line-height: 1.4;
  background: rgba(255, 255, 255, 0.22);
}
.status-badge.status-published {
  background: rgba(255, 255, 255, 0.28);
}
.status-badge.status-archived {
  background: rgba(0, 0, 0, 0.18);
}
.hero-edit-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-edit-icon {
  width: 32rpx;
  height: 32rpx;
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
.map-card {
  padding: 24rpx;
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
.edit-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}
.edit-modal {
  width: 100%;
  max-width: 640rpx;
  max-height: 82vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 16rpx 48rpx rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.edit-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.edit-modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}
.edit-modal-close {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-size: 40rpx;
  color: #9ca3af;
}
.edit-modal-hint {
  display: block;
  margin-top: 12rpx;
  margin-bottom: 16rpx;
  font-size: 22rpx;
  color: #9ca3af;
  line-height: 1.5;
}
.edit-modal-body {
  flex: 1;
  height: 52vh;
  max-height: 52vh;
}
.edit-field {
  margin-bottom: 20rpx;
}
.edit-field:last-child {
  margin-bottom: 0;
}
.edit-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
}
.edit-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 26rpx;
  line-height: 1.6;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 8rpx;
  box-sizing: border-box;
}
.edit-textarea--name {
  min-height: 88rpx;
  font-size: 28rpx;
  line-height: 1.5;
}
.edit-modal-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
.btn-edit-cancel,
.btn-save-draft {
  flex: 1;
  margin: 0;
  font-size: 28rpx;
  border: none;
  border-radius: 12rpx;
}
.btn-edit-cancel {
  background: #f3f4f6;
  color: #374151;
}
.btn-save-draft {
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
.day-block {
  margin-bottom: 32rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f3f4f6;
}
.day-block:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}
.day-section {
  margin-bottom: 24rpx;
}
.section-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #1677ff;
  margin-bottom: 12rpx;
  letter-spacing: 1rpx;
}
.transit-item {
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}
.transit-route {
  font-size: 26rpx;
  font-weight: 500;
  display: block;
  color: #1f2937;
}
.transit-meta,
.transit-time {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-top: 4rpx;
}
.transit-estimated {
  font-size: 22rpx;
  color: #d97706;
  display: block;
  margin-top: 6rpx;
}
.transit-desc,
.transit-demo-link {
  font-size: 22rpx;
  color: #9ca3af;
  display: block;
  margin-top: 4rpx;
}
.lodging-item {
  border-left: 4rpx solid #8b5cf6;
  padding-left: 20rpx;
}
.day-warnings {
  margin-top: 8rpx;
}
.warning-text {
  display: block;
  font-size: 22rpx;
  color: #d97706;
  margin-top: 4rpx;
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
