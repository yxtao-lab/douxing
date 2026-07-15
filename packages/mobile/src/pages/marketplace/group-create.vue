<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <view class="form-card">
        <text class="hint">{{ t('marketplaceUi.groupCreateDesc') }}</text>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldGroupName') }}</text>
          <input v-model="name" class="input" :placeholder="t('marketplaceUi.groupNamePlaceholder')" />
        </view>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldGroupType') }}</text>
          <picker :range="groupTypeLabels" :value="groupTypeIndex" @change="onGroupTypeChange">
            <view class="picker">
              <text class="picker-text">{{ groupTypeLabels[groupTypeIndex] || t('marketplaceUi.pickGroupType') }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldHeadcount') }}</text>
          <input
            v-model="headcount"
            class="input"
            type="number"
            :placeholder="t('marketplaceUi.headcountPlaceholder')"
          />
        </view>
      </view>
      <button class="submit-btn" :loading="submitting" @click="handleSubmit">
        {{ t('marketplaceUi.groupCreateSubmit') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { DemandGroupType, DEMAND_GROUP_TYPES } from '@douxing/shared';
import { createMarketplaceGroup } from '@/api/marketplace-groups';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.groupCreateTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();
const name = ref('');
const headcount = ref('');
const groupTypeIndex = ref(0);
const submitting = ref(false);

const groupTypeLabels = computed(() =>
  DEMAND_GROUP_TYPES.map((type) => t(`marketplace.groupType.${type}`)),
);

/**
 * 团体类型选择变更。
 *
 * @param e - picker 事件
 */
function onGroupTypeChange(e: { detail: { value: string } }) {
  groupTypeIndex.value = Number(e.detail.value);
}

/**
 * 提交创建团体。
 */
async function handleSubmit() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  const groupType = DEMAND_GROUP_TYPES[groupTypeIndex.value] ?? DemandGroupType.OTHER;
  if (!name.value.trim()) {
    uni.showToast({ title: t('marketplaceUi.groupFormInvalid'), icon: 'none' });
    return;
  }
  const hc = headcount.value.trim() ? Number(headcount.value) : undefined;
  if (hc != null && (!Number.isInteger(hc) || hc < 1)) {
    uni.showToast({ title: t('marketplaceUi.groupFormInvalid'), icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const group = await createMarketplaceGroup({
      name: name.value.trim(),
      groupType,
      headcount: hc,
    });
    uni.showToast({ title: t('common.success'), icon: 'success' });
    uni.redirectTo({ url: `/pages/marketplace/group-detail?id=${group.id}` });
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
.hint {
  display: block;
  margin-bottom: 24rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  line-height: 1.5;
}
.field {
  margin-bottom: 28rpx;
}
.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
  font-size: 28rpx;
  color: var(--dx-text);
}
.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80rpx;
  padding: 0 24rpx;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
}
.picker-text {
  font-size: 28rpx;
  color: var(--dx-text);
}
.picker-arrow {
  font-size: 32rpx;
  color: var(--dx-text-muted);
}
.submit-btn {
  margin-top: 40rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-md);
}
.submit-btn::after {
  border: none;
}
</style>
