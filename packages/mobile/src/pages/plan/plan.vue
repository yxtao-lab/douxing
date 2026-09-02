<template>
  <view class="page tab-page" :class="themeClass" :style="pageStyle">
    <view class="page-top">
      <view
        class="plan-hero"
        :class="{ 'plan-hero--compact': sessionId || messages.length > 0 }"
      >
        <view class="hero-bg" />
        <view class="hero-content">
          <view class="header-top">
            <view class="header-brand">
              <view class="logo-mark">
                <text class="iconfont icon-plan hero-icon" aria-hidden="true" />
              </view>
              <text class="title">{{ t('plan.title') }}</text>
            </view>
            <view v-if="showHeaderActions" class="header-actions">
              <view
                v-if="showMoreActions"
                class="header-more-btn"
                :aria-label="t('plan.moreActions')"
                @click.stop="toggleMoreMenu"
              >
                <image class="header-more-icon" src="/static/iconfont/svg/more.svg" mode="aspectFit" />
              </view>
            </view>
          </view>
          <text v-if="!sessionId && messages.length === 0" class="desc">{{ t('plan.desc') }}</text>
        </view>
      </view>
      <view v-if="intentSummary" class="intent-bar" :class="{ 'intent-bar--compact': !!sessionId }">
        <text class="intent-label">{{ t('plan.intentLabel') }}</text>
        <text class="intent-value">{{ intentSummary }}{{ intentBarExtra }}</text>
      </view>
      <view
        v-if="membershipHint"
        class="session-status-bar"
        :class="{ 'session-status-bar--compact': !!sessionId }"
      >
        <text class="session-status-text">{{ membershipHint }}</text>
        <text class="session-status-link" @click="goMembership">{{ t('nav.membership') }}</text>
      </view>
      <view v-if="showLlmStatus" class="llm-status warn">
        <text>{{ llmIssueMessage }}</text>
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
        <view class="prompt-group">
          <text class="prompt-group-label">{{ t('plan.quickPromptsTitle') }}</text>
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
            <view v-if="msg.role === 'assistant'" class="msg-avatar assistant-avatar assistant-avatar--pet">
              <text class="assistant-pet-emoji">{{ assistantPetEmoji }}</text>
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

        <view
          v-if="currentRouteId && sessionId"
          class="route-detail-row"
        >
          <view class="msg-avatar-slot" />
          <view
            id="route-detail-cta"
            class="route-detail-cta"
            role="button"
            @click="openRouteDetail"
          >
            <view class="route-detail-cta-main">
              <text class="route-detail-cta-title">{{ t('plan.routeDetail') }}</text>
              <text v-if="currentRoutePreview?.name" class="route-detail-cta-name">
                {{ currentRoutePreview.name }}
              </text>
              <text class="route-detail-cta-meta">{{ currentRoutePreviewMeta }}</text>
              <text class="route-detail-cta-hint">{{ t('plan.routeDetailCtaHint') }}</text>
            </view>
            <text class="route-detail-cta-arrow" aria-hidden="true">›</text>
          </view>
          <view class="msg-avatar-slot" />
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

    <view
      v-if="moreMenuOpen"
      class="plan-menu-mask"
      @click="closeMoreMenu"
      @touchmove.stop.prevent
    >
      <view class="plan-more-menu" :style="moreMenuStyle" @click.stop>
        <view
          v-if="canResumeLastSession"
          class="plan-more-item"
          @click="onMoreAction('resume')"
        >
          <image class="plan-more-item-icon" src="/static/iconfont/svg/chat-resume.svg" mode="aspectFit" />
          <text class="plan-more-item-label">{{ t('plan.resumeLastSession') }}</text>
        </view>
        <view
          v-if="canStartNewSession"
          class="plan-more-item"
          @click="onMoreAction('new')"
        >
          <image class="plan-more-item-icon" src="/static/iconfont/svg/plus.svg" mode="aspectFit" />
          <text class="plan-more-item-label">{{ t('plan.newSession') }}</text>
        </view>
        <view
          v-if="canClearChat"
          class="plan-more-item"
          @click="onMoreAction('clear')"
        >
          <image class="plan-more-item-icon" src="/static/iconfont/svg/clear.svg" mode="aspectFit" />
          <text class="plan-more-item-label">{{ t('plan.clearChat') }}</text>
        </view>
        <view
          v-if="recentPrompts.length"
          class="plan-more-item"
          @click="onMoreAction('recent')"
        >
          <image class="plan-more-item-icon" src="/static/iconfont/svg/history.svg" mode="aspectFit" />
          <text class="plan-more-item-label">{{ t('plan.recentPromptsTitle') }}</text>
        </view>
      </view>
    </view>

    <view
      v-if="recentSheetOpen"
      class="plan-recent-mask"
      @click="closeRecentSheet"
      @touchmove.stop.prevent
    >
      <view class="plan-recent-sheet" @click.stop>
        <view class="plan-recent-sheet-head">
          <text class="plan-recent-sheet-title">{{ t('plan.recentPromptsTitle') }}</text>
          <text class="plan-recent-sheet-close" @click="closeRecentSheet">×</text>
        </view>
        <view v-if="recentPrompts.length" class="plan-recent-sheet-list">
          <text
            v-for="item in recentPrompts"
            :key="`sheet-${item}`"
            class="chip chip-recent plan-recent-sheet-chip"
            @click="applyRecentPrompt(item)"
          >{{ recentPromptLabel(item) }}</text>
        </view>
        <text v-else class="plan-recent-sheet-empty">{{ t('plan.recentPromptsEmpty') }}</text>
      </view>
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
  fetchPlanSessions,
  selectPlanCandidate,
} from '@/api/plan-sessions';
import * as authStorage from '@/utils/auth-storage';
import { ensureLoggedInUser } from '@/utils/ensure-logged-in';
import { fetchMembershipInfo } from '@/api/user';
import { fetchTravelPetFloatingContext } from '@/api/pets';
import { aiPlanLoadingState, isAiPlanCancelledError } from '@/utils/ai-plan-loading';
import { getAppErrorMessage } from '@/utils/request';
import { hideNativeTabBar } from '@/utils/hide-native-tab-bar';
import { trackAnalytics } from '@/utils/analytics';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import VoiceTextComposer from '@/components/voice-text-composer/VoiceTextComposer.vue';
import type {
  LlmProviderChoice,
  LlmProviderOption,
  PlanPetMeta,
  PlanSessionAgentState,
  PlanSessionMessageInfo,
  TravelIntentSnapshot,
  UserInfo,
  PlanRouteCandidate,
  TravelRouteInfo,
} from '@douxing/shared';
import {
  AnalyticsEventName,
  LlmProvider,
  formatPlanIntentSummary,
  formatPlanVariantLabel,
  getMemberLevelI18nKey,
  getPlanCandidateCountByMemberLevel,
  canAppendPlanByMemberLevel,
  formatPlanRecentPromptLabel,
  resolveTravelPetSpeciesEmoji,
  stripPlanIntentHintFromAssistantReply,
} from '@douxing/shared';
import { loadPlanRecentPrompts, savePlanRecentPrompt } from '@/utils/plan-recent-prompts';
import {
  clearPlanLastSessionId,
  loadPlanLastSessionId,
  savePlanLastSessionId,
} from '@/utils/plan-last-session';
import { consumePlanLaunchIntent, hasPlanLaunchIntent } from '@/utils/plan-launch-intent';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
}

