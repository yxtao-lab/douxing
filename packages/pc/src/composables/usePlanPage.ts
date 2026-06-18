import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchLlmProviders, fetchLlmStatus } from '@/api/routes';
import {
  appendPlanMessage,
  createPlanSession,
  fetchPlanSession,
  selectPlanCandidate,
} from '@/api/plan-sessions';
import { fetchMembershipInfo } from '@/api/user';
import { aiPlanLoading, aiPlanMessage, cancelAiPlanRequest, isAiPlanCancelledError } from '@/api/ai-plan';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';
import type {
  LlmProviderChoice,
  LlmProviderOption,
  PlanRouteCandidate,
  PlanPetMeta,
  PlanSessionAgentState,
  PlanSessionMessageInfo,
  TravelIntentSnapshot,
  TravelRouteInfo,
} from '@douxing/shared';
import {
  LlmProvider,
  extractRouteDetailDays,
  formatPlanIntentSummary,
  formatPlanVariantLabel,
  formatRouteDayDate,
  getMemberLevelI18nKey,
  getPlanCandidateCountByMemberLevel,
  canAppendPlanByMemberLevel,
  formatPlanRecentPromptLabel,
  resolvePlanPetFocusViewModel,
} from '@douxing/shared';
import { loadPlanRecentPrompts, savePlanRecentPrompt } from '@/utils/plan-recent-prompts';

export interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
}

