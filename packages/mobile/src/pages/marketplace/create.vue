<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <view class="form-card">
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldTitle') }}</text>
          <input v-model="title" class="input" :placeholder="t('marketplaceUi.titlePlaceholder')" />
        </view>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldCategory') }}</text>
          <picker :range="categoryLabels" :value="categoryIndex" @change="onCategoryChange">
            <view class="picker">
              <text class="picker-text">{{ categoryLabels[categoryIndex] || t('marketplaceUi.pickCategory') }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldDestination') }}</text>
          <input v-model="destination" class="input" :placeholder="t('marketplaceUi.destinationPlaceholder')" />
        </view>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldDescription') }}</text>
          <textarea v-model="description" class="textarea" :placeholder="t('marketplaceUi.descPlaceholder')" />
        </view>
        <view class="field row">
          <view class="half">
            <text class="label">{{ t('marketplaceUi.fieldBudgetMin') }}</text>
            <input v-model="budgetMin" class="input" type="digit" />
          </view>
          <view class="half">
            <text class="label">{{ t('marketplaceUi.fieldBudgetMax') }}</text>
            <input v-model="budgetMax" class="input" type="digit" />
          </view>
        </view>
      </view>

      <button class="submit-btn" :loading="submitting" @click="handleSubmit">{{ t('marketplace.publish') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { SERVICE_CATEGORY_TREE } from '@douxing/shared';
import { createMarketplaceDemand, publishMarketplaceDemand } from '@/api/marketplace';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';

import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.createTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();
const title = ref('');
const destination = ref('');
const description = ref('');
const budgetMin = ref('');
const budgetMax = ref('');
const categoryIndex = ref(0);
const submitting = ref(false);

const leafCategories = SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []);
const categoryLabels = computed(() => leafCategories.map((c) => t(c.labelKey)));

/**
 * 类目选择变更。
 *
 * @param e - picker 事件
 */
function onCategoryChange(e: { detail: { value: string } }) {
  categoryIndex.value = Number(e.detail.value);
}

/**
 * 提交草稿并发布需求。
 */
async function handleSubmit() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  const category = leafCategories[categoryIndex.value];
  if (!title.value.trim() || !category) {
    uni.showToast({ title: t('marketplaceUi.formInvalid'), icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const draft = await createMarketplaceDemand({
      categoryCode: category.code,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      destination: destination.value.trim() || undefined,
      budgetMin: budgetMin.value || undefined,
      budgetMax: budgetMax.value || undefined,
      budgetType: budgetMin.value || budgetMax.value ? 'range' : undefined,
    });
    await publishMarketplaceDemand(draft.id);
    uni.showToast({ title: t('common.success'), icon: 'success' });
    uni.redirectTo({ url: `/pages/marketplace/detail?id=${draft.id}` });
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-page-bg);
}
.page-body {
  padding: 32rpx;
}
.form-card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.field {
  margin-bottom: 24rpx;
}
.field:last-child {
  margin-bottom: 0;
}
.row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}
.half {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.input,
.picker,
.textarea {
  background: var(--dx-bg);
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: var(--dx-text);
}
.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-text {
  flex: 1;
  color: var(--dx-text);
}
.picker-arrow {
  margin-left: 12rpx;
  font-size: 32rpx;
  color: var(--dx-text-muted);
  line-height: 1;
}
.textarea {
  min-height: 160rpx;
  width: 100%;
  box-sizing: border-box;
}
.submit-btn {
  margin-top: 32rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-lg);
  border: none;
  box-shadow: var(--dx-shadow-md);
  font-size: 30rpx;
  font-weight: 600;
}
.submit-btn::after {
  border: none;
}
</style>