const { t, tf } = useTf();
const { themeClass } = useTheme();
const { currentLocale } = useInterestTagLabel();
usePageTitle('nav.plan');

const inputText = ref('');
const composerRef = ref<InstanceType<typeof VoiceTextComposer> | null>(null);
const user = ref<UserInfo | null>(authStorage.getStoredUser());
const sessionId = ref<number | null>(null);
/** 本地持久化的上次会话，用于进入页面自动恢复 / 菜单继续对话 */
const lastSessionId = ref<number | null>(null);
const currentRouteId = ref<number | null>(null);
const currentRoutePreview = ref<Pick<TravelRouteInfo, 'name' | 'days' | 'budgetRange'> | null>(
  null,
);
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
const recentPrompts = ref<string[]>([]);
const moreMenuOpen = ref(false);
const recentSheetOpen = ref(false);
/** 场景定制入口传入的 sceneTags，仅用于下一次新建规划会话 */
const pendingSceneTags = ref<string[] | null>(null);
/** 更多操作菜单相对视口的定位（由按钮实测得到） */
const moreMenuStyle = ref<Record<string, string>>({
  top: '0px',
  right: '16px',
});
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

function refreshRecentPrompts() {
  recentPrompts.value = loadPlanRecentPrompts(user.value?.id);
}

