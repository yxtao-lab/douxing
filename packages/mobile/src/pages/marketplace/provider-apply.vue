<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <view v-if="loading" class="loading-wrap">
        <DouxingEmptyState loading embedded compact />
      </view>

      <view v-else-if="provider && !canApply" class="status-card">
        <text class="status-title">{{ t('marketplaceUi.statusCardTitle') }}</text>
        <text class="status-row">{{ t('marketplaceUi.fieldProviderType') }}：{{ providerTypeLabel(provider.providerType) }}</text>
        <text class="status-row">{{ t('marketplaceUi.fieldStatus') }}：{{ certStatusLabel(provider.certStatus) }}</text>
        <text v-if="provider.displayName" class="status-row">{{ t('marketplaceUi.fieldDisplayName') }}：{{ provider.displayName }}</text>
        <text v-if="provider.reviewNote" class="status-row">{{ t('marketplaceUi.reviewNote') }}：{{ provider.reviewNote }}</text>
        <text class="status-row">{{ t('marketplaceUi.appliedAt') }}：{{ formatDate(provider.createdAt) }}</text>
      </view>

      <template v-else>
        <view v-if="provider?.certStatus === 'rejected'" class="hint-banner">
          {{ t('marketplaceUi.reapplyHint') }}
        </view>

        <view class="form-card">
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldProviderType') }}</text>
            <picker :range="providerTypeLabels" :value="providerTypeIndex" @change="onProviderTypeChange">
              <view class="picker">
                <text class="picker-text">{{ providerTypeLabels[providerTypeIndex] || t('marketplaceUi.pickProviderType') }}</text>
                <text class="picker-arrow">›</text>
              </view>
            </picker>
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldCategories') }}</text>
            <view class="chip-row">
              <view
                v-for="cat in leafCategories"
                :key="cat.code"
                class="chip"
                :class="{ active: selectedCategories.includes(cat.code) }"
                @click="toggleCategory(cat.code)"
              >
                {{ t(cat.labelKey) }}
              </view>
            </view>
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldServiceRegions') }}</text>
            <input v-model="serviceRegions" class="input" :placeholder="t('marketplaceUi.regionsPlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldDisplayName') }}</text>
            <input v-model="displayName" class="input" :placeholder="t('marketplaceUi.displayNamePlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldBio') }}</text>
            <textarea v-model="bio" class="textarea" :placeholder="t('marketplaceUi.bioPlaceholder')" />
          </view>
        </view>

        <button class="submit-btn" :loading="submitting" @click="handleSubmit">{{ t('marketplaceUi.providerApplySubmit') }}</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  CertStatus,
  ProviderType,
  SERVICE_CATEGORY_TREE,
  formatDisplayDateTime,
  type ServiceProviderSummary,
} from '@douxing/shared';
import { applyMarketplaceProvider, fetchMyServiceProvider } from '@/api/marketplace-onboard';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.providerApplyTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();

const loading = ref(true);
const submitting = ref(false);
const provider = ref<ServiceProviderSummary | null>(null);

const providerTypeIndex = ref(0);
const selectedCategories = ref<string[]>([]);
const serviceRegions = ref('');
const displayName = ref('');
const bio = ref('');

const providerTypeOptions = [
  ProviderType.GUIDE,
  ProviderType.PHOTOGRAPHER,
  ProviderType.MODEL,
  ProviderType.RETOUCHER,
  ProviderType.LEADER,
];

const leafCategories = SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []);
const providerTypeLabels = computed(() => providerTypeOptions.map((type) => providerTypeLabel(type)));

/** 是否允许提交（未申请或已驳回） */
const canApply = computed(() => {
  if (!provider.value) return true;
  return provider.value.certStatus === CertStatus.REJECTED;
});

/**
 * 解析服务者类型展示名。
 *
 * @param type - 服务者类型枚举值
 * @returns 本地化标签
 */
function providerTypeLabel(type: string) {
  const map: Record<string, string> = {
    [ProviderType.GUIDE]: t('marketplace.providerTypeGuide'),
    [ProviderType.PHOTOGRAPHER]: t('marketplace.providerTypePhotographer'),
    [ProviderType.MODEL]: t('marketplace.providerTypeModel'),
    [ProviderType.RETOUCHER]: t('marketplace.providerTypeRetoucher'),
    [ProviderType.LEADER]: t('marketplace.providerTypeLeader'),
  };
  return map[type] ?? type;
}

/**
 * 解析认证状态展示名。
 *
 * @param status - 认证状态枚举值
 * @returns 本地化标签
 */
