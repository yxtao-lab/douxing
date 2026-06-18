<template>
  <AiPlanBlockingOverlay />
  <TravelPetFloatingLayer />
  <view class="page" :class="themeClass" v-if="route">
    <view class="hero">
      <view class="hero-bg" />
      <view class="hero-inner">
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
    </view>

    <view v-if="showShareSetting" class="card share-card">
      <view class="share-row">
        <view>
          <text class="share-title">{{ t('routes.shareTitle') }}</text>
          <text class="share-hint">{{ t('routes.shareHint') }}</text>
        </view>
        <switch
          :checked="route.isPublic"
          :disabled="sharing"
          :color="switchColor"
          @change="handleShareToggle"
        />
      </view>
    </view>

    <view v-if="isUnlocked && days.length > 0 && showDetailTabs" class="detail-tabs">
      <view
        class="detail-tab"
        :class="{ active: detailTab === 'itinerary' }"
        @click="detailTab = 'itinerary'"
      >
        <text>{{ t('routes.tabItinerary') }}</text>
      </view>
      <view
        class="detail-tab"
        :class="{ active: detailTab === 'album' }"
        @click="detailTab = 'album'"
      >
        <text>{{ t('routes.tabAlbum') }}</text>
      </view>
    </view>

    <view v-if="isUnlocked && days.length > 0 && detailTab === 'itinerary'" class="card itinerary-card">
      <RouteDayTabs v-model:active-day-index="activeDayIndex" :days="days" />
      <text v-if="activeDayHeading" class="itinerary-day-heading">{{ activeDayHeading }}</text>

      <RouteMapByDay
        v-model:active-day-index="activeDayIndex"
        :route-id="routeId"
        :days="days"
        :route-detail="(route.routeDetail as Record<string, unknown>) ?? null"
        :route-name="route.name"
        :auto-play="true"
        :show-day-tabs="false"
      />

      <view class="itinerary-flow-divider" />

      <RouteDayFlowChart
        v-model:active-day-index="activeDayIndex"
        :days="days"
        :show-day-tabs="false"
        show-check-in
        @check-in="handleCheckIn"
      />
    </view>

    <view v-if="showAlbumTab && detailTab === 'album'" class="card album-card">
      <RouteJourneyAlbumPanel
        ref="albumPanelRef"
        :route-id="routeId"
        :days="days"
        :visible="detailTab === 'album'"
      />
    </view>

    <view v-if="showInteraction" class="card interact-card">
      <button class="btn-interact" :class="{ active: route.isLiked }" @click="handleLike">
        {{ route.isLiked ? t('routes.liked') : t('routes.like') }}
      </button>
      <button class="btn-interact" :class="{ active: route.isFavorited }" @click="handleFavorite">
        {{ route.isFavorited ? t('routes.favorited') : t('routes.favorite') }}
      </button>
    </view>

    <view v-if="canGeneratePoster" class="card poster-card">
      <text class="poster-card-title">{{ t('routes.poster.sheetTitle') }}</text>
      <text class="poster-card-hint">{{ t('routes.poster.sheetHint') }}</text>
      <button class="btn-poster" @click="openPosterSheet">{{ t('routes.generatePoster') }}</button>
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

    <RoutePosterSheet
      :visible="posterSheetVisible"
      :route="route"
      @close="posterSheetVisible = false"
      @generated="handlePosterGenerated"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app';
import type {
  RouteDayAttraction,
  RouteDayPlan,
  RouteDetailPayload,
  TravelRouteInfo,
  RouteCommentInfo,
} from '@douxing/shared';
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
import TravelPetFloatingLayer from '@/components/travel-pet-floating-layer/TravelPetFloatingLayer.vue';
import RouteMapByDay from '@/components/route-map/RouteMapByDay.vue';
import RouteDayTabs from '@/components/route-day-tabs/RouteDayTabs.vue';
import RouteDayFlowChart from '@/components/route-day-flow/RouteDayFlowChart.vue';
import RoutePosterSheet from '@/components/route-poster/RoutePosterSheet.vue';
import RouteJourneyAlbumPanel from '@/components/route-journey-album/RouteJourneyAlbumPanel.vue';
import { aiPlanLoadingState, isAiPlanCancelledError } from '@/utils/ai-plan-loading';
import { getStoredUser, getAppErrorMessage } from '@/utils/request';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';
import { useTheme } from '@/i18n/useTheme';
import { getDxPrimaryColor } from '@/utils/theme-colors';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
const { themeClass, themeId } = useTheme();
const switchColor = computed(() => getDxPrimaryColor(themeId.value));
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
const editModalVisible = ref(false);
const savingDraft = ref(false);
const sharing = ref(false);
const comments = ref<RouteCommentInfo[]>([]);
const commentText = ref('');
const postingComment = ref(false);
const aiPlanning = computed(() => aiPlanLoadingState.active);
const activeDayIndex = ref(0);
const detailTab = ref<'itinerary' | 'album'>('itinerary');
const albumPanelRef = ref<InstanceType<typeof RouteJourneyAlbumPanel> | null>(null);
const posterSheetVisible = ref(false);
const posterShareImagePath = ref('');
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