/**
 * 从本地存储刷新「上次会话」ID。
 *
 * @returns void
 */
function refreshLastSessionId() {
  lastSessionId.value = loadPlanLastSessionId(user.value?.id);
}

/**
 * 将指定会话记为上次对话并写入本地存储。
 *
 * @param id - 规划会话 ID
 * @returns void
 */
function rememberLastSession(id: number) {
  lastSessionId.value = id;
  savePlanLastSessionId(id, user.value?.id);
}

/**
 * 清除本地「上次会话」记录（会话失效或不存在时）。
 *
 * @returns void
 */
function forgetLastSession() {
  lastSessionId.value = null;
  clearPlanLastSessionId(user.value?.id);
}

function recordRecentPrompt(content: string) {
  recentPrompts.value = savePlanRecentPrompt(content, user.value?.id);
}

function recentPromptLabel(prompt: string): string {
  return formatPlanRecentPromptLabel(prompt);
}

const canStartNewSession = computed(() => Boolean(sessionId.value));
const canClearChat = computed(
  () => Boolean(sessionId.value) || messages.value.length > 0,
);
const canResumeLastSession = computed(
  () =>
    Boolean(lastSessionId.value)
    && (!sessionId.value || sessionId.value !== lastSessionId.value),
);
const showMoreActions = computed(
  () =>
    canStartNewSession.value
    || canClearChat.value
    || canResumeLastSession.value
    || recentPrompts.value.length > 0,
);
const showHeaderActions = computed(
  () =>
    Boolean(sessionId.value || currentRouteId.value)
    || showMoreActions.value,
);

/**
 * 根据「更多」按钮的实际位置，更新下拉菜单贴靠坐标。
 *
 * @returns 定位完成后 resolve 的 Promise
 */
function updateMoreMenuPosition(): Promise<void> {
  return new Promise((resolve) => {
    void nextTick(() => {
      uni
        .createSelectorQuery()
        .select('.header-more-btn')
        .boundingClientRect()
        .exec((results) => {
          const box = results?.[0];
          if (box && !Array.isArray(box) && typeof box.bottom === 'number') {
            let windowWidth = 0;
            try {
              windowWidth = uni.getSystemInfoSync().windowWidth || 0;
            } catch {
              windowWidth = 0;
            }
            const gapPx = typeof uni.upx2px === 'function' ? uni.upx2px(8) : 4;
            const rightPx = Math.max(8, windowWidth - (box.right || 0));
            moreMenuStyle.value = {
              top: `${box.bottom + gapPx}px`,
              right: `${rightPx}px`,
            };
          }
          resolve();
        });
    });
  });
}

/**
 * 切换顶部「更多操作」下拉菜单的开关状态。
 *
 * @returns void
 */
async function toggleMoreMenu() {
  if (aiPlanLoadingState.active) return;
  if (moreMenuOpen.value) {
    moreMenuOpen.value = false;
    return;
  }
  recentSheetOpen.value = false;
  await updateMoreMenuPosition();
  moreMenuOpen.value = true;
}

/**
 * 关闭顶部更多操作菜单。
 *
 * @returns void
 */
function closeMoreMenu() {
  moreMenuOpen.value = false;
}

/**
 * 关闭最近发送底部面板。
 *
 * @returns void
 */
function closeRecentSheet() {
  recentSheetOpen.value = false;
}

/**
 * 处理更多操作菜单项点击。
 *
 * @param action - `resume` 继续上次；`new` 新建；`clear` 清空；`recent` 最近发送
 * @returns void
 */
