import { computed, ref, watch } from 'vue';
import type {
  RouteCommentInfo,
  RoutePoiExternalLinkInfo,
  RouteDayPlan,
  RouteDetailPayload,
  TravelRouteInfo,
} from '@douxing/shared';
import { RouteStatus } from '@douxing/shared';
import {
  createRouteComment,
  fetchRouteComments,
  fetchRouteDetail,
  toggleRouteCommentLike,
  fetchRoutePoiExternalLinks,
  createRoutePoiExternalLink,
  publishRoute,
  regenerateRoute,
  setRoutePublicShare,
  toggleRouteFavorite,
  toggleRouteLike,
  updateRouteDraft,
} from '@/api/routes';
import { completeRouteUnlockPayment, fetchOrderPaymentConfig } from '@/api/orders';
import { isAiPlanCancelledError } from '@/api/ai-plan';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';
import { trackAnalytics } from '@/utils/analytics';
import { AnalyticsEventName } from '@douxing/shared';

export function useRouteDetail(routeId: () => number) {
  const { t } = useLocale();
  const userStore = useUserStore();

  const route = ref<TravelRouteInfo | null>(null);
  const loading = ref(false);
  const loadError = ref('');
  const activeDayIndex = ref(0);
  const routeUnlockPaymentRequired = ref(false);
  const paying = ref(false);
  const sharing = ref(false);
  const savingDraft = ref(false);
  const postingComment = ref(false);
  const editModalVisible = ref(false);
  const editName = ref('');
  const editDesc = ref('');
  const regeneratePrompt = ref('');
  const comments = ref<RouteCommentInfo[]>([]);
  const commentSort = ref<'hot' | 'recent'>('hot');
  const poiExternalLinks = ref<RoutePoiExternalLinkInfo[]>([]);
  const commentText = ref('');
  const commentFocus = ref<{
    dayIndex: number;
    attractionId?: number;
    poiName: string;
  } | null>(null);

  const publishedStatus = RouteStatus.PUBLISHED;

  const currentUserId = computed(() => userStore.user?.id ?? 0);

  const isOwner = computed(
    () => route.value != null && route.value.creatorId === currentUserId.value,
  );

  const canEditRouteInfo = computed(
    () => isOwner.value && route.value?.status === RouteStatus.DRAFT,
  );

  const showShareSetting = computed(
    () => isOwner.value && route.value?.status === RouteStatus.PUBLISHED,
  );

  const showInteraction = computed(() => route.value?.isPublic === true);

  const showComments = computed(() => route.value?.isPublic === true);

  const canRegenerate = computed(
    () => route.value?.isAiGenerated === true && route.value?.status === RouteStatus.DRAFT,
  );

  const isUnlocked = computed(() => {
    if (route.value?.isPublic && !isOwner.value) return true;
    if (!routeUnlockPaymentRequired.value && isOwner.value) return true;
    const detail = route.value?.routeDetail as Record<string, unknown> | null;
    return detail?.isUnlocked === true || (route.value?.unlockPrice ?? 0) === 0;
  });

  const days = computed((): RouteDayPlan[] => {
    const detail = route.value?.routeDetail as RouteDetailPayload | null;
    return detail?.days ?? [];
  });

  const unlockPrice = computed(() => {
    const detail = route.value?.routeDetail as Record<string, unknown> | null;
    return (detail?.unlockPrice as number) ?? route.value?.unlockPrice ?? 9.9;
  });

  const routeStatusLabel = computed(() => {
    if (!route.value) return '';
    if (route.value.status === RouteStatus.PUBLISHED) return t('routes.statusPublished');
    if (route.value.status === RouteStatus.ARCHIVED) return t('routes.statusArchived');
    return t('routes.statusDraft');
  });

  const regenerateHint = computed(() =>
    routeUnlockPaymentRequired.value
      ? t('routes.regenerateHintUnlockReset')
      : t('routes.regenerateHint'),
  );

  watch(
    () => days.value.length,
    () => {
      if (activeDayIndex.value >= days.value.length) {
        activeDayIndex.value = 0;
      }
    },
  );

  async function loadPaymentConfig() {
    try {
      const config = await fetchOrderPaymentConfig();
      routeUnlockPaymentRequired.value = config.routeUnlockPaymentRequired;
    } catch {
      routeUnlockPaymentRequired.value = false;
    }
  }

  const commentFilterLabel = computed(() => {
    if (commentFocus.value?.poiName) {
      return t('routes.commentFilterPoi', { name: commentFocus.value.poiName });
    }
    return '';
  });

  /**
   * 加载路线 POI 外链讨论列表（H10-d）。
   */
  async function loadPoiExternalLinks() {
    const id = routeId();
    if (!id || !showComments.value) {
      poiExternalLinks.value = [];
      return;
    }
    try {
      poiExternalLinks.value = await fetchRoutePoiExternalLinks(id, { limit: 50 });
    } catch {
      poiExternalLinks.value = [];
    }
  }

  /**
   * 切换评论排序并重新拉取。
   *
   * @param sort - `hot` 或 `recent`
   */
  async function setCommentSort(sort: 'hot' | 'recent') {
    commentSort.value = sort;
    await loadComments();
  }

  /**
   * 切换单条评论点赞状态。
   *
   * @param commentId - 评论 ID
   */
  async function handleCommentLike(commentId: number) {
    const id = routeId();
    if (!id) return;
    try {
      const result = await toggleRouteCommentLike(id, commentId);
      const idx = comments.value.findIndex((c) => c.id === commentId);
      if (idx >= 0) {
        comments.value[idx] = {
          ...comments.value[idx]!,
          isLiked: result.liked,
          likeCount: result.likeCount,
        };
      }
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.commentLikeFailed')), 'error');
    }
  }

  /**
   * 为 POI 提交外链讨论。
   *
   * @param payload - 标题、URL 与 POI 上下文
   */
  async function handleAddPoiExternalLink(payload: {
    title: string;
    url: string;
    dayIndex: number;
    attractionId?: number;
    poiName: string;
  }) {
    const id = routeId();
    if (!id) return;
    try {
      const created = await createRoutePoiExternalLink(id, payload);
      poiExternalLinks.value = [created, ...poiExternalLinks.value];
      showToast(t('routes.externalLinkAdded'), 'success');
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.externalLinkFailed')), 'error');
    }
  }

  /**
   * 按当前筛选条件拉取评论列表。
   */
  async function loadComments() {
    const id = routeId();
    if (!route.value?.isPublic || !id) {
      comments.value = [];
      return;
    }
    try {
      const params: { limit?: number; dayIndex?: number; attractionId?: number } = { limit: 50 };
      if (commentFocus.value?.attractionId != null) {
        params.attractionId = commentFocus.value.attractionId;
      } else if (commentFocus.value != null) {
        params.dayIndex = commentFocus.value.dayIndex;
      }
      params.sort = commentSort.value;
      comments.value = await fetchRouteComments(id, params);
    } catch {
      comments.value = [];
    }
  }

  /**
   * 聚焦某 POI 相关评论并刷新列表。
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
   * 清除 POI 评论筛选，恢复路线级全量评论。
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

  async function loadDetail() {
    const id = routeId();
    if (!id) return;

    loading.value = true;
    loadError.value = '';
    try {
      activeDayIndex.value = 0;
      commentFocus.value = null;
      route.value = await fetchRouteDetail(id);
      editName.value = route.value?.name ?? '';
      editDesc.value = route.value?.description ?? '';
      if (route.value?.sourcePrompt) {
        regeneratePrompt.value = route.value.sourcePrompt;
      } else if (canRegenerate.value && !regeneratePrompt.value) {
        regeneratePrompt.value = route.value?.description ?? '';
      }
      await loadComments();
      await loadPoiExternalLinks();
      trackAnalytics(AnalyticsEventName.ROUTE_VIEW, { routeId: id });
    } catch (err) {
      loadError.value = getAppErrorMessage(err, t('routes.loadFailed'));
    } finally {
      loading.value = false;
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    appMessage[type](message);
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

  async function handleShareToggle(isPublic: boolean) {
    const id = routeId();
    if (!id) return;
    sharing.value = true;
    try {
      route.value = await setRoutePublicShare(id, { isPublic });
      showToast(isPublic ? t('routes.shareOn') : t('routes.shareOff'), 'success');
      await loadComments();
      await loadPoiExternalLinks();
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.shareSetFailed')), 'error');
      await loadDetail();
    } finally {
      sharing.value = false;
    }
  }

  async function handlePostComment() {
    const id = routeId();
    const text = commentText.value.trim();
    if (!id || !text) {
      showToast(t('routes.commentRequired'), 'warning');
      return;
    }
    postingComment.value = true;
    try {
      const created = await createRouteComment(id, {
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
      showToast(t('routes.commentSuccess'), 'success');
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.commentFailed')), 'error');
    } finally {
      postingComment.value = false;
    }
  }

  async function handleLike() {
    const id = routeId();
    if (!id) return;
    try {
      const result = await toggleRouteLike(id);
      if (route.value) {
        route.value.isLiked = result.liked;
        route.value.likeCount = result.likeCount;
      }
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.operationFailed')), 'error');
    }
  }

  async function handleFavorite() {
    const id = routeId();
    if (!id) return;
    try {
      const result = await toggleRouteFavorite(id);
      if (route.value) {
        route.value.isFavorited = result.favorited;
        route.value.collectCount = result.collectCount;
      }
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.operationFailed')), 'error');
    }
  }

  async function handleSaveDraft() {
    const id = routeId();
    const name = editName.value.trim();
    if (!id || !name) {
      showToast(t('routes.nameRequired'), 'warning');
      return;
    }
    savingDraft.value = true;
    try {
      route.value = await updateRouteDraft(id, {
        name,
        description: editDesc.value.trim() || null,
      });
      showToast(t('routes.draftSaved'), 'success');
      editModalVisible.value = false;
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.saveFailed')), 'error');
    } finally {
      savingDraft.value = false;
    }
  }

  async function handleRegenerate() {
    const id = routeId();
    const text = regeneratePrompt.value.trim();
    if (!id || !text) {
      showToast(t('routes.regeneratePromptRequired'), 'warning');
      return;
    }
    try {
      const result = await regenerateRoute(id, { prompt: text });
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
      showToast(tip, 'success');
      route.value = result;
      regeneratePrompt.value = result.sourcePrompt ?? text;
      activeDayIndex.value = 0;
    } catch (err) {
      if (!isAiPlanCancelledError(err)) {
        showToast(getAppErrorMessage(err, t('routes.regenerateFailed')), 'error');
      }
    }
  }

  async function handleUnlock() {
    const id = routeId();
    if (!id) return;
    paying.value = true;
    try {
      await completeRouteUnlockPayment(id);
      showToast(t('routes.unlockSuccess'), 'success');
      await loadDetail();
    } catch (err) {
      const msg = getAppErrorMessage(err, t('routes.payFailed'));
      if (msg !== t('routes.payCancelled')) {
        showToast(msg, 'warning');
      }
    } finally {
      paying.value = false;
    }
  }

  async function handlePublish() {
    const id = routeId();
    if (!id) return;
    try {
      route.value = await publishRoute(id);
      trackAnalytics(AnalyticsEventName.ROUTE_PUBLISH, { routeId: id });
      showToast(t('routes.publishSuccess'), 'success');
    } catch (err) {
      showToast(getAppErrorMessage(err, t('routes.publishFailed')), 'error');
    }
  }

  return {
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
    handleCommentLike,
    setCommentSort,
    handleAddPoiExternalLink,
    loadPoiExternalLinks,
    handleLike,
    handleFavorite,
    handleSaveDraft,
    handleRegenerate,
    handleUnlock,
    handlePublish,
  };
}
