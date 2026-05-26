<template>
  <view class="page tab-page" :style="pageStyle">
    <view class="page-top">
      <view class="header">
      <view class="header-top">
        <text class="title">{{ t('plan.title') }}</text>
        <view v-if="sessionId || currentRouteId || previousSessionId" class="header-actions">
          <text
            v-if="previousSessionId && !sessionId"
            class="header-route-link"
            @click="restorePreviousSession"
          >{{ t('plan.backToChat') }}</text>
          <text v-if="currentRouteId && sessionId" class="header-route-link" @click="openRouteDetail">{{ t('plan.routeDetail') }}</text>
          <text v-if="sessionId" class="new-session" @click="startNewSession">{{ t('plan.newSession') }}</text>
        </view>
      </view>
      <text class="desc">{{ t('plan.desc') }}</text>
      <view v-if="intentSummary" class="intent-bar">
        <text class="intent-label">{{ t('plan.intentLabel') }}</text>
        <text class="intent-value">{{ intentSummary }}{{ intentBarExtra }}</text>
      </view>
      <view v-if="membershipHint" class="membership-bar">
        <text class="membership-label">{{ membershipHint }}</text>
      </view>
      <view v-if="appendLockedHint" class="append-locked-bar">
        <text class="append-locked-text">{{ appendLockedHint }}</text>
        <text class="append-locked-link" @click="goMembership">{{ t('nav.membership') }}</text>
      </view>
      <view v-if="showLlmStatus" class="llm-status warn">
        <text>{{ llmIssueMessage }}</text>
      </view>
      </view>

      <view v-if="!sessionId" class="card setup-card">
        <template v-if="showModelPicker">
          <text class="label">{{ t('plan.selectModel') }}</text>
          <picker
            mode="selector"
            :range="providerPickerLabels"
            :value="providerPickerIndex"
            :disabled="!!sessionId || aiPlanning"
            @change="onProviderPickerChange"
          >
            <view class="provider-picker" :class="{ disabled: !!sessionId || aiPlanning }">
              <text class="provider-picker-text">{{ currentProviderLabel }}</text>
              <text class="provider-picker-arrow">▼</text>
            </view>
          </picker>
        </template>
        <view class="chips">
          <text
            v-for="item in quickPrompts"
            :key="item"
            class="chip"
            @click="inputText = item"
          >{{ item }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      v-if="sessionId || messages.length > 0"
      class="chat-scroll"
      scroll-y
      :show-scrollbar="true"
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
      <view class="chat-scroll-inner">
        <view
          v-for="msg in messages"
          :id="`msg-${msg.id}`"
          :key="msg.id"
          class="msg-row"
        >
          <view class="msg-avatar-slot">
            <view v-if="msg.role === 'assistant'" class="msg-avatar assistant-avatar">
              <text class="iconfont icon-plan assistant-icon" />
            </view>
          </view>
          <view class="msg-content" :class="msg.role">
            <view class="bubble">
              <text>{{ msg.content }}</text>
            </view>
          </view>
          <view class="msg-avatar-slot">
            <view v-if="msg.role === 'user'" class="msg-avatar">
              <image
                v-if="user?.avatar"
                class="msg-avatar-img"
                :src="user.avatar"
                mode="aspectFill"
              />
              <text v-else class="msg-avatar-text">{{ userAvatarText }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-dock">
      <view
        v-if="candidates.length === 2"
        class="candidate-scroll candidate-scroll--fit"
      >
        <view
          v-for="item in candidates"
          :key="item.routeId"
          class="candidate-card"
          :class="{ active: item.isSelected }"
          @click="handleSelectCandidate(item)"
        >
          <text class="candidate-label">{{ candidateLabel(item) }}</text>
          <text class="candidate-name">{{ item.route?.name || t('plan.routePlanFallback') }}</text>
          <text class="candidate-meta">
            {{ formatRouteDays(item.route?.days) }}
            <text v-if="item.route?.budgetRange"> · {{ item.route.budgetRange }}</text>
          </text>
        </view>
      </view>
      <scroll-view
        v-else-if="candidates.length > 2"
        class="candidate-scroll candidate-scroll--scroll"
        scroll-x
        enable-flex
      >
        <view
          v-for="item in candidates"
          :key="item.routeId"
          class="candidate-card"
          :class="{ active: item.isSelected }"
          @click="handleSelectCandidate(item)"
        >
          <text class="candidate-label">{{ candidateLabel(item) }}</text>
          <text class="candidate-name">{{ item.route?.name || t('plan.routePlanFallback') }}</text>
          <text class="candidate-meta">
            {{ formatRouteDays(item.route?.days) }}
            <text v-if="item.route?.budgetRange"> · {{ item.route.budgetRange }}</text>
          </text>
        </view>
      </scroll-view>

      <VoiceTextComposer
        ref="composerRef"
        v-model="inputText"
        :placeholder="composerPlaceholder"
        :disabled="composerLocked"
        :loading="aiPlanning"
        @send="handleSend"
      />
    </view>

    <DouxingTabBar :current="1" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { fetchLlmStatus, fetchLlmProviders } from '@/api/routes';
import {
  appendPlanMessage,
  createPlanSession,
  fetchPlanSession,
  selectPlanCandidate,
} from '@/api/plan-sessions';
import * as authStorage from '@/utils/auth-storage';
import { ensureLoggedInUser } from '@/utils/ensure-logged-in';
import { fetchMembershipInfo } from '@/api/user';
import { aiPlanLoadingState, isAiPlanCancelledError } from '@/utils/ai-plan-loading';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import VoiceTextComposer from '@/components/voice-text-composer/VoiceTextComposer.vue';
import type {
  LlmProviderChoice,
  LlmProviderOption,
  PlanSessionMessageInfo,
  TravelIntentSnapshot,
  UserInfo,
  PlanRouteCandidate,
} from '@douxing/shared';
import {
  LlmProvider,
  formatPlanIntentSummary,
  formatPlanVariantLabel,
  getMemberLevelI18nKey,
  getPlanCandidateCountByMemberLevel,
  canAppendPlanByMemberLevel,
} from '@douxing/shared';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
}

const { t, tf } = useTf();
const { currentLocale } = useInterestTagLabel();
usePageTitle('nav.plan');

const inputText = ref('');
const composerRef = ref<InstanceType<typeof VoiceTextComposer> | null>(null);
const user = ref<UserInfo | null>(authStorage.getStoredUser());
const sessionId = ref<number | null>(null);
const previousSessionId = ref<number | null>(null);
const currentRouteId = ref<number | null>(null);
const intentSnapshot = ref<TravelIntentSnapshot | null>(null);
const candidates = ref<PlanRouteCandidate[]>([]);
const messages = ref<ChatMessage[]>([]);
const scrollIntoView = ref('');
const aiPlanning = computed(() => aiPlanLoadingState.active);
const provider = ref<LlmProviderChoice>(LlmProvider.AUTO);
const providerOptions = ref<LlmProviderOption[]>([]);
const llmAvailable = ref<boolean | null>(null);
const llmIssueMessage = ref('');
const memberPlanCount = ref(getPlanCandidateCountByMemberLevel(0));
const canAppendPlan = ref(canAppendPlanByMemberLevel(0));
/** 模型选择仅开发环境展示，生产包使用服务端默认策略 */
const showModelPicker = import.meta.env.DEV;

const memberLevelLabel = computed(() =>
  t(getMemberLevelI18nKey(user.value?.memberLevel)),
);

const membershipHint = computed(() => {
  if (!authStorage.getStoredUser()) return '';
  const followUp = canAppendPlan.value
    ? t('plan.membershipFollowUpYes')
    : t('plan.membershipFollowUpNo');
  return tf('plan.membershipHint', {
    level: memberLevelLabel.value,
    count: memberPlanCount.value,
    followUp,
  });
});

const appendLockedHint = computed(() => {
  if (!sessionId.value || canAppendPlan.value) return '';
  return t('plan.appendLockedHint');
});

const composerLocked = computed(() => aiPlanning.value || (!!sessionId.value && !canAppendPlan.value));

const showLlmStatus = computed(() => llmIssueMessage.value.length > 0);

const pageStyle = computed(() => ({
  '--candidate-dock-height': candidates.value.length > 1 ? '152rpx' : '0rpx',
}));

const userAvatarText = computed(() =>
  (user.value?.nickname || user.value?.username || t('plan.userAvatarFallback')).slice(0, 1),
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

function formatRouteDays(days: number | undefined | null): string {
  if (days == null) return '—';
  return `${days}${t('plan.daysUnit')}`;
}

function resolveProviderLabel(opt: LlmProviderOption): string {
  if (opt.id === LlmProvider.AUTO) return t('plan.providerAuto');
  if (opt.id === LlmProvider.LMSTUDIO) return t('plan.providerLmstudio');
  if (opt.id === LlmProvider.DEEPSEEK) {
    const modelMatch = opt.label.match(/[（(]([^）)]+)[）)]/);
    const model = modelMatch?.[1] ?? opt.label;
    return tf('plan.providerDeepseek', { model });
  }
  return opt.label;
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

const intentSummary = computed(() => {
  const intent = intentSnapshot.value;
  if (!intent) return '';
  return formatPlanIntentSummary(intent, currentLocale.value);
});

function candidateLabel(item: PlanRouteCandidate): string {
  return (
    formatPlanVariantLabel(item.variantKey, currentLocale.value) || item.label
  );
}

const ragMatchedCount = ref(0);

const intentBarExtra = computed(() => {
  if (ragMatchedCount.value <= 0) return '';
  return tf('plan.intentRagExtra', { count: ragMatchedCount.value });
});

const providerPickerLabels = computed(() =>
  providerOptions.value.map((opt) =>
    opt.available ? resolveProviderLabel(opt) : `${resolveProviderLabel(opt)}${t('plan.providerNotConfigured')}`,
  ),
);

const providerPickerIndex = computed(() => {
  const idx = providerOptions.value.findIndex((o) => o.id === provider.value);
  return idx >= 0 ? idx : 0;
});

const currentProviderLabel = computed(() => {
  const opt = providerOptions.value.find((o) => o.id === provider.value);
  if (!opt) return t('plan.chooseProvider');
  const label = resolveProviderLabel(opt);
  return opt.available ? label : `${label}${t('plan.providerNotConfigured')}`;
});

function onProviderPickerChange(e: { detail: { value: string | number } }) {
  if (aiPlanLoadingState.active || sessionId.value) return;
  const index = Number(e.detail.value);
  const opt = providerOptions.value[index];
  if (!opt) return;
  if (!opt.available) {
    uni.showToast({ title: t('plan.providerUnavailableToast'), icon: 'none' });
    return;
  }
  provider.value = opt.id;
  refreshStatusForProvider();
}

function refreshStatusForProvider() {
  const p = provider.value;
  if (p === LlmProvider.AUTO) {
    llmAvailable.value = providerOptions.value.some((o) => o.available);
    if (!llmAvailable.value) {
      reportLlmIssue(t('plan.llmNoModel'));
    } else {
      clearLlmIssue();
    }
    return;
  }
  const opt = providerOptions.value.find((o) => o.id === p);
  llmAvailable.value = opt?.available ?? false;
  if (!llmAvailable.value) {
    reportLlmIssue(
      tf('plan.llmProviderNotReady', { label: opt ? resolveProviderLabel(opt) : p }),
    );
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

function scrollToBottom() {
  const last = messages.value[messages.value.length - 1];
  if (!last) return;
  scrollIntoView.value = '';
  nextTick(() => {
    scrollIntoView.value = `msg-${last.id}`;
  });
}

function resetComposerInput() {
  composerRef.value?.clear();
}

function clearSessionView() {
  sessionId.value = null;
  currentRouteId.value = null;
  intentSnapshot.value = null;
  ragMatchedCount.value = 0;
  candidates.value = [];
  messages.value = [];
  resetComposerInput();
  clearLlmIssue();
  refreshStatusForProvider();
}

function startNewSession() {
  if (aiPlanLoadingState.active) return;
  if (sessionId.value) {
    previousSessionId.value = sessionId.value;
  }
  clearSessionView();
}

async function restorePreviousSession() {
  if (aiPlanLoadingState.active || !previousSessionId.value) return;
  try {
    await loadSession(previousSessionId.value);
    previousSessionId.value = null;
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : t('plan.restoreSessionFailed'),
      icon: 'none',
    });
  }
}

function openRouteDetail() {
  if (!currentRouteId.value) return;
  uni.navigateTo({ url: `/pages/routes/detail?id=${currentRouteId.value}` });
}

function goMembership() {
  uni.navigateTo({ url: '/pages/profile/membership' });
}

async function loadSession(id: number) {
  const session = await fetchPlanSession(id);
  sessionId.value = session.id;
  currentRouteId.value = session.routeId;
  intentSnapshot.value = session.intentSnapshot ?? null;
  candidates.value = session.candidates ?? [];
  ragMatchedCount.value =
    typeof (session.route?.routeDetail as Record<string, unknown> | undefined)?.ragMatchedCount ===
    'number'
      ? ((session.route?.routeDetail as Record<string, unknown>).ragMatchedCount as number)
      : 0;
  messages.value = mapMessages(session.messages);
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
    currentRouteId.value = result.id;
    candidates.value = result.candidates ?? [];
    ragMatchedCount.value = result.ragMatchedCount ?? 0;
    uni.showToast({ title: t('plan.candidateSwitched'), icon: 'success' });
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : t('plan.candidateSwitchFailed'),
      icon: 'none',
    });
  }
}