function onMoreAction(action: 'resume' | 'new' | 'clear' | 'recent') {
  closeMoreMenu();
  if (action === 'resume') {
    void resumeLastSession();
    return;
  }
  if (action === 'new') {
    startNewSession();
    return;
  }
  if (action === 'clear') {
    confirmClearChat();
    return;
  }
  recentSheetOpen.value = true;
}

/**
 * 确认后清空当前规划对话视图；本地仍保留上次会话 ID 以便继续。
 *
 * @returns void
 */
function confirmClearChat() {
  if (aiPlanLoadingState.active) return;
  uni.showModal({
    title: t('plan.clearChatConfirmTitle'),
    content: t('plan.clearChatConfirmContent'),
    success: (res) => {
      if (!res.confirm) return;
      clearSessionView();
    },
  });
}

/**
 * 将最近发送内容填入输入框，并关闭最近发送面板。
 *
 * @param text - 最近发送原文
 * @returns void
 */
function applyRecentPrompt(text: string) {
  inputText.value = text;
  closeRecentSheet();
}

function formatRouteDays(days: number | undefined | null): string {
  if (days == null) return '—';
  return `${days}${t('plan.daysUnit')}`;
}

function syncCurrentRoutePreview(
  routeId: number | null,
  route?: TravelRouteInfo | null,
) {
  if (!routeId) {
    currentRoutePreview.value = null;
    return;
  }
  if (route && route.id === routeId) {
    currentRoutePreview.value = {
      name: route.name,
      days: route.days,
      budgetRange: route.budgetRange,
    };
    return;
  }
  const hit = candidates.value.find((c) => c.routeId === routeId);
  if (hit?.route) {
    currentRoutePreview.value = {
      name: hit.route.name,
      days: hit.route.days,
      budgetRange: hit.route.budgetRange,
    };
    return;
  }
  currentRoutePreview.value = null;
}

const currentRoutePreviewMeta = computed(() => {
  const preview = currentRoutePreview.value;
  if (!preview) return '';
  const parts: string[] = [];
  if (preview.days != null) {
    parts.push(formatRouteDays(preview.days));
  }
  if (preview.budgetRange) {
    parts.push(preview.budgetRange);
  }
  return parts.join(' · ');
});

function resolveProviderLabel(opt: LlmProviderOption): string {
  if (opt.id === LlmProvider.AUTO) return t('plan.providerAuto');
  if (opt.id === LlmProvider.LMSTUDIO) return t('plan.providerLmstudio');
  if (opt.id === LlmProvider.DOUXING) {
    const modelMatch = opt.label.match(/[（(]([^）)]+)[）)]/);
    const model = modelMatch?.[1] ?? opt.label;
    return tf('plan.providerDouxing', { model });
  }
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
const petMeta = ref<PlanPetMeta | null>(null);
/** 会话未返回 petMeta 时，从旅行伙伴接口补全物种 emoji */
const fallbackPetSpecies = ref('fox');

/**
 * 助手消息头像：优先会话 petMeta，否则用用户旅行伙伴物种。
 *
 * @returns 宠物 emoji 字符串
 */
const assistantPetEmoji = computed(() =>
  resolveTravelPetSpeciesEmoji(petMeta.value?.species ?? fallbackPetSpecies.value),
);

function syncPetMeta(
  source?: { petMeta?: PlanPetMeta | null; agentState?: PlanSessionAgentState | null } | null,
) {
  petMeta.value = source?.petMeta ?? source?.agentState?.petMeta ?? null;
}

/**
 * 预拉用户旅行伙伴物种，供聊天助手头像与会话前展示。
 *
 * @returns void
 */
async function ensurePetAvatarSpecies() {
  if (petMeta.value?.species) return;
  if (!authStorage.getStoredUser()) return;
  try {
    const ctx = await fetchTravelPetFloatingContext();
    fallbackPetSpecies.value = ctx.pet.species;
    if (!petMeta.value && ctx.petMeta) {
      petMeta.value = ctx.petMeta;
    }
  } catch {
    /* 未登录或无宠物时保持默认 fox */
  }
}

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

