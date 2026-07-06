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

    <view v-if="routeVideo || (isOwner && isUnlocked)" class="card media-card">
      <view class="media-row">
        <text class="media-label">{{ t('routes.playRouteVideo') }}</text>
        <view class="media-actions">
          <button
            v-if="routeVideo"
            size="mini"
            class="btn-media-play"
            @click="openRouteVideo"
          >
            ▶ {{ t('routes.poiPlayVideo') }}
          </button>
          <button
            v-if="isOwner"
            size="mini"
            class="btn-media-upload"
            :disabled="videoUploading"
            @click="handleUploadRouteVideo"
          >
            {{ videoUploading ? t('routes.videoUploading') : t('routes.uploadRouteVideo') }}
          </button>
        </view>
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
        :poi-external-links="poiExternalLinks"
        :allow-external-link="showComments"
        @poi-external-link-open="openExternalLinkConfirm"
        @poi-external-link-add="openExternalLinkForm"
        :show-day-tabs="false"
        show-check-in
        :allow-media-upload="isOwner"
        @check-in="handleCheckIn"
        @poi-comment-focus="handlePoiCommentFocus"
        @poi-video-play="handlePoiVideoPlay"
        @poi-video-upload="handlePoiVideoUpload"
      />

      <view v-if="canRefreshDayPlan" class="replan-bar">
        <button class="btn-replan" :disabled="replanSheetVisible" @click="replanSheetVisible = true">
          {{ t('routes.replanRefreshDay') }}
        </button>
        <button class="btn-missed" :disabled="missedSheetVisible" @click="missedSheetVisible = true">
          {{ t('routes.missedCheckDay') }}
        </button>
        <button class="btn-intrip" :disabled="inTripSheetVisible" @click="inTripSheetVisible = true">
          {{ t('routes.inTripAnalyze') }}
        </button>
      </view>
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

    <view v-if="showComments" id="route-comments-section" class="card comments-card">
      <text class="comments-title">{{ t('routes.commentsTitle') }}</text>
      <view class="comment-sort-tabs">
        <text
          class="comment-sort-chip"
          :class="{ active: commentSort === 'hot' }"
          @click="setCommentSort('hot')"
        >
          {{ t('routes.commentSortHot') }}
        </text>
        <text
          class="comment-sort-chip"
          :class="{ active: commentSort === 'recent' }"
          @click="setCommentSort('recent')"
        >
          {{ t('routes.commentSortRecent') }}
        </text>
      </view>
      <view class="comment-filters">
        <text
          class="comment-filter-chip"
          :class="{ active: !commentFocus }"
          @click="clearCommentFocus"
        >
          {{ t('routes.commentFilterAll') }}
        </text>
        <text
          class="comment-filter-chip"
          :class="{ active: commentFocus && commentFocus.attractionId == null && !commentFocus.poiName?.trim() }"
          @click="filterCommentsByActiveDay"
        >
          {{ tf('routes.commentFilterDay', { day: activeDayIndex + 1 }) }}
        </text>
        <text
          v-if="commentFocus?.poiName"
          class="comment-filter-chip active"
          @click="clearCommentFocus"
        >
          {{ commentFilterLabel }} ×
        </text>
      </view>
      <view v-if="comments.length === 0" class="comments-empty">{{ t('routes.commentsEmpty') }}</view>
      <view v-for="c in comments" :key="c.id" class="comment-item">
        <text class="comment-user">
          {{ c.userNickname }}
          <text v-if="c.isFeatured" class="comment-featured">{{ t('routes.commentFeatured') }}</text>
          <text v-if="formatCommentScope(c)" class="comment-scope">{{ formatCommentScope(c) }}</text>
        </text>
        <text class="comment-content">{{ c.content }}</text>
        <view class="comment-like-row">
          <text
            class="comment-like-btn"
            :class="{ active: c.isLiked }"
            @click="handleCommentLike(c.id)"
          >
            {{ t('routes.commentLike') }} {{ c.likeCount ?? 0 }}
          </text>
        </view>
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

    <view v-if="externalLinkFormVisible" class="external-link-mask" @click="closeExternalLinkForm">
      <view class="external-link-sheet" @click.stop>
        <text class="external-link-title">{{ t('routes.addExternalLink') }}</text>
        <text v-if="externalLinkFormPoi?.poiName" class="external-link-poi">
          {{ tf('routes.commentFilterPoi', { name: externalLinkFormPoi.poiName }) }}
        </text>
        <text class="external-link-hint">{{ t('routes.externalLinkUrlHint') }}</text>
        <text class="external-link-label">{{ t('routes.externalLinkTitleLabel') }}</text>
        <input
          v-model="externalLinkFormTitle"
          class="external-link-input"
          type="text"
          maxlength="128"
          :placeholder="t('routes.externalLinkTitlePlaceholder')"
        />
        <text class="external-link-label">{{ t('routes.externalLinkUrlLabel') }}</text>
        <input
          v-model="externalLinkFormUrl"
          class="external-link-input"
          type="text"
          maxlength="512"
          :placeholder="t('routes.externalLinkUrlPlaceholder')"
        />
        <view class="external-link-actions">
          <button class="btn-outline" @click="closeExternalLinkForm">{{ t('routes.externalLinkCancel') }}</button>
          <button class="btn-comment" :loading="externalLinkSubmitting" @click="submitExternalLinkForm">
            {{ t('routes.externalLinkSubmit') }}
          </button>
        </view>
      </view>
    </view>

    <RoutePosterSheet
      :visible="posterSheetVisible"
      :route="route"
      @close="posterSheetVisible = false"
      @generated="handlePosterGenerated"
    />

    <RouteReplanSheet
      :visible="replanSheetVisible"
      :route-id="routeId"
      :day-index="activeDayIndex"
      :is-draft="route.status !== publishedStatus"
      @close="replanSheetVisible = false"
      @applied="handleReplanApplied"
    />

    <RouteMissedPoiSheet
      :visible="missedSheetVisible"
      :route-id="routeId"
      :day-index="activeDayIndex"
      @close="missedSheetVisible = false"
    />

    <PetInTripAnalyzeSheet
      :visible="inTripSheetVisible"
      :route-id="routeId"
      @close="inTripSheetVisible = false"
    />

    <PetCheckInCelebrationSheet
      :visible="celebrationVisible"
      :celebration="celebrationData"
      @close="celebrationVisible = false"
    />

    <RouteMediaPlayerSheet
      :visible="mediaPlayerVisible"
      :video-url="mediaPlayerUrl"
      :cover-url="mediaPlayerCover"
      :title="mediaPlayerTitle"
      @close="mediaPlayerVisible = false"
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
  ROUTE_VIDEO_MAX_DURATION_SEC,
  TravelRouteInfo,
  RouteCommentInfo,
  RoutePoiExternalLinkInfo,
  isAllowedExternalDiscussionUrl,
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
  toggleRouteCommentLike,
  fetchRoutePoiExternalLinks,
  createRoutePoiExternalLink,
  uploadRouteVideo,
} from '@/api/routes';
import { completeRouteUnlockPayment, getUnlockPayButtonLabel } from '@/utils/order-payment';
import { fetchOrderPaymentConfig } from '@/api/orders';
import { createCheckIn, uploadCheckInPhoto } from '@/api/checkins';
import { getCurrentLocation } from '@/utils/location';
import { RouteStatus, AnalyticsEventName } from '@douxing/shared';
import { trackAnalytics } from '@/utils/analytics';
import AiPlanBlockingOverlay from '@/components/ai-plan-blocking-overlay/AiPlanBlockingOverlay.vue';
import TravelPetFloatingLayer from '@/components/travel-pet-floating-layer/TravelPetFloatingLayer.vue';
import RouteMapByDay from '@/components/route-map/RouteMapByDay.vue';
import RouteDayTabs from '@/components/route-day-tabs/RouteDayTabs.vue';
import RouteDayFlowChart from '@/components/route-day-flow/RouteDayFlowChart.vue';
import RouteMediaPlayerSheet from '@/components/route-media/RouteMediaPlayerSheet.vue';
import RoutePosterSheet from '@/components/route-poster/RoutePosterSheet.vue';
import RouteJourneyAlbumPanel from '@/components/route-journey-album/RouteJourneyAlbumPanel.vue';
import RouteReplanSheet from '@/components/route-replan/RouteReplanSheet.vue';
import RouteMissedPoiSheet from '@/components/route-missed/RouteMissedPoiSheet.vue';
import PetInTripAnalyzeSheet from '@/components/travel-pet/PetInTripAnalyzeSheet.vue';
import PetCheckInCelebrationSheet from '@/components/travel-pet/PetCheckInCelebrationSheet.vue';
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
const commentSort = ref<'hot' | 'recent'>('hot');
const poiExternalLinks = ref<RoutePoiExternalLinkInfo[]>([]);
const externalLinkFormVisible = ref(false);
const externalLinkFormTitle = ref('');
const externalLinkFormUrl = ref('');
const externalLinkSubmitting = ref(false);
const externalLinkFormPoi = ref<{
  dayIndex: number;
  attractionId?: number;
  poiName: string;
} | null>(null);
const commentText = ref('');
const commentFocus = ref<{
  dayIndex: number;
  attractionId?: number;
  poiName: string;
} | null>(null);
const postingComment = ref(false);
const aiPlanning = computed(() => aiPlanLoadingState.active);
const activeDayIndex = ref(0);
const detailTab = ref<'itinerary' | 'album'>('itinerary');
const albumPanelRef = ref<InstanceType<typeof RouteJourneyAlbumPanel> | null>(null);
const posterSheetVisible = ref(false);
const replanSheetVisible = ref(false);
const missedSheetVisible = ref(false);
const inTripSheetVisible = ref(false);
const celebrationVisible = ref(false);
const celebrationData = ref<import('@douxing/shared').PetCheckInCelebration | null>(null);
const posterShareImagePath = ref('');
const videoUploading = ref(false);
const mediaPlayerVisible = ref(false);
const mediaPlayerUrl = ref('');
const mediaPlayerCover = ref<string | null>(null);
const mediaPlayerTitle = ref('');
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

