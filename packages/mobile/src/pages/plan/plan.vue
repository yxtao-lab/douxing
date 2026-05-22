<template>
  <view class="page tab-page">
    <view class="header">
      <view class="header-top">
        <text class="title">AI 智能规划</text>
        <text v-if="sessionId" class="new-session" @click="resetSession">新建</text>
      </view>
      <text class="desc">多轮对话：生成后可追问调整，如「第三天改成西湖」</text>
      <view class="llm-status" :class="llmStatusClass">
        <text>{{ llmStatusText }}</text>
      </view>
    </view>

    <view v-if="!sessionId" class="card setup-card">
      <text class="label">选择模型</text>
      <view class="provider-row">
        <view
          v-for="opt in providerOptions"
          :key="opt.id"
          class="provider-item"
          :class="{ active: provider === opt.id, disabled: !opt.available }"
          @click="selectProvider(opt)"
        >
          <text class="provider-name">{{ opt.label }}</text>
        </view>
      </view>
      <view class="chips">
        <text
          v-for="item in quickPrompts"
          :key="item"
          class="chip"
          @click="inputText = item"
        >{{ item }}</text>
      </view>
    </view>

    <view v-if="intentSummary" class="intent-bar">
      <text class="intent-label">已理解需求</text>
      <text class="intent-value">{{ intentSummary }}{{ intentBarExtra }}</text>
    </view>

    <scroll-view
      v-if="messages.length > 0"
      class="chat-scroll"
      scroll-y
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
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
    </scroll-view>

    <view v-if="currentRouteId" class="route-bar">
      <text class="route-tip">当前方案已更新</text>
      <text class="route-link" @click="openRouteDetail">查看路线详情</text>
    </view>

    <view class="composer">
      <textarea
        v-model="inputText"
        class="composer-input"
        :placeholder="composerPlaceholder"
        :maxlength="500"
        :disabled="aiPlanning"
        auto-height
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
} from '@/api/plan-sessions';
import { getStoredUser } from '@/utils/request';
import { aiPlanLoadingState, AI_PLAN_CANCELLED_MESSAGE } from '@/utils/ai-plan-loading';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import type {
  LlmProviderChoice,
  LlmProviderOption,
  PlanSessionMessageInfo,
  TravelIntentSnapshot,
  UserInfo,
} from '@douxing/shared';
import { LlmProvider } from '@douxing/shared';

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
}

const inputText = ref('');
const user = ref<UserInfo | null>(getStoredUser());
const sessionId = ref<number | null>(null);
const currentRouteId = ref<number | null>(null);
const intentSnapshot = ref<TravelIntentSnapshot | null>(null);
const messages = ref<ChatMessage[]>([]);
const scrollIntoView = ref('');
const aiPlanning = computed(() => aiPlanLoadingState.active);
const provider = ref<LlmProviderChoice>(LlmProvider.AUTO);
const providerOptions = ref<LlmProviderOption[]>([]);
const llmAvailable = ref<boolean | null>(null);
const statusDetail = ref('');

const userAvatarText = computed(() =>
  (user.value?.nickname || user.value?.username || '我').slice(0, 1),
);

const composerPlaceholder = computed(() =>
  sessionId.value ? '继续追问或提出修改，如：预算降到3000' : '描述旅行需求，如：杭州3天亲子游，预算5000',
);

const llmStatusText = computed(() => {
  if (llmAvailable.value === null) return '正在检测 AI 服务…';
  if (llmAvailable.value) return statusDetail.value || 'AI 已就绪';
  return '当前模型不可用，将尝试其他源或模板生成';
});

const llmStatusClass = computed(() => {
  if (llmAvailable.value === null) return 'pending';
  return llmAvailable.value ? 'ok' : 'warn';
});

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

function selectProvider(opt: LlmProviderOption) {
  if (aiPlanLoadingState.active || sessionId.value) return;
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
    statusDetail.value = '自动：优先 DeepSeek，其次本地';
    return;
  }
  const opt = providerOptions.value.find((o) => o.id === p);
  llmAvailable.value = opt?.available ?? false;
  statusDetail.value = opt?.available ? opt.label : `${opt?.label ?? p} 未就绪`;
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

function resetSession() {
  if (aiPlanLoadingState.active) return;
  sessionId.value = null;
  currentRouteId.value = null;
  intentSnapshot.value = null;
  ragMatchedCount.value = 0;
  messages.value = [];
  inputText.value = '';
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
  ragMatchedCount.value =
    typeof (session.route?.routeDetail as Record<string, unknown> | undefined)?.ragMatchedCount ===
    'number'
      ? ((session.route?.routeDetail as Record<string, unknown>).ragMatchedCount as number)
      : 0;
  messages.value = mapMessages(session.messages);
  scrollToBottom();
}

onMounted(async () => {
  try {
    const [{ options }, status] = await Promise.all([fetchLlmProviders(), fetchLlmStatus()]);
    providerOptions.value = options;
    if (status.defaultProvider === 'deepseek') {
      provider.value = LlmProvider.DEEPSEEK;
    }
    const lines: string[] = [];
    for (const p of status.providers ?? []) {
      const mark = p.available ? '✓' : '✗';
      lines.push(`${mark} ${p.label}${p.model ? ` (${p.model})` : ''}`);
    }
    statusDetail.value = lines.join(' · ') || statusDetail.value;
    llmAvailable.value = status.enabled && status.available;
    refreshStatusForProvider();
  } catch {
    llmAvailable.value = false;
  }
});

onShow(() => {
  uni.hideTabBar({ animation: false });
  user.value = getStoredUser();
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
  inputText.value = '';
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
    const session = await fetchPlanSession(sessionId.value);
    messages.value = mapMessages(session.messages);
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 32rpx 32rpx 120rpx;
  background: #f5f7fa;
  box-sizing: border-box;
}
.header {
  margin-bottom: 24rpx;
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
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
  margin-bottom: 24rpx;
}
.label {
  font-size: 26rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 16rpx;
}
.provider-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.provider-item {
  padding: 16rpx 20rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #fafafa;
}
.provider-item.active {
  border-color: #1677ff;
  background: #e8f3ff;
}
.provider-item.disabled {
  opacity: 0.5;
}
.provider-name {
  font-size: 26rpx;
  color: #1f2937;
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
.intent-bar {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
  border-left: 6rpx solid #1677ff;
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
  max-height: 52vh;
  margin-bottom: 16rpx;
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
.route-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}
.route-tip {
  font-size: 24rpx;
  color: #6b7280;
}
.route-link {
  font-size: 26rpx;
  color: #1677ff;
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}
.composer-input {
  flex: 1;
  min-height: 72rpx;
  max-height: 200rpx;
  font-size: 28rpx;
  line-height: 1.5;
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