/**
 * 将会话消息映射为聊天气泡；助手消息去掉与顶部意图条重复的「已理解需求」段。
 *
 * @param list - 会话消息列表
 * @returns 前端聊天消息
 */
function mapMessages(list: PlanSessionMessageInfo[]): ChatMessage[] {
  return list.map((item) => ({
    id: item.id,
    role: item.role,
    content:
      item.role === 'assistant'
        ? stripPlanIntentHintFromAssistantReply(item.content)
        : item.content,
  }));
}

function scrollToBottom() {
  scrollIntoView.value = '';
  nextTick(() => {
    if (currentRouteId.value && sessionId.value) {
      scrollIntoView.value = 'route-detail-cta';
      return;
    }
    const last = messages.value[messages.value.length - 1];
    if (!last) return;
    scrollIntoView.value = `msg-${last.id}`;
  });
}

function resetComposerInput() {
  composerRef.value?.clear();
}

/**
 * 清空当前规划页会话视图（消息、候选方案、意图等），不发起网络请求。
 *
 * @returns void
 */
function clearSessionView() {
  sessionId.value = null;
  currentRouteId.value = null;
  currentRoutePreview.value = null;
  intentSnapshot.value = null;
  ragMatchedCount.value = 0;
  candidates.value = [];
  messages.value = [];
  petMeta.value = null;
  resetComposerInput();
  clearLlmIssue();
  refreshStatusForProvider();
}

/**
 * 结束当前会话视图并进入新建规划状态；进行中的规划不可打断。
 * 本地仍保留上次会话 ID，可从菜单「继续上次对话」恢复。
 *
 * @returns void
 */
function startNewSession() {
  if (aiPlanLoadingState.active) return;
  if (sessionId.value) {
    rememberLastSession(sessionId.value);
  }
  clearSessionView();
  closeMoreMenu();
  closeRecentSheet();
}

/**
 * 从本地记录的上次会话 ID 拉取并恢复对话。
 *
 * @returns void
 */