const canRefreshDayPlan = computed(
  () => isOwner.value && isUnlocked.value && days.value.length > 0 && detailTab.value === 'itinerary',
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

const routeVideo = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return detail?.routeVideo ?? null;
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

const commentFilterLabel = computed(() => {
  if (commentFocus.value?.poiName) {
    return tf('routes.commentFilterPoi', { name: commentFocus.value.poiName });
  }
  return '';
});

async function loadPoiExternalLinks() {
  if (!route.value?.isPublic) {
    poiExternalLinks.value = [];
    return;
  }
  try {
    poiExternalLinks.value = await fetchRoutePoiExternalLinks(routeId, { limit: 50 });
  } catch {
    poiExternalLinks.value = [];
  }
}

/**
 * 切换评论排序并重新加载。
 *
 * @param sort - 热门或最新
 */
async function setCommentSort(sort: 'hot' | 'recent') {
  commentSort.value = sort;
  await loadComments();
}

/**
 * 切换评论点赞状态。
 *
 * @param commentId - 评论 ID
 */
async function handleCommentLike(commentId: number) {
  try {
    const result = await toggleRouteCommentLike(routeId, commentId);
    const idx = comments.value.findIndex((c) => c.id === commentId);
    if (idx >= 0) {
      comments.value[idx] = {
        ...comments.value[idx]!,
        isLiked: result.liked,
        likeCount: result.likeCount,
      };
    }
  } catch (err) {
    uni.showToast({ title: getAppErrorMessage(err, t('routes.commentLikeFailed')), icon: 'none' });
  }
}

/**
 * 打开 POI 外链提交表单。
 *
 * @param payload - POI 上下文
 */
function openExternalLinkForm(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  externalLinkFormPoi.value = payload;
  externalLinkFormTitle.value = '';
  externalLinkFormUrl.value = '';
  externalLinkFormVisible.value = true;
}

/**
 * 关闭外链提交表单并重置字段。
 */
function closeExternalLinkForm() {
  externalLinkFormVisible.value = false;
  externalLinkFormPoi.value = null;
  externalLinkFormTitle.value = '';
  externalLinkFormUrl.value = '';
}

/**
 * 校验并提交 POI 外链讨论。
 */
async function submitExternalLinkForm() {
  const poi = externalLinkFormPoi.value;
  if (!poi) return;
  const title = externalLinkFormTitle.value.trim();
  const url = externalLinkFormUrl.value.trim();
  if (!title) {
    uni.showToast({ title: t('routes.externalLinkTitleRequired'), icon: 'none' });
    return;
  }
  if (!isAllowedExternalDiscussionUrl(url)) {
    uni.showToast({ title: t('routes.externalLinkUrlInvalid'), icon: 'none' });
    return;
  }
  externalLinkSubmitting.value = true;
  try {
    const created = await createRoutePoiExternalLink(routeId, {
      title,
      url,
      dayIndex: poi.dayIndex,
      attractionId: poi.attractionId,
      poiName: poi.poiName,
    });
    poiExternalLinks.value = [created, ...poiExternalLinks.value];
    closeExternalLinkForm();
    uni.showToast({ title: t('routes.externalLinkAdded'), icon: 'success' });
  } catch (err) {
    uni.showToast({ title: getAppErrorMessage(err, t('routes.externalLinkFailed')), icon: 'none' });
  } finally {
    externalLinkSubmitting.value = false;
  }
}

/**
 * 外链跳转前二次确认（H10-d）。
 *
 * @param url - 目标 URL
 */
function openExternalLinkConfirm(url: string) {
  uni.showModal({
    title: t('routes.externalLinkConfirmTitle'),
    content: `${t('routes.externalLinkConfirmMessage')}\n${t('routes.externalLinkDisclaimer')}`,
    confirmText: t('routes.externalLinkOpen'),
    cancelText: t('routes.externalLinkCancel'),
    success: (res) => {
      if (res.confirm) {
        // #ifdef H5
        window.open(url, '_blank', 'noopener,noreferrer');
        // #endif
        // #ifndef H5
        uni.setClipboardData({ data: url });
        uni.showToast({ title: t('routes.externalLinkOpen'), icon: 'none' });
        // #endif
      }
    },
  });
}

async function loadComments() {
  if (!route.value?.isPublic) {
    comments.value = [];
    return;
  }
  try {
    const params: { limit?: number; dayIndex?: number; attractionId?: number; sort?: 'hot' | 'recent' } = {
      limit: 50,
      sort: commentSort.value,
    };
    if (commentFocus.value?.attractionId != null) {
      params.attractionId = commentFocus.value.attractionId;
    } else if (commentFocus.value != null) {
      params.dayIndex = commentFocus.value.dayIndex;
    }
    comments.value = await fetchRouteComments(routeId, params);
  } catch {
    comments.value = [];
  }
}

/**
 * 聚焦 POI 相关评论。
 *
 * @param payload - POI 上下文
 */
async function focusRouteCommentPoi(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  commentFocus.value = payload;
  await loadComments();
}

/**
 * 清除评论筛选。
 */
async function clearCommentFocus() {
  commentFocus.value = null;
  await loadComments();
}

/**
 * 按当前行程天筛选评论。
 */
async function filterCommentsByActiveDay() {
  commentFocus.value = { dayIndex: activeDayIndex.value, poiName: '' };
  await loadComments();
}

/**
 * 从 POI 详情跳转评论并滚动至评论区。
 *
 * @param payload - POI 上下文
 */
async function handlePoiCommentFocus(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  await focusRouteCommentPoi(payload);
  uni.pageScrollTo({ selector: '#route-comments-section', duration: 300 });
}

/**
 * 格式化评论关联范围标签。
 *
 * @param comment - 评论项
 * @returns 范围文案；无关联时为空字符串
 */
function formatCommentScope(comment: RouteCommentInfo): string {
  if (comment.poiName?.trim()) {
    return tf('routes.commentScopePoi', { name: comment.poiName.trim() });
  }
  if (comment.dayIndex != null) {
    return tf('routes.commentScopeDay', { day: comment.dayIndex + 1 });
  }
  return '';
}

async function loadDetail() {
  try {
    resetActiveDayIndex();
    commentFocus.value = null;
    route.value = await fetchRouteDetail(routeId);
    editName.value = route.value?.name ?? '';
    editDesc.value = route.value?.description ?? '';
    if (route.value?.sourcePrompt) {
      regeneratePrompt.value = route.value.sourcePrompt;
    } else if (canRegenerate.value && !regeneratePrompt.value) {
      regeneratePrompt.value = route.value?.description ?? '';
    }
    await loadComments();
    await loadPoiExternalLinks();
    trackAnalytics(AnalyticsEventName.ROUTE_VIEW, { routeId });
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('routes.loadFailed')), icon: 'none' });
  }
}

