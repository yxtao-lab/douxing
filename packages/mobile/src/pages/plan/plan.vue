<template>
  <view class="page tab-page" :style="pageStyle">
    <view class="page-top">
      <view class="header">
      <view class="header-top">
        <text class="title">AI 智能规划</text>
        <view v-if="sessionId || currentRouteId || previousSessionId" class="header-actions">
          <text
            v-if="previousSessionId && !sessionId"
            class="header-route-link"
            @click="restorePreviousSession"
          >返回对话</text>
          <text v-if="currentRouteId && sessionId" class="header-route-link" @click="openRouteDetail">路线详情</text>
          <text v-if="sessionId" class="new-session" @click="startNewSession">新建</text>
        </view>
      </view>
      <text class="desc">首条需求按会员等级生成多套方案；选定后可多轮追问调整</text>
      <view v-if="intentSummary" class="intent-bar">
        <text class="intent-label">已理解需求</text>
        <text class="intent-value">{{ intentSummary }}{{ intentBarExtra }}</text>
      </view>
      <view v-if="membershipHint" class="membership-bar">
        <text class="membership-label">{{ membershipHint }}</text>
      </view>
      <view v-if="showLlmStatus" class="llm-status warn">
        <text>{{ llmIssueMessage }}</text>
      </view>
      </view>

      <view v-if="!sessionId" class="card setup-card">
        <text class="label">选择模型</text>
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
          <text class="candidate-label">{{ item.label }}</text>
          <text class="candidate-name">{{ item.route?.name || '路线方案' }}</text>
          <text class="candidate-meta">
            {{ item.route?.days ?? '—' }}天
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
          <text class="candidate-label">{{ item.label }}</text>
          <text class="candidate-name">{{ item.route?.name || '路线方案' }}</text>
          <text class="candidate-meta">
            {{ item.route?.days ?? '—' }}天
            <text v-if="item.route?.budgetRange"> · {{ item.route.budgetRange }}</text>
          </text>
        </view>
      </scroll-view>

      <view class="composer">
        <textarea
          :key="composerKey"
          v-model="inputText"
          class="composer-input"
          :placeholder="composerPlaceholder"
          :maxlength="500"
          :disabled="aiPlanning"
          auto-height
          :show-confirm-bar="false"
          confirm-type="send"
          @confirm="handleSend"
        />
        <button
          class="btn-send"
          :loading="aiPlanning"
          :disabled="aiPlanning || !inputText.trim()"
          @click="handleSend"
        >
          发送
        </button>
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
  selectPlanCandidate,
} from '@/api/plan-sessions';
import { getStoredUser } from '@/utils/request';
import { fetchMembershipInfo } from '@/api/user';
import { aiPlanLoadingState, AI_PLAN_CANCELLED_MESSAGE } from '@/utils/ai-plan-loading';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import type {
  LlmProviderChoice,
  LlmProviderOption,
  PlanSessionMessageInfo,
  TravelIntentSnapshot,
  UserInfo,
  PlanRouteCandidate,
} from '@douxing/shared';
import { LlmProvider, getMemberLevelLabel, getPlanCandidateCountByMemberLevel } from '@douxing/shared';

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
}

const inputText = ref('');
const composerKey = ref(0);
const user = ref<UserInfo | null>(getStoredUser());
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
const memberLevelLabel = ref(getMemberLevelLabel(0));

const membershipHint = computed(() => {
  if (!getStoredUser()) return '';
  return `${memberLevelLabel.value} · 首条可生成 ${memberPlanCount.value} 套方案`;
});

const showLlmStatus = computed(() => llmIssueMessage.value.length > 0);

const pageStyle = computed(() => ({
  '--candidate-dock-height': candidates.value.length > 1 ? '152rpx' : '0rpx',
}));

const userAvatarText = computed(() =>
  (user.value?.nickname || user.value?.username || '我').slice(0, 1),
);

const composerPlaceholder = computed(() =>
  sessionId.value ? '继续追问或提出修改，如：预算降到3000' : '描述旅行需求，如：杭州3天亲子游，预算5000',
);

function reportLlmIssue(message: string) {
  llmIssueMessage.value = message;
}

function clearLlmIssue() {
  llmIssueMessage.value = '';
}

function handleGenerationResult(result: { generationSource?: 'llm' | 'template' }) {
  if (result.generationSource === 'template') {
    reportLlmIssue('AI 模型调用异常，已改用模板方案生成');
  } else {
    clearLlmIssue();
  }
}

const intentSummary = computed(() => {
  const intent = intentSnapshot.value;
  if (!intent) return '';
  const parts: string[] = [];
  if (intent.city) parts.push(intent.city);
  if (intent.days != null) parts.push(`${intent.days}天`);
  if (intent.budget) parts.push(`预算${intent.budget}`);
  if (intent.themes.length > 0) parts.push(intent.themes.join('·'));
  return parts.join(' · ');
});

const ragMatchedCount = ref(0);

const intentBarExtra = computed(() => {
  if (ragMatchedCount.value <= 0) return '';
  return ` · 库内景点 ${ragMatchedCount.value} 处`;
});

const providerPickerLabels = computed(() =>
  providerOptions.value.map((opt) =>
    opt.available ? opt.label : `${opt.label}（未配置）`,
  ),
);

const providerPickerIndex = computed(() => {
  const idx = providerOptions.value.findIndex((o) => o.id === provider.value);
  return idx >= 0 ? idx : 0;
});