async function resumeLastSession() {
  if (aiPlanLoadingState.active || !lastSessionId.value) return;
  if (sessionId.value && sessionId.value === lastSessionId.value) return;
  try {
    await loadSession(lastSessionId.value);
  } catch (e) {
    forgetLastSession();
    uni.showToast({
      title: getAppErrorMessage(e, t('plan.restoreSessionFailed')),
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

/**
 * 拉取并渲染指定规划会话详情到当前页。
 *
 * @param id - 规划会话 ID
 * @returns void
 * @throws 会话不存在或网络失败时向上抛出，由调用方处理
 */
async function loadSession(id: number) {
  const session = await fetchPlanSession(id);
  sessionId.value = session.id;
  rememberLastSession(session.id);
  intentSnapshot.value = session.intentSnapshot ?? null;
  candidates.value = session.candidates ?? [];
  currentRouteId.value = session.routeId;
  syncCurrentRoutePreview(session.routeId, session.route ?? null);
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
    currentRouteId.value = result.id;
    syncCurrentRoutePreview(result.id, result);
    candidates.value = result.candidates ?? [];
    ragMatchedCount.value = result.ragMatchedCount ?? 0;
    syncPetMeta(result);
    trackAnalytics(AnalyticsEventName.PLAN_ROUTE_SAVED, {
      sessionId: sessionId.value,
      routeId: result.id,
    });
    uni.showToast({ title: t('plan.candidateSwitched'), icon: 'success' });
  } catch (e) {
    uni.showToast({
      title: getAppErrorMessage(e, t('plan.candidateSwitchFailed')),
      icon: 'none',
    });
  }
}

/**
 * 解析应恢复的上次会话 ID：优先本地缓存，否则取服务端最近一条。
 *
 * @returns 可用会话 ID；无则 `null`
 */
async function resolveLastSessionIdToRestore(): Promise<number | null> {
  refreshLastSessionId();
  if (lastSessionId.value) return lastSessionId.value;
  if (!authStorage.getStoredUser()) return null;
  try {
    const list = await fetchPlanSessions(1);
    const latest = list[0];
    if (!latest?.id) return null;
    rememberLastSession(latest.id);
    return latest.id;
  } catch {
    return null;
  }
}

onMounted(async () => {
  refreshRecentPrompts();
  refreshLastSessionId();
  void ensurePetAvatarSpecies();
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
  hideNativeTabBar();
  trackAnalytics(AnalyticsEventName.PLAN_PAGE_VIEW);
  user.value = authStorage.getStoredUser();
  refreshRecentPrompts();
  refreshLastSessionId();
  void ensurePetAvatarSpecies();
  if (user.value) {
    memberPlanCount.value = getPlanCandidateCountByMemberLevel(user.value.memberLevel);
    canAppendPlan.value = canAppendPlanByMemberLevel(user.value.memberLevel);
    fetchMembershipInfo()
      .then((info) => {
        memberPlanCount.value = info.planCandidateCount;
        canAppendPlan.value = info.canAppendPlan;
        // 与会员权益页对齐：展示有效等级（过期后为免费）
        if (user.value) {
          const nextUser = { ...user.value, memberLevel: info.level };
          user.value = nextUser;
          const token = authStorage.getStoredToken();
          if (token) authStorage.setAuth(token, nextUser);
        }
      })
      .catch(() => {
        /* 使用本地缓存等级 */
      });
  }
  void applyPlanLaunchIntent();
});

/**
 * 消费场景专题等写入的规划启动意图：可清会话、预填并自动发送。
 *
 * @returns void
 */
async function applyPlanLaunchIntent() {
  const intent = consumePlanLaunchIntent();
  if (!intent?.prompt) return;
  if (intent.fresh) {
    if (sessionId.value) {
      rememberLastSession(sessionId.value);
    }
    clearSessionView();
  }
  pendingSceneTags.value =
    intent.sceneTags && intent.sceneTags.length > 0 ? [...intent.sceneTags] : null;
  inputText.value = intent.prompt;
  if (!intent.autoSend) return;
  await nextTick();
  await handleSend(intent.prompt);
}

onLoad(async (query) => {
  user.value = authStorage.getStoredUser();
  refreshLastSessionId();
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
    return;
  }
  // 有待消费的场景定制意图时，不恢复上次对话，交给 onShow 处理
  if (hasPlanLaunchIntent()) return;
  // 无显式 sessionId 时：自动恢复上次对话，避免每次进入都是空白新建页
  if (authStorage.getStoredUser()) {
    const id = await resolveLastSessionIdToRestore();
    if (id) {
      try {
        await loadSession(id);
      } catch {
        forgetLastSession();
      }
    }
  }
});

async function submitNewPlanSession(text: string) {
  const sceneTags = pendingSceneTags.value ?? undefined;
  pendingSceneTags.value = null;
  return createPlanSession({
    prompt: text,
    provider: provider.value,
    ...(sceneTags && sceneTags.length > 0 ? { sceneTags } : {}),
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

  trackAnalytics(AnalyticsEventName.PLAN_PROMPT_SUBMIT, {
    hasSession: Boolean(sessionId.value),
  });

  try {
    if (!sessionId.value) {
      const planActionResult = await submitNewPlanSession(content);
      sessionId.value = planActionResult.sessionId;
      rememberLastSession(planActionResult.sessionId);
      trackAnalytics(AnalyticsEventName.PLAN_SESSION_CREATED, {
        sessionId: planActionResult.sessionId,
        routeId: planActionResult.id,
      });
      currentRouteId.value = planActionResult.id;
      syncCurrentRoutePreview(planActionResult.id, planActionResult);
      intentSnapshot.value = planActionResult.intentSnapshot ?? null;
      ragMatchedCount.value = planActionResult.ragMatchedCount ?? 0;
      candidates.value = planActionResult.candidates ?? [];
      if (planActionResult.memberPlanCandidateCount != null) {
        memberPlanCount.value = planActionResult.memberPlanCandidateCount;
      }
      handleGenerationResult(planActionResult);
      syncPetMeta(planActionResult);
      const loadedSession = await fetchPlanSession(planActionResult.sessionId);
      messages.value = mapMessages(loadedSession.messages);
      syncPetMeta(loadedSession);
      candidates.value = loadedSession.candidates ?? planActionResult.candidates ?? [];
      syncCurrentRoutePreview(planActionResult.id, loadedSession.route ?? planActionResult);
      scrollToBottom();
      recordRecentPrompt(content);
      uni.showToast({ title: t('plan.plansGenerated'), icon: 'success' });
      return;
    }

    const planActionResult = await submitPlanFollowUp(sessionId.value, content);
    currentRouteId.value = planActionResult.id;
    syncCurrentRoutePreview(planActionResult.id, planActionResult);
    intentSnapshot.value = planActionResult.intentSnapshot ?? null;
    ragMatchedCount.value = planActionResult.ragMatchedCount ?? 0;
    handleGenerationResult(planActionResult);
    syncPetMeta(planActionResult);
    const loadedSession = await fetchPlanSession(sessionId.value);
    messages.value = mapMessages(loadedSession.messages);
    syncPetMeta(loadedSession);
    candidates.value = loadedSession.candidates ?? planActionResult.candidates ?? [];
    syncCurrentRoutePreview(planActionResult.id, planActionResult);
    scrollToBottom();
    recordRecentPrompt(content);
    uni.showToast({ title: t('plan.planUpdated'), icon: 'success' });
  } catch (e) {
    messages.value = messages.value.filter((m) => m.id !== pendingId);
    if (!isAiPlanCancelledError(e)) {
      const msg = getAppErrorMessage(e, t('plan.sendFailed'));
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
  padding-top: 0;
  padding-left: var(--page-gutter);
  padding-right: var(--page-gutter);
  padding-bottom: calc(
    var(--tab-bar-offset) + var(--composer-tab-gap) + var(--composer-shell-height) +
      var(--candidate-dock-height) + 28rpx
  );
  background: var(--dx-bg);
  box-sizing: border-box;
}
.page-top {
  flex-shrink: 0;
}
.plan-hero {
  position: relative;
  margin: 0 calc(-1 * var(--page-gutter)) 20rpx;
  padding: 24rpx var(--page-gutter) 28rpx;
  overflow: hidden;
  transition: padding 0.25s ease;
}
.plan-hero--compact {
  padding-top: 16rpx;
  padding-bottom: 20rpx;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}
.logo-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: width 0.25s ease, height 0.25s ease;
}
.plan-hero--compact .logo-mark {
  width: 52rpx;
  height: 52rpx;
}
.hero-icon {
  color: var(--dx-text-inverse);
  font-size: 32rpx;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex-shrink: 0;
}
.header-more-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.18);
  border: 2rpx solid rgba(255, 255, 255, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.header-more-icon {
  width: 30rpx;
  height: 30rpx;
}
.plan-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.18);
}
.plan-more-menu {
  position: absolute;
  min-width: 280rpx;
  padding: 8rpx 0;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-md);
  overflow: hidden;
}
.plan-more-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 28rpx;
}
.plan-more-item:active {
  background: var(--dx-primary-light);
}
.plan-more-item-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}
.plan-more-item-label {
  font-size: 28rpx;
  color: var(--dx-text);
  font-weight: 500;
}
.plan-recent-mask {
  position: fixed;
  inset: 0;
  z-index: 10060;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.plan-recent-sheet {
  width: 100%;
  max-height: 60vh;
  padding: 28rpx var(--page-gutter) calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-xl) var(--dx-radius-xl) 0 0;
  box-shadow: var(--dx-shadow-md);
}
.plan-recent-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.plan-recent-sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.plan-recent-sheet-close {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-size: 36rpx;
  color: var(--dx-text-muted);
}
.plan-recent-sheet-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.plan-recent-sheet-chip {
  max-width: 100%;
}
.plan-recent-sheet-empty {
  font-size: 26rpx;
  color: var(--dx-text-muted);
}
.title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  flex: 1;
  min-width: 0;
  line-height: 1.35;
}
.plan-hero--compact .title {
  font-size: 32rpx;
}
.desc {
  color: rgba(255, 255, 255, 0.88);
  font-size: 26rpx;
  margin-top: 12rpx;
  display: block;
  line-height: 1.45;
}
.intent-bar {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-sm);
  padding: 14rpx 18rpx;
  margin-top: 0;
  border-left: 6rpx solid var(--dx-primary);
  box-shadow: var(--dx-shadow-sm);
}
.intent-bar--compact {
  gap: 4rpx;
  padding: 10rpx 14rpx;
}
.session-status-bar {
  margin-top: 8rpx;
  padding: 10rpx 14rpx;
  background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
  border-radius: var(--dx-radius-sm);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12rpx;
}
.session-status-bar--compact {
  margin-top: 6rpx;
  padding: 6rpx 12rpx;
}
.session-status-text {
  flex: 1;
  min-width: 0;
  font-size: 22rpx;
  line-height: 1.35;
  color: #b45309;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-status-link {
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--dx-primary);
  font-weight: 500;
}
.llm-status {
  margin-top: 16rpx;
  padding: 12rpx 20rpx;
  border-radius: var(--dx-radius-sm);
  font-size: 22rpx;
  line-height: 1.5;
}
.llm-status.pending {
  background: #f3f4f6;
  color: var(--dx-text-secondary);
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
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 24rpx;
  box-shadow: var(--dx-shadow-sm);
  margin-top: 20rpx;
}
.label {
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  display: block;
  margin-bottom: 16rpx;
}
.provider-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  background: var(--dx-surface);
  margin-bottom: 16rpx;
}
.provider-picker.disabled {
  opacity: 0.6;
  background: var(--dx-bg);
}
.provider-picker-text {
  flex: 1;
  font-size: 28rpx;
  color: var(--dx-text);
}
.provider-picker-arrow {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  margin-left: 16rpx;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.prompt-group + .prompt-group {
  margin-top: 20rpx;
}
.prompt-group-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
.chip {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.chip-recent {
  background: #fff;
  border: 1rpx solid var(--dx-border);
  color: var(--dx-text);
  max-width: 520rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.intent-label {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}
.intent-value {
  font-size: 26rpx;
  color: var(--dx-text);
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
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  border: 2rpx solid var(--dx-border);
  box-shadow: var(--dx-shadow-sm);
}
.candidate-card.active {
  border-color: var(--dx-primary);
  background: var(--dx-primary-light);
}
.candidate-label {
  font-size: 22rpx;
  color: var(--dx-primary);
  margin-bottom: 8rpx;
}
.candidate-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 8rpx;
  white-space: normal;
}
.candidate-meta {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
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
  background: var(--dx-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.msg-avatar-img {
  width: 100%;
  height: 100%;
}
.msg-avatar-text {
  color: var(--dx-text-inverse);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1;
}
.assistant-avatar--pet {
  background: #fff7ed;
  border: 2rpx solid rgba(251, 191, 36, 0.35);
}
.assistant-pet-emoji {
  font-size: 36rpx;
  line-height: 1;
}
.bubble {
  max-width: 100%;
  box-sizing: border-box;
  padding: 20rpx 24rpx;
  border-radius: var(--dx-radius-md);
  font-size: 28rpx;
  line-height: 1.6;
  word-break: break-word;
}
.msg-content.user .bubble {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-bottom-right-radius: 4rpx;
}
.msg-content.assistant .bubble {
  background: var(--dx-surface);
  color: var(--dx-text);
  border-bottom-left-radius: 4rpx;
  box-shadow: var(--dx-shadow-sm);
}
.route-detail-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-top: 8rpx;
  margin-bottom: 24rpx;
  width: 100%;
  box-sizing: border-box;
}
.route-detail-cta {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, var(--dx-primary-light) 0%, var(--dx-surface) 100%);
  border: 2rpx solid var(--dx-primary);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-md);
  box-sizing: border-box;
}
.route-detail-cta-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.route-detail-cta-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-primary);
}
.route-detail-cta-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  word-break: break-word;
}
.route-detail-cta-meta {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.route-detail-cta-hint {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  margin-top: 4rpx;
}
.route-detail-cta-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  line-height: 1;
  color: var(--dx-primary);
  font-weight: 300;
}
</style>
