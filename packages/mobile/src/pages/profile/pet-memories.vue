<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🧠</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ copy.title }}</text>
            <text class="hero-desc">{{ copy.analyzePrePlan }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="toolbar">
        <button class="btn-analyze" :disabled="analyzing" @click="runAnalyze">
          {{ analyzing ? copy.analyzing : copy.analyzePrePlan }}
        </button>
      </view>

      <view v-if="analyzeCard" class="analyze-card">
        <view class="analyze-head">
          <text class="analyze-scene">{{ analyzeCard.sceneLabel }}</text>
          <text v-if="analyzeCard.cached" class="analyze-cached">{{ copy.cachedHint }}</text>
        </view>
        <text class="analyze-label">{{ copy.insightTitle }}</text>
        <text class="analyze-text">{{ analyzeCard.insight }}</text>
        <text class="analyze-label">{{ copy.petReplyTitle }}</text>
        <text class="analyze-reply">{{ analyzeCard.petReply }}</text>

        <view v-if="analyzeCard.memoriesToSave.length" class="suggested-block">
          <text class="analyze-label">{{ copy.suggestedMemories }}</text>
          <view
            v-for="(item, index) in analyzeCard.memoriesToSave"
            :key="`${item.content}-${index}`"
            class="suggested-item"
            @click="item.selected = !item.selected"
          >
            <text class="suggested-check">{{ item.selected ? '☑' : '☐' }}</text>
            <text class="suggested-content">{{ item.content }}</text>
          </view>
          <button class="btn-save" @click="saveSelectedMemories">{{ copy.confirmSave }}</button>
        </view>
      </view>

      <DouxingEmptyState
        v-if="!loading && items.length === 0"
        variant="generic"
        :title="copy.empty"
        :action-label="copy.analyzePrePlan"
        @action="runAnalyze"
      />

      <view v-for="item in items" :key="item.id" class="memory-card">
        <view class="memory-head">
          <text class="memory-type">{{ item.typeLabel }}</text>
          <text v-if="item.pinned" class="memory-pin">📌</text>
        </view>
        <text class="memory-content">{{ item.content }}</text>
        <view class="memory-foot">
          <text class="memory-date">{{ item.dateLabel }}</text>
          <view class="memory-actions">
            <text class="action-link" @click="togglePin(item)">
              {{ item.pinned ? copy.unpinLabel : copy.pinLabel }}
            </text>
            <text class="action-link danger" @click="confirmDelete(item)">{{ copy.deleteLabel }}</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="list-footer">{{ t('common.loadMore') }}</view>
      <view v-else-if="!hasMore && items.length > 0" class="list-footer muted">{{ t('common.noMore') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import {
  buildPetAnalyzeCardViewModel,
  buildPetMemoryWallListItemViewModel,
  resolvePetMemoryWallPageCopy,
  type PetAnalyzeCardViewModel,
  type PetMemoryWallItem,
  type PetMemoryWallListItemViewModel,
} from '@douxing/shared';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import {
  analyzeTravelPet,
  confirmPetMemories,
  deletePetMemory,
  fetchPetMemoriesPage,
  patchPetMemoryPin,
} from '@/api/pets';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { useInfiniteList } from '@/composables/useInfiniteList';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';

const { t } = useTf();
const { themeClass } = useTheme();
usePageTitle('nav.petMemories');

const locale = computed(() => getApiAcceptLanguage());
const copy = computed(() => resolvePetMemoryWallPageCopy(locale.value));

const analyzing = ref(false);
const analyzeCard = ref<PetAnalyzeCardViewModel | null>(null);

const {
  items: rawItems,
  loading,
  loadingMore,
  hasMore,
  loadInitial,
  loadMore,
} = useInfiniteList<PetMemoryWallItem>(async (page, pageSize) => fetchPetMemoriesPage(page, pageSize));

const items = computed(() =>
  rawItems.value.map((item) => buildPetMemoryWallListItemViewModel(item, locale.value)),
);

async function runAnalyze() {
  analyzing.value = true;
  try {
    const result = await analyzeTravelPet({ scene: 'pre_plan' });
    analyzeCard.value = buildPetAnalyzeCardViewModel(result, locale.value);
  } catch {
    uni.showToast({ title: t('common.operationFailed'), icon: 'none' });
  } finally {
    analyzing.value = false;
  }
}

async function saveSelectedMemories() {
  if (!analyzeCard.value) return;
  const selected = analyzeCard.value.memoriesToSave.filter((m) => m.selected);
  if (!selected.length) return;
  try {
    await confirmPetMemories({
      items: selected.map(({ memoryType, content, importance, metadata }) => ({
        memoryType,
        content,
        importance,
        metadata,
      })),
    });
    uni.showToast({ title: copy.value.confirmSave, icon: 'success' });
    analyzeCard.value = null;
    await loadInitial();
  } catch {
    uni.showToast({ title: t('common.operationFailed'), icon: 'none' });
  }
}

async function togglePin(item: PetMemoryWallListItemViewModel) {
  try {
    await patchPetMemoryPin(item.id, !item.pinned);
    await loadInitial();
  } catch {
    uni.showToast({ title: t('common.operationFailed'), icon: 'none' });
  }
}

function confirmDelete(item: PetMemoryWallListItemViewModel) {
  uni.showModal({
    title: copy.value.deleteConfirm,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await deletePetMemory(item.id);
        await loadInitial();
      } catch {
        uni.showToast({ title: t('common.operationFailed'), icon: 'none' });
      }
    },
  });
}

onShow(() => {
  void loadInitial();
});

onLoad((query) => {
  if (query?.analyze === '1') {
    void runAnalyze();
  }
});

onReachBottom(() => {
  void loadMore();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-page-bg, #f5f7fa);
}

.page-hero {
  position: relative;
  padding: 32rpx 32rpx 24rpx;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  border-radius: 0 0 32rpx 32rpx;
}

.hero-content {
  position: relative;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.logo-mark {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-emoji {
  font-size: 44rpx;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #92400e;
}

.hero-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #b45309;
}

.page-body {
  padding: 0 24rpx 48rpx;
}

.toolbar {
  margin-bottom: 20rpx;
}

.btn-analyze {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #f59e0b, #ea580c);
  color: #fff;
  font-size: 28rpx;
  border: none;
}

.analyze-card {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #fffbeb;
  border: 1rpx solid rgba(251, 191, 36, 0.35);
}

.analyze-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.analyze-scene {
  font-size: 24rpx;
  font-weight: 600;
  color: #92400e;
}

.analyze-cached {
  font-size: 20rpx;
  color: #a8a29e;
}

.analyze-label {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #78350f;
}

.analyze-text,
.analyze-reply {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #44403c;
}

.analyze-reply {
  color: #92400e;
}

.suggested-block {
  margin-top: 16rpx;
}

.suggested-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 10rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.8);
}

.suggested-check {
  font-size: 28rpx;
}

.suggested-content {
  flex: 1;
  font-size: 24rpx;
  color: #292524;
}

.btn-save {
  margin-top: 16rpx;
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 1rpx solid #f59e0b;
  color: #b45309;
  font-size: 26rpx;
}

.memory-card {
  margin-bottom: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.memory-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.memory-type {
  font-size: 22rpx;
  font-weight: 600;
  color: #b45309;
}

.memory-pin {
  font-size: 24rpx;
}

.memory-content {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: #292524;
}

.memory-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.memory-date {
  font-size: 22rpx;
  color: #a8a29e;
}

.memory-actions {
  display: flex;
  gap: 20rpx;
}

.action-link {
  font-size: 22rpx;
  color: #d97706;
}

.action-link.danger {
  color: #dc2626;
}

.list-footer {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.list-footer.muted {
  color: #9ca3af;
}
</style>