const canGeneratePoster = computed(
  () =>
    isUnlocked.value &&
    days.value.length > 0 &&
    route.value?.status === RouteStatus.PUBLISHED,
);

const showDetailTabs = computed(() => isOwner.value && isUnlocked.value && days.value.length > 0);

const showAlbumTab = computed(() => showDetailTabs.value);

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

watch(
  () => days.value.length,
  () => {
    if (activeDayIndex.value >= days.value.length) {
      activeDayIndex.value = 0;
    }
  },
);

function resetActiveDayIndex() {
  activeDayIndex.value = 0;
}

const activeDay = computed(() => days.value[activeDayIndex.value]);

const activeDayHeading = computed(() => {
  const day = activeDay.value;
  if (!day || days.value.length <= 1) return '';
  if (day.date && day.title) {
    return tf('routes.dayTitle', { date: day.date, title: day.title });
  }
  return day.title || day.date || '';
});

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
    resetActiveDayIndex();
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
    uni.showToast({ title: getAppErrorMessage(e, t('routes.loadFailed')), icon: 'none' });
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
    uni.showToast({ title: getAppErrorMessage(err, t('routes.shareSetFailed')), icon: 'none' });
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
    uni.showToast({ title: getAppErrorMessage(err, t('routes.commentFailed')), icon: 'none' });
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
    uni.showToast({ title: getAppErrorMessage(e, t('routes.operationFailed')), icon: 'none' });
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
    uni.showToast({ title: getAppErrorMessage(e, t('routes.operationFailed')), icon: 'none' });
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
    uni.showToast({ title: getAppErrorMessage(e, t('routes.saveFailed')), icon: 'none' });
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
    resetActiveDayIndex();
  } catch (e) {
    const msg = getAppErrorMessage(e, t('routes.regenerateFailed'));
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
    const msg = getAppErrorMessage(e, t('routes.payFailed'));
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
    uni.showToast({ title: getAppErrorMessage(e, t('routes.publishFailed')), icon: 'none' });
  }
}

function openPosterSheet() {
  posterSheetVisible.value = true;
}

function handlePosterGenerated(path: string) {
  posterShareImagePath.value = path;
}