/**
 * 打开整线路线视频播放器。
 */
function openRouteVideo() {
  const video = routeVideo.value;
  if (!video?.videoUrl) return;
  mediaPlayerUrl.value = video.videoUrl;
  mediaPlayerCover.value = video.coverUrl ?? null;
  mediaPlayerTitle.value = route.value?.name ?? '';
  mediaPlayerVisible.value = true;
}

/**
 * 播放流程图中 POI 绑定短视频。
 *
 * @param payload - 视频地址与标题
 */
function handlePoiVideoPlay(payload: {
  videoUrl: string;
  coverUrl?: string | null;
  title: string;
}) {
  mediaPlayerUrl.value = payload.videoUrl;
  mediaPlayerCover.value = payload.coverUrl ?? null;
  mediaPlayerTitle.value = payload.title;
  mediaPlayerVisible.value = true;
}

/**
 * 选择并上传整线路线短视频。
 */
function handleUploadRouteVideo() {
  uni.chooseVideo({
    maxDuration: ROUTE_VIDEO_MAX_DURATION_SEC,
    compressed: true,
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const durationSec = Math.max(1, Math.round(res.duration || 1));
      if (durationSec > ROUTE_VIDEO_MAX_DURATION_SEC) {
        uni.showToast({
          title: tf('routes.videoDurationLimit', { sec: ROUTE_VIDEO_MAX_DURATION_SEC }),
          icon: 'none',
        });
        return;
      }
      videoUploading.value = true;
      try {
        await uploadRouteVideo(routeId, res.tempFilePath, {
          scope: 'route',
          durationSec,
        });
        uni.showToast({ title: t('routes.videoUploadSuccess'), icon: 'none' });
        await loadDetail();
      } catch (e) {
        uni.showToast({ title: getAppErrorMessage(e, t('routes.videoUploadFailed')), icon: 'none' });
      } finally {
        videoUploading.value = false;
      }
    },
  });
}