onMounted(async () => {
  try {
    const [{ options }, status] = await Promise.all([fetchLlmProviders(), fetchLlmStatus()]);
    providerOptions.value = options;
    if (status.defaultProvider === 'deepseek') {
      provider.value = LlmProvider.DEEPSEEK;
    }
    llmAvailable.value = status.enabled && status.available;
    if (!status.enabled) {
      reportLlmIssue(t('plan.llmServiceDisabled'));
    } else if (!status.available) {
      reportLlmIssue(t('plan.llmNoModel'));
    } else {
      refreshStatusForProvider();
    }
  } catch {
    llmAvailable.value = false;
    reportLlmIssue(t('plan.llmDetectFailed'));
  }
});

onShow(() => {
  uni.hideTabBar({ animation: false });
  user.value = authStorage.getStoredUser();
  if (user.value) {
    memberPlanCount.value = getPlanCandidateCountByMemberLevel(user.value.memberLevel);
    canAppendPlan.value = canAppendPlanByMemberLevel(user.value.memberLevel);
    fetchMembershipInfo()
      .then((info) => {
        memberPlanCount.value = info.planCandidateCount;
        canAppendPlan.value = info.canAppendPlan;
      })
      .catch(() => {
        /* 使用本地缓存等级 */
      });
  }
});