onShareAppMessage(() => ({
  title: route.value?.name || t('routes.poster.shareCardTitle'),
  path: `/pages/routes/detail?id=${routeId}`,
  imageUrl: posterShareImagePath.value || undefined,
}));

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
            addToAlbum: photos != null && photos.length > 0,
          });

          if (photos != null && photos.length > 0 && detailTab.value === 'album') {
            albumPanelRef.value?.reload();
          }

          let msg = tf('routes.checkInSuccess', { points: result.checkIn.pointsEarned });
          if (result.newAchievements.length > 0) {
            msg += tf('routes.checkInAchievements', { count: result.newAchievements.length });
          }
          if (result.newBadges?.length > 0) {
            msg += tf('routes.checkInBadges', { count: result.newBadges.length });
          }
          uni.showToast({ title: msg, icon: 'success' });
        } catch (e) {
          uni.showToast({ title: getAppErrorMessage(e, t('routes.checkInFailed')), icon: 'none' });
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
  --page-gutter: 32rpx;
  padding: 0 var(--page-gutter) 48rpx;
  background: var(--dx-bg);
  min-height: 100vh;
  box-sizing: border-box;
}
.detail-tabs {
  display: flex;
  gap: 16rpx;
  margin: 0 0 20rpx;
}
.detail-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: var(--dx-radius-sm);
  background: var(--dx-surface);
  color: var(--dx-text-secondary);
  font-size: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.detail-tab.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  font-weight: 600;
  box-shadow: inset 0 0 0 2rpx var(--dx-primary-border);
}
.hero {
  position: relative;
  margin: 0 calc(-1 * var(--page-gutter)) 24rpx;
  padding: 32rpx var(--page-gutter) 36rpx;
  overflow: hidden;
  color: var(--dx-text-inverse);
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.hero-inner {
  position: relative;
  z-index: 1;
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
  font-weight: 700;
  line-height: 1.35;
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
  border: 2rpx solid rgba(255, 255, 255, 0.28);
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
  opacity: 0.92;
  margin-top: 8rpx;
  display: block;
}
.desc {
  font-size: 26rpx;
  margin-top: 16rpx;
  display: block;
  line-height: 1.5;
  opacity: 0.95;
}
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 16rpx;
  opacity: 0.92;
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
.itinerary-card {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.itinerary-day-heading {
  font-size: 26rpx;
  color: var(--dx-text);
  font-weight: 500;
  margin-bottom: 8rpx;
}
.itinerary-flow-divider {
  height: 1rpx;
  background: var(--dx-border);
  margin: 24rpx 0 8rpx;
}
.share-card {
  border: 2rpx solid var(--dx-primary-light);
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
  color: var(--dx-text);
  display: block;
}
.share-hint {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  margin-top: 8rpx;
  display: block;
}
.interact-card {
  display: flex;
  gap: 24rpx;
}
.poster-card {
  border: 2rpx dashed var(--dx-primary-light);
}
.poster-card-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.poster-card-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
  line-height: 1.5;
}
.btn-poster {
  margin-top: 20rpx;
  background: #fff7ed;
  color: #b45309;
  border: 2rpx solid #fcd34d;
  border-radius: var(--dx-radius-sm);
}
.btn-interact {
  flex: 1;
  background: var(--dx-bg);
  color: var(--dx-text);
  font-size: 28rpx;
  border-radius: var(--dx-radius-sm);
  border: none;
}
.btn-interact.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
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
  background: var(--dx-surface);
  border-radius: var(--dx-radius-lg);
  padding: 32rpx;
  box-shadow: var(--dx-shadow-md);
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
  color: var(--dx-text);
}
.edit-modal-close {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-size: 40rpx;
  color: var(--dx-text-muted);
}
.edit-modal-hint {
  display: block;
  margin-top: 12rpx;
  margin-bottom: 16rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
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
  color: var(--dx-text);
}
.edit-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 26rpx;
  line-height: 1.6;
  padding: 16rpx;
  background: var(--dx-bg);
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
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
  border-radius: var(--dx-radius-sm);
}
.btn-edit-cancel {
  background: var(--dx-bg);
  color: var(--dx-text);
}
.btn-save-draft {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.comments-card {
  margin-bottom: 24rpx;
}
.comments-title {
  font-size: 30rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 16rpx;
  color: var(--dx-text);
}
.comments-empty {
  color: var(--dx-text-muted);
  font-size: 24rpx;
  margin-bottom: 16rpx;
}
.comment-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--dx-border);
}
.comment-user {
  font-size: 24rpx;
  color: var(--dx-primary);
  display: block;
}
.comment-content {
  font-size: 26rpx;
  color: var(--dx-text);
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
  background: var(--dx-bg);
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  box-sizing: border-box;
}
.btn-comment {
  margin-top: 16rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-sm);
  border: none;
}
.card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--dx-shadow-sm);
}
.lock-tip {
  display: block;
  color: var(--dx-text-secondary);
}
.price {
  font-size: 48rpx;
  color: var(--dx-primary);
  font-weight: 600;
  margin: 16rpx 0;
  display: block;
}
.btn-primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-lg);
  border: none;
  box-shadow: var(--dx-shadow-md);
}
.day-block {
  margin-bottom: 32rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid var(--dx-border);
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
  color: var(--dx-primary);
  margin-bottom: 12rpx;
  letter-spacing: 1rpx;
}
.transit-item {
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}
.transit-route {
  font-size: 26rpx;
  font-weight: 500;
  display: block;
  color: var(--dx-text);
}
.transit-meta,
.transit-time {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
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
  color: var(--dx-text-muted);
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
  color: var(--dx-text);
}
.spot {
  border-left: 4rpx solid var(--dx-primary);
  padding-left: 20rpx;
  margin-bottom: 24rpx;
}
.spot-name {
  font-size: 28rpx;
  font-weight: 500;
  display: block;
  color: var(--dx-text);
}
.spot-time {
  color: var(--dx-text-secondary);
  font-size: 24rpx;
  display: block;
  margin-top: 4rpx;
}
.spot-desc {
  color: var(--dx-text);
  font-size: 24rpx;
  display: block;
  margin-top: 4rpx;
}
.btn-checkin {
  margin-top: 12rpx;
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}
.actions {
  padding-bottom: 48rpx;
}
.btn-outline {
  background: var(--dx-surface);
  color: var(--dx-primary);
  border: 2rpx solid var(--dx-primary);
  border-radius: var(--dx-radius-lg);
}
.regenerate-card {
  border: 2rpx dashed var(--dx-border);
}
.regenerate-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  display: block;
}
.regenerate-hint {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  margin-top: 8rpx;
  display: block;
}
.regenerate-input {
  width: 100%;
  min-height: 160rpx;
  margin-top: 20rpx;
  font-size: 26rpx;
  line-height: 1.5;
  padding: 16rpx;
  background: var(--dx-bg);
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  box-sizing: border-box;
}
.btn-regenerate {
  margin-top: 24rpx;
  background: #fff7ed;
  color: #d97706;
  border: 1rpx solid #fcd34d;
  border-radius: var(--dx-radius-sm);
}
</style>
