<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <view class="form-card">
        <view class="field">
          <text class="label">{{ t('marketplaceUi.fieldPublisherGroup') }}</text>
          <picker :range="publisherLabels" :value="publisherIndex" @change="onPublisherChange">
            <view class="picker">
              <text class="picker-text">{{ publisherLabels[publisherIndex] }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
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
import { onLoad } from '@dcloudio/uni-app';
import { SERVICE_CATEGORY_TREE, type GroupMembershipSummary } from '@douxing/shared';
import { createMarketplaceDemand, publishMarketplaceDemand } from '@/api/marketplace';
import { fetchMyMarketplaceGroups } from '@/api/marketplace-groups';
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
const publisherIndex = ref(0);
const submitting = ref(false);
const memberships = ref<GroupMembershipSummary[]>([]);
const presetGroupId = ref<number | null>(null);

const leafCategories = SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []);
const categoryLabels = computed(() => leafCategories.map((c) => t(c.labelKey)));
const publisherLabels = computed(() => [
  t('marketplaceUi.pickGroup'),
  ...memberships.value.map((m) => m.group.name),
]);

/**
 * 类目选择变更。
 *
 * @param e - picker 事件
 */
function onCategoryChange(e: { detail: { value: string } }) {
  categoryIndex.value = Number(e.detail.value);
}

/**
 * 发单主体选择变更。
 *
 * @param e - picker 事件
 */
function onPublisherChange(e: { detail: { value: string } }) {
  publisherIndex.value = Number(e.detail.value);
}

/**
 * 加载我的团体并应用 query 预选。
 */
async function loadGroups() {
  try {
    memberships.value = await fetchMyMarketplaceGroups();
    if (presetGroupId.value != null) {
      const idx = memberships.value.findIndex((m) => m.groupId === presetGroupId.value);
      if (idx >= 0) publisherIndex.value = idx + 1;
    }
  } catch {
    memberships.value = [];
  }
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
  const publisherGroupId =
    publisherIndex.value > 0 ? memberships.value[publisherIndex.value - 1]?.groupId : undefined;
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
      publisherGroupId,
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

onLoad((query) => {
  const gid = Number(query?.groupId || 0);
  if (Number.isInteger(gid) && gid > 0) presetGroupId.value = gid;
  void loadGroups();
});
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
  margin-bottom: 28rpx;
}
.field.row {
  display: flex;
  gap: 20rpx;
}
.half {
  flex: 1;
}
.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.input,
.textarea {
  width: 100%;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
  font-size: 28rpx;
  color: var(--dx-text);
}
.input {
  height: 80rpx;
}
.textarea {
  min-height: 160rpx;
  padding: 20rpx 24rpx;
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