onLoad(async (query) => {
  const fromPrompt = query?.prompt;
  if (typeof fromPrompt === 'string' && fromPrompt.trim()) {
    inputText.value = decodeURIComponent(fromPrompt.trim());
  }
  const rawSessionId = query?.sessionId;
  if (typeof rawSessionId === 'string' && rawSessionId.trim()) {
    const id = Number(rawSessionId);
    if (!Number.isNaN(id) && authStorage.getStoredUser()) {
      try {
        await loadSession(id);
      } catch {
        /* 忽略无效会话 */
      }
    }
  }
});

async function submitNewPlanSession(text: string) {
  return createPlanSession({
    prompt: text,
    provider: provider.value,
  });
}

async function submitPlanFollowUp(sessionIdValue: number, text: string) {
  return appendPlanMessage(sessionIdValue, { content: text });
}

async function handleSend(text: string) {
  if (aiPlanLoadingState.active) return;
  const loggedInUser = ensureLoggedInUser();
  if (!loggedInUser) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  const content = text.trim();
  if (!content) {
    uni.showToast({ title: t('plan.inputRequired'), icon: 'none' });
    return;
  }
  if (sessionId.value && !canAppendPlan.value) {
    uni.showToast({ title: t('plan.appendLockedHint'), icon: 'none' });
    return;
  }

  const pendingId = `pending-${Date.now()}`;
  messages.value.push({ id: pendingId, role: 'user', content });
  resetComposerInput();
  scrollToBottom();

  try {
    if (!sessionId.value) {
      const planActionResult = await submitNewPlanSession(content);
      sessionId.value = planActionResult.sessionId;
      currentRouteId.value = planActionResult.id;
      intentSnapshot.value = planActionResult.intentSnapshot ?? null;
      ragMatchedCount.value = planActionResult.ragMatchedCount ?? 0;
      candidates.value = planActionResult.candidates ?? [];
      if (planActionResult.memberPlanCandidateCount != null) {
        memberPlanCount.value = planActionResult.memberPlanCandidateCount;
      }
      handleGenerationResult(planActionResult);
      const loadedSession = await fetchPlanSession(planActionResult.sessionId);
      messages.value = mapMessages(loadedSession.messages);
      scrollToBottom();
      uni.showToast({ title: t('plan.plansGenerated'), icon: 'success' });
      return;
    }

    const planActionResult = await submitPlanFollowUp(sessionId.value, content);
    currentRouteId.value = planActionResult.id;
    intentSnapshot.value = planActionResult.intentSnapshot ?? null;
    ragMatchedCount.value = planActionResult.ragMatchedCount ?? 0;
    handleGenerationResult(planActionResult);
    const loadedSession = await fetchPlanSession(sessionId.value);
    messages.value = mapMessages(loadedSession.messages);
    candidates.value = loadedSession.candidates ?? planActionResult.candidates ?? [];
    scrollToBottom();
    uni.showToast({ title: t('plan.planUpdated'), icon: 'success' });
  } catch (e) {
    messages.value = messages.value.filter((m) => m.id !== pendingId);
    if (!isAiPlanCancelledError(e)) {
      const msg = e instanceof Error ? e.message : t('plan.sendFailed');
      uni.showToast({ title: msg, icon: 'none' });
    }
    inputText.value = content;
  }
}
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  --composer-row-height: 80rpx;
  --composer-line-height: var(--composer-row-height);
  --composer-max-height: calc(var(--composer-line-height) * 4);
  --composer-padding-y: 32rpx;
  --composer-shell-height: calc(var(--composer-row-height) + 32rpx);
  --composer-tab-gap: 24rpx;
  --candidate-dock-height: 0rpx;
  --tab-bar-offset: calc(100rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding-top: 32rpx;
  padding-left: var(--page-gutter);
  padding-right: var(--page-gutter);
  padding-bottom: calc(
    var(--tab-bar-offset) + var(--composer-tab-gap) + var(--composer-shell-height) +
      var(--candidate-dock-height) + 28rpx
  );
  background: #f5f7fa;
  box-sizing: border-box;
}
.page-top {
  flex-shrink: 0;
}
.header {
  margin-bottom: 0;
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex-shrink: 0;
}
.header-route-link {
  font-size: 26rpx;
  color: #1677ff;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.new-session {
  font-size: 26rpx;
  color: #1677ff;
}
.desc {
  color: #6b7280;
  font-size: 26rpx;
  margin-top: 12rpx;
  display: block;
}
.intent-bar {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 14rpx 18rpx;
  margin-top: 16rpx;
  border-left: 6rpx solid #1677ff;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.membership-bar {
  margin-top: 12rpx;
  padding: 10rpx 16rpx;
  background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
  border-radius: 8rpx;
}
.membership-label {
  font-size: 22rpx;
  color: #b45309;
}
.append-locked-bar {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  background: #fef2f2;
  border-radius: 8rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
}
.append-locked-text {
  font-size: 22rpx;
  color: #b91c1c;
  flex: 1;
  min-width: 0;
}
.append-locked-link {
  font-size: 22rpx;
  color: #1677ff;
  flex-shrink: 0;
}
.llm-status {
  margin-top: 16rpx;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  line-height: 1.5;
}
.llm-status.pending {
  background: #f3f4f6;
  color: #6b7280;
}
.llm-status.ok {
  background: #ecfdf5;
  color: #059669;
}
.llm-status.warn {
  background: #fff7ed;
  color: #d97706;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  margin-top: 24rpx;
}
.label {
  font-size: 26rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 16rpx;
}
.provider-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #fff;
  margin-bottom: 16rpx;
}
.provider-picker.disabled {
  opacity: 0.6;
  background: #f9fafb;
}
.provider-picker-text {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
}
.provider-picker-arrow {
  font-size: 22rpx;
  color: #9ca3af;
  margin-left: 16rpx;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.chip {
  background: #e8f3ff;
  color: #1677ff;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.intent-label {
  font-size: 22rpx;
  color: #6b7280;
}
.intent-value {
  font-size: 26rpx;
  color: #1f2937;
  font-weight: 500;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  margin-top: 16rpx;
  box-sizing: border-box;
}
.chat-scroll-inner {
  padding-top: 24rpx;
  padding-bottom: 32rpx;
}
.bottom-dock {
  position: fixed;
  left: var(--page-gutter);
  right: var(--page-gutter);
  bottom: calc(var(--tab-bar-offset) + var(--composer-tab-gap));
  z-index: 9998;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-sizing: border-box;
}
.candidate-scroll {
  width: 100%;
  box-sizing: border-box;
}
.candidate-scroll--fit {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  white-space: normal;
}
.candidate-scroll--fit .candidate-card {
  flex: 1;
  width: 0;
  min-width: 0;
  margin-right: 0;
}
.candidate-scroll--scroll {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
}
.candidate-scroll--scroll .candidate-card {
  display: inline-flex;
  flex-shrink: 0;
  width: 280rpx;
  margin-right: 16rpx;
}
.candidate-card {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  border: 2rpx solid #e5e7eb;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.candidate-card.active {
  border-color: #1677ff;
  background: #f0f7ff;
}
.candidate-label {
  font-size: 22rpx;
  color: #1677ff;
  margin-bottom: 8rpx;
}
.candidate-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8rpx;
  white-space: normal;
}
.candidate-meta {
  font-size: 22rpx;
  color: #6b7280;
}
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 24rpx;
  width: 100%;
  box-sizing: border-box;
}
.msg-avatar-slot {
  width: 72rpx;
  flex-shrink: 0;
}
.msg-content {
  flex: 1;
  min-width: 0;
  display: flex;
}
.msg-content.user {
  justify-content: flex-end;
}
.msg-content.assistant {
  justify-content: flex-start;
}
.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.msg-avatar-img {
  width: 100%;
  height: 100%;
}
.msg-avatar-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1;
}
.assistant-avatar {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
}
.assistant-icon {
  color: #fff;
  font-size: 36rpx;
}
.bubble {
  max-width: 100%;
  box-sizing: border-box;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  word-break: break-word;
}
.msg-content.user .bubble {
  background: #1677ff;
  color: #fff;
  border-bottom-right-radius: 4rpx;
}
.msg-content.assistant .bubble {
  background: #fff;
  color: #1f2937;
  border-bottom-left-radius: 4rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}
</style>
