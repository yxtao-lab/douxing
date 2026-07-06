<template>
  <div class="mx-auto max-w-7xl px-4 py-6 lg:px-8">
    <div v-if="loading && !route" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="loadError" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ loadError }}</p>
      <button type="button" class="dx-btn-secondary" @click="loadDetail">{{ t('common.refresh') }}</button>
    </div>

    <template v-else-if="route">
      <!-- Hero -->
      <section class="mb-6 overflow-hidden rounded-2xl bg-dx-hero text-white shadow-hero">
        <div class="p-6 lg:p-8">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold lg:text-3xl">{{ route.name }}</h1>
                <span
                  v-if="isOwner"
                  class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium"
                >
                  {{ routeStatusLabel }}
                </span>
              </div>
              <p class="text-sm text-white/85">{{ heroMeta }}</p>
            </div>
            <button
              v-if="canEditRouteInfo"
              type="button"
              class="shrink-0 rounded-xl bg-white/15 px-4 py-2 text-sm backdrop-blur transition hover:bg-white/25"
              @click="openEditModal"
            >
              {{ t('routes.editRouteInfo') }}
            </button>
          </div>

          <p v-if="route.description" class="mb-4 max-w-3xl leading-relaxed text-white/90">
            {{ route.description }}
          </p>

          <div class="flex flex-wrap gap-4 text-sm text-white/85">
            <span>{{ t('routes.statViews', { count: route.viewCount ?? 0 }) }}</span>
            <span>{{ t('routes.statLikes', { count: route.likeCount ?? 0 }) }}</span>
            <span>{{ t('routes.statCollects', { count: route.collectCount ?? 0 }) }}</span>
            <span>{{ t('routes.statComments', { count: route.commentCount ?? 0 }) }}</span>
          </div>

          <p v-if="route.creatorNickname && !isOwner" class="mt-3 text-sm text-white/75">
            {{ t('routes.authorShare', { name: route.creatorNickname }) }}
          </p>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <!-- 公开分享开关 -->
          <div v-if="showShareSetting" class="dx-card">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium text-dx-text">{{ t('routes.shareTitle') }}</p>
                <p class="mt-1 text-sm text-dx-muted">{{ t('routes.shareHint') }}</p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="route.isPublic"
                  :disabled="sharing"
                  @change="handleShareToggle(($event.target as HTMLInputElement).checked)"
                />
                <span
                  class="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-dx-primary peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
                />
              </label>
            </div>
          </div>

          <div v-if="routeVideo || (isOwner && isUnlocked)" class="dx-card">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="font-medium text-dx-text">{{ t('routes.playRouteVideo') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="routeVideo"
                  type="button"
                  class="dx-btn-secondary text-sm"
                  @click="openRouteVideo"
                >
                  ▶ {{ t('routes.poiPlayVideo') }}
                </button>
                <button
                  v-if="isOwner"
                  type="button"
                  class="dx-btn-secondary text-sm"
                  :disabled="videoUploading"
                  @click="triggerRouteVideoUpload"
                >
                  {{ videoUploading ? t('routes.videoUploading') : t('routes.uploadRouteVideo') }}
                </button>
              </div>
            </div>
            <input
              ref="routeVideoInputRef"
              type="file"
              accept="video/*"
              class="hidden"
              @change="handleRouteVideoFileChange"
            />
            <input
              ref="poiVideoInputRef"
              type="file"
              accept="video/*"
              class="hidden"
              @change="handlePoiVideoFileChange"
            />
          </div>

          <!-- 行程 / 相册 Tab -->
          <div v-if="showDetailTabs" class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
              :class="
                detailTab === 'itinerary'
                  ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                  : 'border-dx-border bg-white text-dx-muted hover:border-dx-primary/40'
              "
              @click="detailTab = 'itinerary'"
            >
              {{ t('routes.tabItinerary') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
              :class="
                detailTab === 'album'
                  ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                  : 'border-dx-border bg-white text-dx-muted hover:border-dx-primary/40'
              "
              @click="detailTab = 'album'"
            >
              {{ t('routes.tabAlbum') }}
            </button>
          </div>

          <!-- 行程：地图 + 流程图 -->
          <div v-if="isUnlocked && days.length > 0 && detailTab === 'itinerary'" class="dx-card space-y-6">
            <RouteDayTabs
              v-if="days.length > 1"
              v-model:active-day-index="activeDayIndex"
              :days="days"
            />

            <RouteMapByDay
              v-model:active-day-index="activeDayIndex"
              :route-id="numericRouteId"
              :days="days"
              :route-detail="(route.routeDetail as Record<string, unknown>) ?? null"
              :route-name="route.name"
              :auto-play="true"
              :show-day-tabs="false"
            />

            <hr class="border-dx-border" />

            <RouteDayFlowChart
              v-model:active-day-index="activeDayIndex"
              :days="days"
              :show-day-tabs="false"
              :allow-media-upload="isOwner"
              :allow-external-link="showComments"
              :poi-external-links="poiExternalLinks"
              @poi-comment-focus="handlePoiCommentFocus"
              @poi-video-play="handlePoiVideoPlay"
              @poi-video-upload="queuePoiVideoUpload"
              @poi-external-link-open="openExternalLinkConfirm"
              @poi-external-link-add="openExternalLinkForm"
            />

            <div v-if="canRefreshDayPlan" class="flex flex-wrap gap-2 pt-2">
              <button type="button" class="dx-btn-secondary w-full sm:w-auto" @click="replanDialogVisible = true">
                {{ t('routes.replanRefreshDay') }}
              </button>
              <button type="button" class="dx-btn-secondary w-full sm:w-auto" @click="missedDialogVisible = true">
                {{ t('routes.missedCheckDay') }}
              </button>
              <button type="button" class="dx-btn-secondary w-full sm:w-auto" @click="inTripDialogVisible = true">
                {{ t('routes.inTripAnalyze') }}
              </button>
            </div>
          </div>

          <!-- 旅程相册 -->
          <div v-if="showAlbumTab && detailTab === 'album'" class="dx-card">
            <RouteJourneyAlbumPanel
              ref="albumPanelRef"
              :route-id="numericRouteId"
              :days="days"
              :visible="detailTab === 'album'"
            />
          </div>

          <!-- 未解锁 -->
          <div v-if="!isUnlocked" class="dx-card text-center">
            <p class="mb-2 text-dx-muted">{{ t('routes.lockTip') }}</p>
            <p class="mb-4 text-2xl font-semibold text-dx-text">¥{{ unlockPrice }}</p>
            <button type="button" class="dx-btn-primary" :disabled="paying" @click="handleUnlock">
              {{ paying ? t('common.loading') : t('routes.unlockPayMock') }}
            </button>
          </div>

          <!-- 重新生成 -->
          <div v-if="canRegenerate" class="dx-card">
            <h3 class="mb-1 font-semibold text-dx-text">{{ t('routes.regenerateTitle') }}</h3>
            <p class="mb-3 text-sm text-dx-muted">{{ regenerateHint }}</p>
            <textarea
              v-model="regeneratePrompt"
              rows="3"
              class="mb-3 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.regeneratePlaceholder')"
              maxlength="200"
            />
            <button type="button" class="dx-btn-secondary" @click="handleRegenerate">
              {{ t('routes.regenerateBtn') }}
            </button>
          </div>

          <!-- 评论 -->
          <div v-if="showComments" ref="commentsSectionRef" class="dx-card">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-semibold text-dx-text">{{ t('routes.hotDiscussionTitle') }}</h3>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs transition"
                  :class="
                    commentSort === 'hot'
                      ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                      : 'border-dx-border text-dx-muted'
                  "
                  @click="setCommentSort('hot')"
                >
                  {{ t('routes.commentSortHot') }}
                </button>
                <button
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs transition"
                  :class="
                    commentSort === 'recent'
                      ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                      : 'border-dx-border text-dx-muted'
                  "
                  @click="setCommentSort('recent')"
                >
                  {{ t('routes.commentSortRecent') }}
                </button>
              </div>
            </div>
            <div class="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full border px-3 py-1 text-xs transition"
                :class="
                  !commentFocus
                    ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                    : 'border-dx-border text-dx-muted hover:border-dx-primary/40'
                "
                @click="clearCommentFocus"
              >
                {{ t('routes.commentFilterAll') }}
              </button>
              <button
                type="button"
                class="rounded-full border px-3 py-1 text-xs transition"
                :class="
                  commentFocus && commentFocus.attractionId == null && !commentFocus.poiName?.trim()
                    ? 'border-dx-primary bg-dx-primary-light text-dx-primary'
                    : 'border-dx-border text-dx-muted hover:border-dx-primary/40'
                "
                @click="filterCommentsByActiveDay"
              >
                {{ t('routes.commentFilterDay', { day: activeDayIndex + 1 }) }}
              </button>
              <button
                v-if="commentFocus?.poiName"
                type="button"
                class="rounded-full border border-dx-primary bg-dx-primary-light px-3 py-1 text-xs text-dx-primary"
                @click="clearCommentFocus"
              >
                {{ commentFilterLabel }} ×
              </button>
            </div>
            <p v-if="comments.length === 0" class="mb-4 text-sm text-dx-muted">
              {{ t('routes.commentsEmpty') }}
            </p>
            <div v-for="c in comments" :key="c.id" class="mb-4 border-b border-dx-border pb-4 last:border-0">
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-medium text-dx-text">
                  {{ c.userNickname }}
                  <span
                    v-if="c.isFeatured"
                    class="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800"
                  >
                    {{ t('routes.commentFeatured') }}
                  </span>
                  <span
                    v-if="c.poiName || c.dayIndex != null"
                    class="ml-2 text-xs font-normal text-dx-muted"
                  >
                    {{ formatCommentScope(c) }}
                  </span>
                </p>
                <button
                  type="button"
                  class="shrink-0 text-xs"
                  :class="c.isLiked ? 'text-dx-primary' : 'text-dx-muted'"
                  @click="handleCommentLike(c.id)"
                >
                  ♥ {{ c.likeCount ?? 0 }}
                </button>
              </div>
              <p class="mt-1 text-sm text-dx-muted">{{ c.content }}</p>
            </div>
            <textarea
              v-model="commentText"
              rows="3"
              class="mb-3 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.commentPlaceholder')"
              maxlength="500"
            />
            <button
              type="button"
              class="dx-btn-primary"
              :disabled="postingComment"
              @click="handlePostComment"
            >
              {{ t('routes.postComment') }}
            </button>
          </div>
        </div>

        <!-- 侧边栏操作 -->
        <aside class="space-y-4">
          <div class="dx-card space-y-3">
            <template v-if="showInteraction">
              <button
                type="button"
                class="dx-btn-secondary w-full"
                :class="{ '!border-dx-primary !text-dx-primary': route.isLiked }"
                @click="handleLike"
              >
                {{ route.isLiked ? t('routes.liked') : t('routes.like') }}
              </button>
              <button
                type="button"
                class="dx-btn-secondary w-full"
                :class="{ '!border-dx-primary !text-dx-primary': route.isFavorited }"
                @click="handleFavorite"
              >
                {{ route.isFavorited ? t('routes.favorited') : t('routes.favorite') }}
              </button>
            </template>
            <button
              v-if="canGeneratePoster"
              type="button"
              class="dx-btn-secondary w-full"
              @click="posterSheetVisible = true"
            >
              {{ t('routes.generatePoster') }}
            </button>
            <button
              v-if="route.status !== publishedStatus"
              type="button"
              class="dx-btn-primary w-full"
              @click="handlePublish"
            >
              {{ t('routes.publishRoute') }}
            </button>
            <RouterLink :to="{ name: 'routes' }" class="block text-center text-sm text-dx-primary hover:underline">
              {{ t('pc.routes.backToList') }}
            </RouterLink>
          </div>
        </aside>
      </div>
    </template>

    <!-- 编辑草稿弹窗 -->
    <Teleport to="body">
      <div
        v-if="editModalVisible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closeEditModal"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" @click.stop>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.editDraftTitle') }}</h2>
            <button type="button" class="text-dx-muted hover:text-dx-text" @click="closeEditModal">×</button>
          </div>
          <p class="mb-4 text-sm text-dx-muted">{{ t('routes.editDraftHint') }}</p>
          <label class="mb-4 block">
            <span class="mb-1 block text-sm font-medium text-dx-text">{{ t('routes.editNameLabel') }}</span>
            <input
              v-model="editName"
              type="text"
              maxlength="128"
              class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.nameInputPlaceholder')"
            />
          </label>
          <label class="mb-6 block">
            <span class="mb-1 block text-sm font-medium text-dx-text">{{ t('routes.editDescLabel') }}</span>
            <textarea
              v-model="editDesc"
              rows="4"
              maxlength="500"
              class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.descInputPlaceholder')"
            />
          </label>
          <div class="flex justify-end gap-3">
            <button type="button" class="dx-btn-secondary" @click="closeEditModal">
              {{ t('routes.editCancel') }}
            </button>
            <button type="button" class="dx-btn-primary" :disabled="savingDraft" @click="handleSaveDraft">
              {{ t('routes.saveDraft') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="externalLinkConfirmUrl"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        @click.self="externalLinkConfirmUrl = null"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-dx-text">{{ t('routes.externalLinkConfirmTitle') }}</h3>
          <p class="mt-2 text-sm text-dx-muted">{{ t('routes.externalLinkConfirmMessage') }}</p>
          <p class="mt-2 text-xs text-dx-muted">{{ t('routes.externalLinkDisclaimer') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="dx-btn-secondary" @click="externalLinkConfirmUrl = null">
              {{ t('routes.externalLinkCancel') }}
            </button>
            <button type="button" class="dx-btn-primary" @click="confirmOpenExternalLink">
              {{ t('routes.externalLinkOpen') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="externalLinkFormVisible"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        @click.self="closeExternalLinkForm"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-dx-text">{{ t('routes.addExternalLink') }}</h3>
          <p v-if="externalLinkFormPoi?.poiName" class="mt-1 text-sm text-dx-muted">
            {{ t('routes.commentFilterPoi', { name: externalLinkFormPoi.poiName }) }}
          </p>
          <p class="mt-2 text-xs text-dx-muted">{{ t('routes.externalLinkUrlHint') }}</p>
          <label class="mt-4 block text-sm font-medium text-dx-text">
            {{ t('routes.externalLinkTitleLabel') }}
            <input
              v-model="externalLinkFormTitle"
              type="text"
              maxlength="128"
              class="mt-1 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.externalLinkTitlePlaceholder')"
            />
          </label>
          <label class="mt-3 block text-sm font-medium text-dx-text">
            {{ t('routes.externalLinkUrlLabel') }}
            <input
              v-model="externalLinkFormUrl"
              type="url"
              maxlength="512"
              class="mt-1 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.externalLinkUrlPlaceholder')"
            />
          </label>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="dx-btn-secondary" @click="closeExternalLinkForm">
              {{ t('routes.externalLinkCancel') }}
            </button>
            <button
              type="button"
              class="dx-btn-primary"
              :disabled="externalLinkSubmitting"
              @click="submitExternalLinkForm"
            >
              {{ t('routes.externalLinkSubmit') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <RoutePosterSheet
      :visible="posterSheetVisible"
      :route="route"
      @close="posterSheetVisible = false"
    />

    <RouteReplanDialog
      v-if="route"
      :visible="replanDialogVisible"
      :route-id="numericRouteId"
      :day-index="activeDayIndex"
      :is-draft="route.status !== publishedStatus"
      @close="replanDialogVisible = false"
      @applied="handleReplanApplied"
    />

    <RouteMissedPoiDialog
      v-if="route"
      :visible="missedDialogVisible"
      :route-id="numericRouteId"
      :day-index="activeDayIndex"
      @close="missedDialogVisible = false"
    />

    <PetInTripAnalyzeDialog
      v-if="route"
      :visible="inTripDialogVisible"
      :route-id="numericRouteId"
      @close="inTripDialogVisible = false"
    />

    <RouteMediaPlayerSheet
      :visible="mediaPlayerVisible"
      :video-url="mediaPlayerUrl"
      :cover-url="mediaPlayerCover"
      :title="mediaPlayerTitle"
      @close="mediaPlayerVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import RouteDayFlowChart from '@/components/route/RouteDayFlowChart.vue';
import RouteMediaPlayerSheet from '@/components/route/RouteMediaPlayerSheet.vue';
import RouteDayTabs from '@/components/route/RouteDayTabs.vue';
import RouteMapByDay from '@/components/route/RouteMapByDay.vue';
import RoutePosterSheet from '@/components/route/RoutePosterSheet.vue';
import RouteReplanDialog from '@/components/route/RouteReplanDialog.vue';
import RouteMissedPoiDialog from '@/components/route/RouteMissedPoiDialog.vue';
import PetInTripAnalyzeDialog from '@/components/route/PetInTripAnalyzeDialog.vue';
import RouteJourneyAlbumPanel from '@/components/route/RouteJourneyAlbumPanel.vue';
import { useRouteDetail } from '@/composables/useRouteDetail';
import { useLocale } from '@/i18n/useLocale';
import { useInterestTagLabels } from '@/composables/useInterestTagLabels';
import { RouteStatus, type RouteCommentInfo, type RouteDetailPayload, ROUTE_VIDEO_MAX_DURATION_SEC, isAllowedExternalDiscussionUrl } from '@douxing/shared';
import { uploadRouteVideo } from '@/api/routes';
import { appMessage } from '@/composables/useAppMessage';
import { getAppErrorMessage } from '@/utils/error-message';

const vueRoute = useRoute();
const { t } = useLocale();
const { joinLabels } = useInterestTagLabels();

const posterSheetVisible = ref(false);
const replanDialogVisible = ref(false);
const missedDialogVisible = ref(false);
const inTripDialogVisible = ref(false);
const detailTab = ref<'itinerary' | 'album'>('itinerary');
const albumPanelRef = ref<InstanceType<typeof RouteJourneyAlbumPanel> | null>(null);
const commentsSectionRef = ref<HTMLElement | null>(null);
const routeVideoInputRef = ref<HTMLInputElement | null>(null);
const poiVideoInputRef = ref<HTMLInputElement | null>(null);
const videoUploading = ref(false);
const mediaPlayerVisible = ref(false);
const mediaPlayerUrl = ref('');
const mediaPlayerCover = ref<string | null>(null);
const mediaPlayerTitle = ref('');
const pendingPoiVideoUpload = ref<{
  dayIndex: number;
  attractionId?: number;
  poiName: string;
} | null>(null);
const publishedStatusForPoster = RouteStatus.PUBLISHED;

const numericRouteId = computed(() => Number(vueRoute.params.id));

const {
  route,
  loading,
  loadError,
  activeDayIndex,
  paying,
  sharing,
  savingDraft,
  postingComment,
  editModalVisible,
  editName,
  editDesc,
  regeneratePrompt,
  comments,
  commentSort,
  poiExternalLinks,
  commentText,
  commentFocus,
  commentFilterLabel,
  focusRouteCommentPoi,
  clearCommentFocus,
  filterCommentsByActiveDay,
  setCommentSort,
  handleCommentLike,
  handleAddPoiExternalLink,
  publishedStatus,
  isOwner,
  canEditRouteInfo,
  showShareSetting,
  showInteraction,
  showComments,
  canRegenerate,
  isUnlocked,
  days,
  unlockPrice,
  routeStatusLabel,
  regenerateHint,
  loadPaymentConfig,
  loadDetail,
  openEditModal,
  closeEditModal,
  handleShareToggle,
  handlePostComment,
  handleLike,
  handleFavorite,
  handleSaveDraft,
  handleRegenerate,
  handleUnlock,
  handlePublish,
} = useRouteDetail(() => numericRouteId.value);

const externalLinkConfirmUrl = ref<string | null>(null);
const externalLinkFormVisible = ref(false);
const externalLinkFormTitle = ref('');
const externalLinkFormUrl = ref('');
const externalLinkSubmitting = ref(false);
const externalLinkFormPoi = ref<{
  dayIndex: number;
  attractionId?: number;
  poiName: string;
} | null>(null);

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
    appMessage.error(t('routes.externalLinkTitleRequired'));
    return;
  }
  if (!isAllowedExternalDiscussionUrl(url)) {
    appMessage.error(t('routes.externalLinkUrlInvalid'));
    return;
  }
  externalLinkSubmitting.value = true;
  try {
    await handleAddPoiExternalLink({
      title,
      url,
      dayIndex: poi.dayIndex,
      attractionId: poi.attractionId,
      poiName: poi.poiName,
    });
    closeExternalLinkForm();
  } finally {
    externalLinkSubmitting.value = false;
  }
}

/**
 * 打开外链二次确认弹窗。
 *
 * @param url - 待跳转 URL
 */
function openExternalLinkConfirm(url: string) {
  externalLinkConfirmUrl.value = url;
}

/**
 * 用户确认后在新标签页打开外链。
 */
function confirmOpenExternalLink() {
  if (externalLinkConfirmUrl.value) {
    window.open(externalLinkConfirmUrl.value, '_blank', 'noopener,noreferrer');
  }
  externalLinkConfirmUrl.value = null;
}

const canGeneratePoster = computed(
  () =>
    isUnlocked.value &&
    days.value.length > 0 &&
    route.value?.status === publishedStatusForPoster,
);

const showDetailTabs = computed(() => isOwner.value && isUnlocked.value && days.value.length > 0);

const showAlbumTab = computed(() => showDetailTabs.value);

const canRefreshDayPlan = computed(
  () => isOwner.value && isUnlocked.value && days.value.length > 0 && detailTab.value === 'itinerary',
);

const routeVideo = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return detail?.routeVideo ?? null;
});

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
 * 触发整线路线视频文件选择。
 */
function triggerRouteVideoUpload() {
  routeVideoInputRef.value?.click();
}

/**
 * 记录待上传 POI 并打开文件选择器。
 *
 * @param payload - POI 上下文
 */
function queuePoiVideoUpload(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  pendingPoiVideoUpload.value = payload;
  poiVideoInputRef.value?.click();
}

/**
 * 从视频文件元数据估算时长（秒）。
 *
 * @param file - 视频文件
 * @returns 时长；无法读取时返回 1
 */
function estimateVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.max(1, Math.round(video.duration || 1)));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    video.src = url;
  });
}

/**
 * 处理整线路线视频上传。
 *
 * @param event - 文件选择事件
 */
async function handleRouteVideoFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const durationSec = await estimateVideoDurationSec(file);
  if (durationSec > ROUTE_VIDEO_MAX_DURATION_SEC) {
    appMessage.error(t('routes.videoDurationLimit', { sec: ROUTE_VIDEO_MAX_DURATION_SEC }));
    return;
  }

  videoUploading.value = true;
  try {
    await uploadRouteVideo(numericRouteId.value, file, { scope: 'route', durationSec });
    appMessage.success(t('routes.videoUploadSuccess'));
    await loadDetail();
  } catch (e) {
    appMessage.error(getAppErrorMessage(e, t('routes.videoUploadFailed')));
  } finally {
    videoUploading.value = false;
  }
}

/**
 * 处理 POI 绑定视频上传。
 *
 * @param event - 文件选择事件
 */
async function handlePoiVideoFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const payload = pendingPoiVideoUpload.value;
  pendingPoiVideoUpload.value = null;
  if (!file || !payload) return;

  const durationSec = await estimateVideoDurationSec(file);
  if (durationSec > ROUTE_VIDEO_MAX_DURATION_SEC) {
    appMessage.error(t('routes.videoDurationLimit', { sec: ROUTE_VIDEO_MAX_DURATION_SEC }));
    return;
  }

  videoUploading.value = true;
  try {
    await uploadRouteVideo(numericRouteId.value, file, {
      scope: 'poi',
      durationSec,
      dayIndex: payload.dayIndex,
      attractionId: payload.attractionId,
      poiName: payload.poiName,
    });
    appMessage.success(t('routes.videoUploadSuccess'));
    await loadDetail();
  } catch (e) {
    appMessage.error(getAppErrorMessage(e, t('routes.videoUploadFailed')));
  } finally {
    videoUploading.value = false;
  }
}

async function handleReplanApplied() {
  await loadDetail();
}

/**
 * 聚焦 POI 评论并滚动至评论区。
 *
 * @param payload - POI 上下文
 */
async function handlePoiCommentFocus(payload: {
  dayIndex: number;
  attractionId?: number;
  poiName: string;
}) {
  await focusRouteCommentPoi(payload);
  commentsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 格式化评论关联的行程范围标签。
 *
 * @param comment - 评论项
 * @returns 展示用范围文案
 */
function formatCommentScope(comment: RouteCommentInfo): string {
  if (comment.poiName?.trim()) {
    return t('routes.commentScopePoi', { name: comment.poiName.trim() });
  }
  if (comment.dayIndex != null) {
    return t('routes.commentScopeDay', { day: comment.dayIndex + 1 });
  }
  return '';
}

const heroMeta = computed(() => {
  if (!route.value) return '';
  return t('routes.metaHero', {
    days: route.value.days,
    budget: route.value.budgetRange ?? t('routes.budgetTbd'),
    tags: joinLabels.value(route.value.interestTags),
  });
});

watch(numericRouteId, () => {
  void loadDetail();
});

onMounted(async () => {
  await loadPaymentConfig();
  await loadDetail();
});
</script>
