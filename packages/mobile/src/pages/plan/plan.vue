<template>
  <view class="page tab-page">
    <view class="header">
      <text class="title">AI 智能规划</text>
      <text class="desc">支持 DeepSeek 云端或本地 LM Studio，也可自动选择</text>
      <view class="llm-status" :class="llmStatusClass">
        <text>{{ llmStatusText }}</text>
      </view>
    </view>
    <view class="card">
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
      <textarea
        v-model="prompt"
        class="input"
        placeholder="例如：帮我规划一个3天2夜的杭州亲子游，预算5000"
        :maxlength="200"
      />
      <view class="chips">
        <text
          v-for="item in quickPrompts"
          :key="item"
          class="chip"
          @click="prompt = item"
        >{{ item }}</text>
      </view>
      <button class="btn-primary" :loading="aiPlanning" :disabled="aiPlanning" @click="handleGenerate">
        生成路线
      </button>
    </view>
    <DouxingTabBar :current="1" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { generateRoute, fetchLlmStatus, fetchLlmProviders } from '@/api/routes';
import { getStoredUser } from '@/utils/request';
import { aiPlanLoadingState, AI_PLAN_CANCELLED_MESSAGE } from '@/utils/ai-plan-loading';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import type { LlmProviderChoice, LlmProviderOption } from '@douxing/shared';
import { LlmProvider } from '@douxing/shared';

const prompt = ref('');
const aiPlanning = computed(() => aiPlanLoadingState.active);
const provider = ref<LlmProviderChoice>(LlmProvider.AUTO);
const providerOptions = ref<LlmProviderOption[]>([]);
const llmAvailable = ref<boolean | null>(null);
const statusDetail = ref('');

const llmStatusText = computed(() => {
  if (llmAvailable.value === null) return '正在检测 AI 服务…';
  if (llmAvailable.value) return statusDetail.value || 'AI 已就绪';
  return '当前模型不可用，将尝试其他源或模板生成';
});

const llmStatusClass = computed(() => {
  if (llmAvailable.value === null) return 'pending';
  return llmAvailable.value ? 'ok' : 'warn';
});

function selectProvider(opt: LlmProviderOption) {
  if (aiPlanLoadingState.active) return;
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
});

onLoad((query) => {
  const fromPrompt = query?.prompt;
  if (typeof fromPrompt === 'string' && fromPrompt.trim()) {
    prompt.value = decodeURIComponent(fromPrompt.trim());
  }
});

const quickPrompts = [
  '杭州3天亲子游，预算5000',
  '上海周末情侣游',
  '成都美食两日游',
];

async function handleGenerate() {
  if (aiPlanLoadingState.active) return;
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  if (!prompt.value.trim()) {
    uni.showToast({ title: '请输入旅行需求', icon: 'none' });
    return;
  }
  try {
    const route = await generateRoute({
      prompt: prompt.value.trim(),
      provider: provider.value,
    });
    let tip = '已生成（模板模式）';
    if (route.generationSource === 'llm') {
      tip =
        route.llmProvider === 'deepseek'
          ? 'DeepSeek 生成成功'
          : route.llmProvider === 'lmstudio'
            ? '本地模型生成成功'
            : 'AI 生成成功';
    }
    uni.showToast({ title: tip, icon: 'success' });
    uni.navigateTo({ url: `/pages/routes/detail?id=${route.id}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '生成失败';
    if (msg !== AI_PLAN_CANCELLED_MESSAGE) {
      uni.showToast({ title: msg, icon: 'none' });
    }
  }
}
</script>

<style scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  background: #f5f7fa;
}
.header {
  margin-bottom: 32rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  display: block;
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
  padding: 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
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
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.provider-item {
  padding: 20rpx 24rpx;
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
.input {
  width: 100%;
  min-height: 200rpx;
  font-size: 28rpx;
  line-height: 1.6;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin: 24rpx 0;
}
.chip {
  background: #e8f3ff;
  color: #1677ff;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.btn-primary {
  background: #1677ff;
  color: #fff;
  border-radius: 12rpx;
}
</style>
