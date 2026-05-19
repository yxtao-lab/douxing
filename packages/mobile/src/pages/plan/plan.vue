<template>
  <view class="page">
    <view class="header">
      <text class="title">AI 智能规划</text>
      <text class="desc">一句话描述需求，由本地 LM Studio 大模型生成专属路线</text>
      <view class="llm-status" :class="llmStatusClass">
        <text>{{ llmStatusText }}</text>
      </view>
    </view>
    <view class="card">
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
      <button class="btn-primary" :loading="loading" @click="handleGenerate">生成路线</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { generateRoute, fetchLlmStatus } from '@/api/routes';
import { getStoredUser } from '@/utils/request';

const prompt = ref('');
const loading = ref(false);
const llmAvailable = ref<boolean | null>(null);
const llmModel = ref('');

const llmStatusText = computed(() => {
  if (llmAvailable.value === null) return '正在检测 AI 服务…';
  if (llmAvailable.value) return `AI 已就绪${llmModel.value ? `（${llmModel.value}）` : ''}`;
  return 'AI 未连接，将使用模板生成（请启动 LM Studio）';
});

const llmStatusClass = computed(() => {
  if (llmAvailable.value === null) return 'pending';
  return llmAvailable.value ? 'ok' : 'warn';
});

onMounted(async () => {
  try {
    const status = await fetchLlmStatus();
    llmAvailable.value = status.enabled && status.available;
    llmModel.value = status.model ?? '';
  } catch {
    llmAvailable.value = false;
  }
});

const quickPrompts = [
  '杭州3天亲子游，预算5000',
  '上海周末情侣游',
  '成都美食两日游',
];

async function handleGenerate() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  if (!prompt.value.trim()) {
    uni.showToast({ title: '请输入旅行需求', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const route = await generateRoute({ prompt: prompt.value.trim() });
    const tip =
      route.generationSource === 'llm' ? 'AI 生成成功' : '已生成（模板模式）';
    uni.showToast({ title: tip, icon: 'success' });
    uni.navigateTo({ url: `/pages/routes/detail?id=${route.id}` });
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '生成失败', icon: 'none' });
  } finally {
    loading.value = false;
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
  font-size: 24rpx;
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