export function usePlanPage() {
  const router = useRouter();
  const route = useRoute();
  const userStore = useUserStore();
  const { t, currentLocale } = useLocale();

  const inputText = ref('');
  const sessionId = ref<number | null>(null);
  const previousSessionId = ref<number | null>(null);
  const currentRouteId = ref<number | null>(null);
  const currentRoute = ref<TravelRouteInfo | null>(null);
  const intentSnapshot = ref<TravelIntentSnapshot | null>(null);
  const candidates = ref<PlanRouteCandidate[]>([]);
  const messages = ref<ChatMessage[]>([]);
  const ragMatchedCount = ref(0);
  const provider = ref<LlmProviderChoice>(LlmProvider.AUTO);
  const providerOptions = ref<LlmProviderOption[]>([]);
  const llmIssueMessage = ref('');
  const memberPlanCount = ref(getPlanCandidateCountByMemberLevel(0));
  const canAppendPlan = ref(canAppendPlanByMemberLevel(0));
  const scrollAnchor = ref('');
  const recentPrompts = ref<string[]>([]);
  const petMeta = ref<PlanPetMeta | null>(null);

  const petFocus = computed(() => {
    if (!sessionId.value) return null;
    return resolvePlanPetFocusViewModel(petMeta.value, currentLocale.value);
  });

  function syncPetMeta(
    source?: { petMeta?: PlanPetMeta | null; agentState?: PlanSessionAgentState | null } | null,
  ) {
    petMeta.value = source?.petMeta ?? source?.agentState?.petMeta ?? null;
  }

  const showModelPicker = import.meta.env.DEV;
  const aiPlanning = aiPlanLoading;

  const membershipHint = computed(() => {
    if (!userStore.user) return '';
    const followUp = canAppendPlan.value
      ? t('plan.membershipFollowUpYes')
      : t('plan.membershipFollowUpNo');
    const level = t(getMemberLevelI18nKey(userStore.user.memberLevel));
    return t('plan.membershipHint', {
      level,
      count: memberPlanCount.value,
      followUp,
    });
  });

  const appendLockedHint = computed(() => {
    if (!sessionId.value || canAppendPlan.value) return '';
    return t('plan.appendLockedHint');
  });

  const composerLocked = computed(
    () => aiPlanning.value || (!!sessionId.value && !canAppendPlan.value),
  );

  const composerPlaceholder = computed(() => {
    if (sessionId.value && !canAppendPlan.value) {
      return t('plan.placeholderFollowUpLocked');
    }
    return sessionId.value ? t('plan.placeholderFollowUp') : t('plan.placeholderNew');
  });

  const quickPrompts = computed(() => [
    t('plan.quickPrompt1'),
    t('plan.quickPrompt2'),
    t('plan.quickPrompt3'),
  ]);

  const intentSummary = computed(() => {
    if (!intentSnapshot.value) return '';
    return formatPlanIntentSummary(intentSnapshot.value, currentLocale.value);
  });

  const intentBarExtra = computed(() => {
    if (ragMatchedCount.value <= 0) return '';
    return t('plan.intentRagExtra', { count: ragMatchedCount.value });
  });

  const providerPickerLabels = computed(() =>
    providerOptions.value.map((opt) =>
      opt.available
        ? resolveProviderLabel(opt)
        : `${resolveProviderLabel(opt)}${t('plan.providerNotConfigured')}`,
    ),
  );

  const currentProviderLabel = computed(() => {
    const opt = providerOptions.value.find((o) => o.id === provider.value);
    if (!opt) return t('plan.chooseProvider');
    const label = resolveProviderLabel(opt);
    return opt.available ? label : `${label}${t('plan.providerNotConfigured')}`;
  });

  const previewDays = computed(() => extractRouteDetailDays(currentRoute.value?.routeDetail));

  const userAvatarText = computed(() =>
    (userStore.user?.nickname || userStore.user?.username || t('plan.userAvatarFallback')).slice(
      0,
      1,
    ),
  );

  function resolveProviderLabel(opt: LlmProviderOption): string {
    if (opt.id === LlmProvider.AUTO) return t('plan.providerAuto');
    if (opt.id === LlmProvider.LMSTUDIO) return t('plan.providerLmstudio');
    if (opt.id === LlmProvider.DEEPSEEK) {
      const modelMatch = opt.label.match(/[（(]([^）)]+)[）)]/);
      const model = modelMatch?.[1] ?? opt.label;
      return t('plan.providerDeepseek', { model });
    }
    return opt.label;
  }

  function formatRouteDays(days: number | undefined | null): string {
    if (days == null) return '—';
    return `${days}${t('plan.daysUnit')}`;
  }

  function candidateLabel(item: PlanRouteCandidate): string {
    return formatPlanVariantLabel(item.variantKey, currentLocale.value) || item.label;
  }

  function dayHeading(dayIndex: number, title?: string) {
    if (title?.trim()) return title;
    return formatRouteDayDate(dayIndex, currentLocale.value);
  }

  function reportLlmIssue(message: string) {
    llmIssueMessage.value = message;
  }

  function clearLlmIssue() {
    llmIssueMessage.value = '';
  }

  function handleGenerationResult(result: { generationSource?: 'llm' | 'template' }) {
    if (result.generationSource === 'template') {
      reportLlmIssue(t('plan.llmTemplateFallback'));
    } else {
      clearLlmIssue();
    }
  }

  function mapMessages(list: PlanSessionMessageInfo[]): ChatMessage[] {
    return list.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
    }));
  }

  function syncCurrentRoute(routeId: number | null, route?: TravelRouteInfo | null) {
    currentRouteId.value = routeId;
    if (!routeId || !route) {
      currentRoute.value = null;
      return;
    }
    currentRoute.value = route;
  }

  function scrollToBottom() {
    scrollAnchor.value = '';
    nextTick(() => {
      if (currentRouteId.value && sessionId.value) {
        scrollAnchor.value = 'route-preview';
        return;
      }
      const last = messages.value[messages.value.length - 1];
      if (last) scrollAnchor.value = `msg-${last.id}`;
    });
  }

  function clearSessionView() {
    sessionId.value = null;
    currentRouteId.value = null;
    currentRoute.value = null;
    intentSnapshot.value = null;
    ragMatchedCount.value = 0;
    candidates.value = [];
    messages.value = [];
    petMeta.value = null;
    inputText.value = '';
    clearLlmIssue();
    refreshStatusForProvider();
  }

  function startNewSession() {
    if (aiPlanning.value) return;
    if (sessionId.value) previousSessionId.value = sessionId.value;
    clearSessionView();
  }

  async function restorePreviousSession() {
    if (aiPlanning.value || !previousSessionId.value) return;
    try {
      await loadSession(previousSessionId.value);
      previousSessionId.value = null;
    } catch (err) {
      appMessage.error(getAppErrorMessage(err, t('plan.restoreSessionFailed')));
    }
  }

  function refreshStatusForProvider() {
    const p = provider.value;
    if (p === LlmProvider.AUTO) {
      if (!providerOptions.value.some((o) => o.available)) {
        reportLlmIssue(t('plan.llmNoModel'));
      } else {
        clearLlmIssue();
      }
      return;
    }
    const opt = providerOptions.value.find((o) => o.id === p);
    if (!opt?.available) {
      reportLlmIssue(
        t('plan.llmProviderNotReady', { label: opt ? resolveProviderLabel(opt) : p }),
      );
    } else {
      clearLlmIssue();
    }
  }

  function onProviderChange(event: Event) {
    if (aiPlanning.value || sessionId.value) return;
    const value = (event.target as HTMLSelectElement).value as LlmProviderChoice;
    const opt = providerOptions.value.find((o) => o.id === value);
    if (!opt?.available) {
      appMessage.warning(t('plan.providerUnavailableToast'));
      return;
    }
    provider.value = value;
    refreshStatusForProvider();
  }

  async function loadSession(id: number) {
    const session = await fetchPlanSession(id);
    sessionId.value = session.id;
    intentSnapshot.value = session.intentSnapshot ?? null;
    candidates.value = session.candidates ?? [];
    syncCurrentRoute(session.routeId, session.route ?? null);
    ragMatchedCount.value =
      typeof (session.route?.routeDetail as Record<string, unknown> | undefined)?.ragMatchedCount ===
      'number'
        ? ((session.route?.routeDetail as Record<string, unknown>).ragMatchedCount as number)
        : 0;
    messages.value = mapMessages(session.messages);
    syncPetMeta(session);
    if (session.provider) {
      provider.value = session.provider;
      refreshStatusForProvider();
    }
    scrollToBottom();
  }

  async function handleSelectCandidate(item: PlanRouteCandidate) {
    if (!sessionId.value || item.isSelected || aiPlanning.value) return;
    try {
      const result = await selectPlanCandidate(sessionId.value, { routeId: item.routeId });
      syncCurrentRoute(result.id, result);
      candidates.value = result.candidates ?? [];
      ragMatchedCount.value = result.ragMatchedCount ?? 0;
      syncPetMeta(result);
      appMessage.success(t('plan.candidateSwitched'));
    } catch (err) {
      appMessage.error(getAppErrorMessage(err, t('plan.candidateSwitchFailed')));
    }
  }

  function goMembership() {
    router.push({ name: 'profile' });
  }

  function openRouteDetail() {
    if (!currentRouteId.value) return;
    router.push({ name: 'route-detail', params: { id: String(currentRouteId.value) } });
  }

  function cancelAiPlan() {
    if (!aiPlanLoading.value) return;
    cancelAiPlanRequest();
    appMessage.info(t('plan.cancelled'), 2800);
  }

  function applyQuickPrompt(text: string) {
    inputText.value = text;
  }

  function refreshRecentPrompts() {
    recentPrompts.value = loadPlanRecentPrompts(userStore.user?.id);
  }

  function recordRecentPrompt(content: string) {
    recentPrompts.value = savePlanRecentPrompt(content, userStore.user?.id);
  }

  function recentPromptLabel(prompt: string): string {
    return formatPlanRecentPromptLabel(prompt);
  }

  async function handleSend() {
    if (aiPlanning.value) return;
    if (!userStore.token) {
      router.push({ name: 'login', query: { redirect: route.fullPath } });
      return;
    }

    const content = inputText.value.trim();
    if (!content) {
      appMessage.warning(t('plan.inputRequired'));
      return;
    }
    if (sessionId.value && !canAppendPlan.value) {
      appMessage.warning(t('plan.appendLockedHint'));
      return;
    }

    const pendingId = `pending-${Date.now()}`;
    messages.value.push({ id: pendingId, role: 'user', content });
    inputText.value = '';
    scrollToBottom();

    try {
      if (!sessionId.value) {
        const result = await createPlanSession({ prompt: content, provider: provider.value });
        sessionId.value = result.sessionId;
        syncCurrentRoute(result.id, result);
        intentSnapshot.value = result.intentSnapshot ?? null;
        ragMatchedCount.value = result.ragMatchedCount ?? 0;
        candidates.value = result.candidates ?? [];
        if (result.memberPlanCandidateCount != null) {
          memberPlanCount.value = result.memberPlanCandidateCount;
        }
        handleGenerationResult(result);
        syncPetMeta(result);
        const loaded = await fetchPlanSession(result.sessionId);
        messages.value = mapMessages(loaded.messages);
        syncPetMeta(loaded);
        candidates.value = loaded.candidates ?? result.candidates ?? [];
        syncCurrentRoute(result.id, loaded.route ?? result);
        scrollToBottom();
        recordRecentPrompt(content);
        appMessage.success(t('plan.plansGenerated'));
        return;
      }

      const result = await appendPlanMessage(sessionId.value, { content });
      syncCurrentRoute(result.id, result);
      intentSnapshot.value = result.intentSnapshot ?? null;
      ragMatchedCount.value = result.ragMatchedCount ?? 0;
      handleGenerationResult(result);
      syncPetMeta(result);
      const loaded = await fetchPlanSession(sessionId.value);
      messages.value = mapMessages(loaded.messages);
      syncPetMeta(loaded);
      candidates.value = loaded.candidates ?? result.candidates ?? [];
      syncCurrentRoute(result.id, result);
      scrollToBottom();
      recordRecentPrompt(content);
      appMessage.success(t('plan.planUpdated'));
    } catch (err) {
      messages.value = messages.value.filter((m) => m.id !== pendingId);
      if (!isAiPlanCancelledError(err)) {
        appMessage.error(getAppErrorMessage(err, t('plan.sendFailed')));
        inputText.value = content;
      }
    }
  }

  async function initLlmStatus() {
    try {
      const [{ options }, status] = await Promise.all([fetchLlmProviders(), fetchLlmStatus()]);
      providerOptions.value = options;
      if (status.defaultProvider === 'deepseek') {
        provider.value = LlmProvider.DEEPSEEK;
      }
      if (!status.enabled) {
        reportLlmIssue(t('plan.llmServiceDisabled'));
      } else if (!status.available) {
        reportLlmIssue(t('plan.llmNoModel'));
      } else {
        refreshStatusForProvider();
      }
    } catch {
      reportLlmIssue(t('plan.llmDetectFailed'));
    }
  }

  async function refreshMembership() {
    if (!userStore.user) return;
    memberPlanCount.value = getPlanCandidateCountByMemberLevel(userStore.user.memberLevel);
    canAppendPlan.value = canAppendPlanByMemberLevel(userStore.user.memberLevel);
    try {
      const info = await fetchMembershipInfo();
      memberPlanCount.value = info.planCandidateCount;
      canAppendPlan.value = info.canAppendPlan;
    } catch {
      /* 使用本地等级推断 */
    }
  }

  onMounted(async () => {
    refreshRecentPrompts();
    await initLlmStatus();
    await refreshMembership();

    const prompt = route.query.prompt;
    if (typeof prompt === 'string' && prompt.trim()) {
      inputText.value = decodeURIComponent(prompt.trim());
    }

    const rawSessionId = route.query.sessionId;
    if (typeof rawSessionId === 'string' && rawSessionId.trim() && userStore.token) {
      const id = Number(rawSessionId);
      if (!Number.isNaN(id)) {
        try {
          await loadSession(id);
        } catch {
          /* 忽略无效会话 */
        }
      }
    }
  });

  watch(
    () => userStore.user,
    () => {
      refreshMembership();
      refreshRecentPrompts();
    },
  );

  return {
    inputText,
    sessionId,
    previousSessionId,
    currentRouteId,
    currentRoute,
    messages,
    candidates,
    intentSummary,
    intentBarExtra,
    petFocus,
    membershipHint,
    appendLockedHint,
    llmIssueMessage,
    scrollAnchor,
    aiPlanning,
    aiPlanMessage,
    showModelPicker,
    provider,
    providerOptions,
    providerPickerLabels,
    currentProviderLabel,
    quickPrompts,
    recentPrompts,
    composerLocked,
    composerPlaceholder,
    previewDays,
    userAvatarText,
    formatRouteDays,
    candidateLabel,
    dayHeading,
    startNewSession,
    restorePreviousSession,
    handleSelectCandidate,
    handleSend,
    onProviderChange,
    applyQuickPrompt,
    recentPromptLabel,
    goMembership,
    openRouteDetail,
    cancelAiPlan,
  };
}