function certStatusLabel(status: string) {
  const map: Record<string, string> = {
    [CertStatus.PENDING]: t('marketplace.certStatusPending'),
    [CertStatus.APPROVED]: t('marketplace.certStatusApproved'),
    [CertStatus.REJECTED]: t('marketplace.certStatusRejected'),
  };
  return map[status] ?? status;
}

/**
 * 格式化申请时间为统一展示格式。
 *
 * @param iso - ISO 时间字符串
 * @returns yy-mm-dd HH:mm:ss
 */
function formatDate(iso: string) {
  return formatDisplayDateTime(iso) || iso;
}

/**
 * 服务者类型 picker 变更。
 *
 * @param e - picker 事件
 */
function onProviderTypeChange(e: { detail: { value: string } }) {
  providerTypeIndex.value = Number(e.detail.value);
}

/**
 * 切换服务类目选中状态。
 *
 * @param code - 类目 code
 */
function toggleCategory(code: string) {
  const idx = selectedCategories.value.indexOf(code);
  if (idx >= 0) {
    selectedCategories.value.splice(idx, 1);
  } else {
    selectedCategories.value.push(code);
  }
}

/**
 * 将逗号分隔区域字符串解析为数组。
 *
 * @param raw - 用户输入
 * @returns 非空区域列表；无有效项时为 undefined
 */
function parseRegions(raw: string): string[] | undefined {
  const items = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * 加载当前用户服务者认证记录。
 */
async function load() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  loading.value = true;
  try {
    provider.value = await fetchMyServiceProvider();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('common.loadFailed')), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

/**
 * 提交个人服务者认证申请。
 */
async function handleSubmit() {
  const providerType = providerTypeOptions[providerTypeIndex.value];
  if (!providerType || selectedCategories.value.length === 0) {
    uni.showToast({ title: t('marketplaceUi.providerApplyInvalid'), icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await applyMarketplaceProvider({
      providerType,
      categoryCodes: [...selectedCategories.value],
      serviceRegions: parseRegions(serviceRegions.value),
      displayName: displayName.value.trim() || undefined,
      bio: bio.value.trim() || undefined,
    });
    uni.showToast({ title: t('marketplaceUi.providerApplySuccess'), icon: 'success' });
    await load();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('common.failed')), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

onShow(load);
</script>

<style scoped>
.page { min-height: 100vh; background: var(--dx-page-bg); }
.page-body { padding: 32rpx; }
.loading-wrap { padding: 48rpx 0; }
.status-card { background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 28rpx; box-shadow: var(--dx-shadow-sm); }
.status-title { display: block; font-size: 30rpx; font-weight: 600; margin-bottom: 16rpx; color: var(--dx-text); }
.status-row { display: block; margin-top: 8rpx; font-size: 26rpx; color: var(--dx-text-secondary); }
.hint-banner { margin-bottom: 20rpx; padding: 20rpx 24rpx; border-radius: var(--dx-radius-sm); background: var(--dx-warning-bg, #fff7e6); color: var(--dx-warning-text, #ad6800); font-size: 24rpx; }
.form-card { background: var(--dx-surface); border-radius: var(--dx-radius-md); padding: 28rpx; box-shadow: var(--dx-shadow-sm); }
.field { margin-bottom: 24rpx; }
.label { display: block; margin-bottom: 12rpx; font-size: 26rpx; color: var(--dx-text-secondary); }
.input, .picker, .textarea { background: var(--dx-bg); border: 2rpx solid var(--dx-border); border-radius: var(--dx-radius-sm); padding: 20rpx 24rpx; font-size: 28rpx; color: var(--dx-text); width: 100%; box-sizing: border-box; }
.picker { display: flex; align-items: center; justify-content: space-between; }
.picker-arrow { font-size: 32rpx; color: var(--dx-text-muted); }
.textarea { min-height: 160rpx; }
.chip-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.chip { padding: 10rpx 20rpx; border-radius: 999rpx; font-size: 24rpx; background: var(--dx-bg); border: 2rpx solid var(--dx-border); color: var(--dx-text-secondary); }
.chip.active { background: var(--dx-primary-light); border-color: var(--dx-primary); color: var(--dx-primary); }
.submit-btn { margin-top: 32rpx; background: var(--dx-primary); color: var(--dx-text-inverse); border-radius: var(--dx-radius-lg); border: none; font-size: 30rpx; font-weight: 600; }
.submit-btn::after { border: none; }
</style>