const currentProviderLabel = computed(() => {
  const opt = providerOptions.value.find((o) => o.id === provider.value);
  if (!opt) return '请选择模型';
  return opt.available ? opt.label : `${opt.label}（未配置）`;
});

function onProviderPickerChange(e: { detail: { value: string | number } }) {
  if (aiPlanLoadingState.active || sessionId.value) return;
  const index = Number(e.detail.value);
  const opt = providerOptions.value[index];
  if (!opt) return;
  if (!opt.available) {
    uni.showToast({ title: '该模型未配置', icon: 'none' });
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
      reportLlmIssue('当前无可用 AI 模型，将使用模板生成');
    } else {
      clearLlmIssue();
    }
    return;
  }
  const opt = providerOptions.value.find((o) => o.id === p);
  llmAvailable.value = opt?.available ?? false;
  if (!llmAvailable.value) {
    reportLlmIssue(`${opt?.label ?? p} 未就绪，将尝试其他源或模板生成`);
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
  inputText.value = '';
  composerKey.value += 1;
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
      title: e instanceof Error ? e.message : '恢复对话失败',
      icon: 'none',
    });
  }
}

function openRouteDetail() {
  if (!currentRouteId.value) return;
  uni.navigateTo({ url: `/pages/routes/detail?id=${currentRouteId.value}` });
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
    uni.showToast({ title: '已切换方案', icon: 'success' });
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : '切换失败',
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
      reportLlmIssue('AI 服务已在服务端禁用，将使用模板生成');
    } else if (!status.available) {
      reportLlmIssue('当前无可用 AI 模型，将使用模板生成');
    } else {
      refreshStatusForProvider();
    }
  } catch {
    llmAvailable.value = false;
    reportLlmIssue('AI 服务检测失败，将使用模板生成');
  }
});

onShow(() => {
  uni.hideTabBar({ animation: false });
  user.value = getStoredUser();
  if (user.value) {
    memberPlanCount.value = getPlanCandidateCountByMemberLevel(user.value.memberLevel);
    memberLevelLabel.value = getMemberLevelLabel(user.value.memberLevel);
    fetchMembershipInfo()
      .then((info) => {
        memberPlanCount.value = info.planCandidateCount;
        memberLevelLabel.value = info.label;
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
    if (!Number.isNaN(id) && getStoredUser()) {
      try {
        await loadSession(id);
      } catch {
        /* 忽略无效会话 */
      }
    }
  }
});

const quickPrompts = [
  '杭州3天亲子游，预算5000',
  '上海周末情侣游',
  '成都美食两日游',
];

async function handleSend() {
  if (aiPlanLoadingState.active) return;
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  const text = inputText.value.trim();
  if (!text) {
    uni.showToast({ title: '请输入内容', icon: 'none' });
    return;
  }

  const pendingId = `pending-${Date.now()}`;
  messages.value.push({ id: pendingId, role: 'user', content: text });
  resetComposerInput();
  scrollToBottom();

  try {
    if (!sessionId.value) {
      const result = await createPlanSession({
        prompt: text,
        provider: provider.value,
      });
      sessionId.value = result.sessionId;
      currentRouteId.value = result.id;
      intentSnapshot.value = result.intentSnapshot ?? null;
      ragMatchedCount.value = result.ragMatchedCount ?? 0;
      candidates.value = result.candidates ?? [];
      if (result.memberPlanCandidateCount != null) {
        memberPlanCount.value = result.memberPlanCandidateCount;
      }
      if (result.memberLevelLabel) {
        memberLevelLabel.value = result.memberLevelLabel;
      }
      handleGenerationResult(result);
      const session = await fetchPlanSession(result.sessionId);
      messages.value = mapMessages(session.messages);
      scrollToBottom();
      uni.showToast({ title: '方案已生成', icon: 'success' });
      return;
    }

    const result = await appendPlanMessage(sessionId.value, { content: text });
    currentRouteId.value = result.id;
    intentSnapshot.value = result.intentSnapshot ?? null;
    ragMatchedCount.value = result.ragMatchedCount ?? 0;
    handleGenerationResult(result);
    const session = await fetchPlanSession(sessionId.value);
    messages.value = mapMessages(session.messages);
    candidates.value = session.candidates ?? result.candidates ?? [];
    scrollToBottom();
    uni.showToast({ title: '方案已更新', icon: 'success' });
  } catch (e) {
    messages.value = messages.value.filter((m) => m.id !== pendingId);
    const msg = e instanceof Error ? e.message : '发送失败';
    if (msg !== AI_PLAN_CANCELLED_MESSAGE) {
      uni.showToast({ title: msg, icon: 'none' });
    }
    inputText.value = text;
  }
}
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  --composer-line-height: 42rpx;
  --composer-max-height: calc(var(--composer-line-height) * 4);
  --composer-padding-y: 32rpx;
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
    var(--tab-bar-offset) + var(--composer-tab-gap) + var(--composer-line-height) +
      var(--composer-padding-y) + var(--candidate-dock-height) + 28rpx
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
.composer {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}
.composer-input {
  flex: 1;
  width: 100%;
  min-height: var(--composer-line-height);
  max-height: var(--composer-max-height);
  height: var(--composer-line-height);
  font-size: 28rpx;
  line-height: 1.5;
  overflow-y: auto;
  box-sizing: border-box;
}
.btn-send {
  flex-shrink: 0;
  min-width: 120rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin: 0;
}
</style>