/**
 * 上传当前 POI 绑定短视频。
 *
 * @param payload - 天序与 POI 标识
 */
function handlePoiVideoUpload(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  uni.chooseVideo({
    maxDuration: ROUTE_VIDEO_MAX_DURATION_SEC,
    compressed: true,
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const durationSec = Math.max(1, Math.round(res.duration || 1));
      if (durationSec > ROUTE_VIDEO_MAX_DURATION_SEC) {
        uni.showToast({
          title: tf('routes.videoDurationLimit', { sec: ROUTE_VIDEO_MAX_DURATION_SEC }),
          icon: 'none',
        });
        return;
      }
      videoUploading.value = true;
      try {
        await uploadRouteVideo(routeId, res.tempFilePath, {
          scope: 'poi',
          durationSec,
          dayIndex: payload.dayIndex,
          attractionId: payload.attractionId,
          poiName: payload.poiName,
        });
        uni.showToast({ title: t('routes.videoUploadSuccess'), icon: 'none' });
        await loadDetail();
      } catch (e) {
        uni.showToast({ title: getAppErrorMessage(e, t('routes.videoUploadFailed')), icon: 'none' });
      } finally {
        videoUploading.value = false;
      }
    },
  });
}

async function handleReplanApplied() {
  await loadDetail();
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
    await loadPoiExternalLinks();
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
    const created = await createRouteComment(routeId, {
      content: text,
      dayIndex: commentFocus.value?.dayIndex,
      attractionId: commentFocus.value?.attractionId,
      poiName: commentFocus.value?.poiName || undefined,
    });
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
          : result.llmProvider === 'douxing'
            ? t('routes.regenerateDouxing')
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
    trackAnalytics(AnalyticsEventName.ROUTE_PUBLISH, { routeId });
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

          trackAnalytics(AnalyticsEventName.CHECKIN_CREATE, {
            routeId,
            checkInId: result.checkIn.id,
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
          if (result.petCelebration) {
            celebrationData.value = result.petCelebration;
            celebrationVisible.value = true;
          }
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
.replan-bar {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}
.btn-replan,
.btn-missed,
.btn-intrip {
  width: 100%;
  font-size: 28rpx;
  border-radius: 999rpx;
  background: var(--dx-primary-light, rgba(37, 99, 235, 0.12));
  color: var(--dx-primary, #2563eb);
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
.media-card {
  margin-top: 0;
}
.media-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.media-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.media-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.btn-media-play,
.btn-media-upload {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
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
.comment-sort-tabs {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.comment-sort-chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #6b7280;
  background: #f3f4f6;
  border: 1rpx solid #e5e7eb;
}
.comment-sort-chip.active {
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  border-color: rgba(249, 115, 22, 0.35);
}
.comment-filters {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.comment-filter-chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #6b7280;
  background: #f3f4f6;
  border: 1rpx solid #e5e7eb;
}
.comment-filter-chip.active {
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  border-color: rgba(249, 115, 22, 0.35);
}
.comment-scope {
  margin-left: 8rpx;
  font-size: 22rpx;
  font-weight: 400;
  color: #9ca3af;
}
.comment-featured {
  margin-left: 8rpx;
  font-size: 20rpx;
  color: #f97316;
  border: 1rpx solid rgba(249, 115, 22, 0.4);
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
}
.comment-like-row {
  margin-top: 8rpx;
}
.comment-like-btn {
  font-size: 22rpx;
  color: #6b7280;
}
.comment-like-btn.active {
  color: var(--dx-primary);
}
.external-link-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}
.external-link-sheet {
  width: 100%;
  background: var(--dx-bg);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}
.external-link-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.external-link-poi {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--dx-text-muted);
}
.external-link-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #9ca3af;
}
.external-link-label {
  display: block;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: var(--dx-text);
}
.external-link-input {
  margin-top: 8rpx;
  width: 100%;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid var(--dx-border);
  font-size: 26rpx;
  box-sizing: border-box;
}
.external-link-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}
.external-link-actions .btn-outline,
.external-link-actions .btn-comment {
  flex: 1;
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
