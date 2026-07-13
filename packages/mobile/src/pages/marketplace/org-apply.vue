<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <view v-if="loading" class="loading-wrap">
        <DouxingEmptyState loading embedded compact />
      </view>

      <view v-else-if="ownerOrg && !canApply" class="status-card">
        <text class="status-title">{{ t('marketplaceUi.statusCardTitle') }}</text>
        <text class="status-row">{{ t('marketplaceUi.fieldOrgName') }}：{{ ownerOrg.org.name }}</text>
        <text class="status-row">{{ t('marketplaceUi.fieldOrgType') }}：{{ orgTypeLabel(ownerOrg.org.orgType) }}</text>
        <text class="status-row">{{ t('marketplaceUi.fieldStatus') }}：{{ orgStatusLabel(ownerOrg.org.status) }}</text>
        <text v-if="ownerOrg.org.reviewNote" class="status-row">{{ t('marketplaceUi.reviewNote') }}：{{ ownerOrg.org.reviewNote }}</text>
        <text class="status-row">{{ t('marketplaceUi.appliedAt') }}：{{ formatDate(ownerOrg.org.createdAt) }}</text>
      </view>

      <template v-else>
        <view v-if="ownerOrg?.org.status === 'rejected'" class="hint-banner">
          {{ t('marketplaceUi.reapplyHint') }}
        </view>

        <view class="form-card">
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldOrgName') }}</text>
            <input v-model="name" class="input" :placeholder="t('marketplaceUi.orgNamePlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldOrgType') }}</text>
            <picker :range="orgTypeLabels" :value="orgTypeIndex" @change="onOrgTypeChange">
              <view class="picker">
                <text class="picker-text">{{ orgTypeLabels[orgTypeIndex] || t('marketplaceUi.pickOrgType') }}</text>
                <text class="picker-arrow">›</text>
              </view>
            </picker>
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldLicenseNo') }}</text>
            <input v-model="licenseNo" class="input" :placeholder="t('marketplaceUi.licenseNoPlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldContactPhone') }}</text>
            <input v-model="contactPhone" class="input" type="number" :placeholder="t('marketplaceUi.phonePlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldDescription') }}</text>
            <textarea v-model="description" class="textarea" :placeholder="t('marketplaceUi.orgDescPlaceholder')" />
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldLicenseDoc') }}</text>
            <button class="upload-btn" size="mini" :loading="uploadingLicense" @click="pickLicense">
              {{ t('marketplaceUi.uploadDoc') }}
            </button>
            <text v-if="licenseDoc" class="upload-hint">{{ tf('marketplaceUi.docUploaded', { name: licenseDoc.fileName }) }}</text>
            <text class="hint">{{ t('marketplaceUi.uploadDocHint') }}</text>
          </view>
          <view class="field">
            <text class="label">{{ t('marketplaceUi.fieldPortfolioDoc') }}</text>
            <button class="upload-btn" size="mini" :loading="uploadingPortfolio" @click="pickPortfolio">
              {{ t('marketplaceUi.uploadDoc') }}
            </button>
            <text v-if="portfolioDoc" class="upload-hint">{{ tf('marketplaceUi.docUploaded', { name: portfolioDoc.fileName }) }}</text>
          </view>
        </view>

        <button class="submit-btn" :loading="submitting" @click="handleSubmit">{{ t('marketplaceUi.orgApplySubmit') }}</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  BizOrgStatus,
  BizOrgType,
  OrgDocumentType,
  OrgRole,
  formatDisplayDateTime,
  type OrgMembershipSummary,
} from '@douxing/shared';
import {
  applyMarketplaceOrg,
  fetchMyOrgMemberships,
  uploadMarketplaceDocument,
  type MarketplaceDocumentUploadResult,
} from '@/api/marketplace-onboard';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.orgApplyTitle');
useSuppressPetFloatingOnPage();
const { t, tf } = useTf();
const { themeClass } = useTheme();

const loading = ref(true);
const submitting = ref(false);
const uploadingLicense = ref(false);
const uploadingPortfolio = ref(false);
const ownerOrg = ref<OrgMembershipSummary | null>(null);

const name = ref('');
const licenseNo = ref('');
const contactPhone = ref('');
const description = ref('');
const orgTypeIndex = ref(0);
const licenseDoc = ref<MarketplaceDocumentUploadResult | null>(null);
const portfolioDoc = ref<MarketplaceDocumentUploadResult | null>(null);

const orgTypeOptions = [
  BizOrgType.TRAVEL_AGENCY,
  BizOrgType.PHOTO_STUDIO,
  BizOrgType.GUIDE_STUDIO,
  BizOrgType.OUTDOOR_CLUB,
  BizOrgType.OTHER,
];

const orgTypeLabels = computed(() => orgTypeOptions.map((type) => orgTypeLabel(type)));

/** 是否允许提交新申请（无进行中/已通过，或已驳回可重提） */
const canApply = computed(() => {
  if (!ownerOrg.value) return true;
  const status = ownerOrg.value.org.status;
  return status === BizOrgStatus.REJECTED;
});

/**
 * 解析商户类型展示名。
 *
 * @param orgType - 组织类型枚举值
 * @returns 本地化标签
 */
function orgTypeLabel(orgType: string) {
  const map: Record<string, string> = {
    [BizOrgType.TRAVEL_AGENCY]: t('marketplace.orgTypeTravelAgency'),
    [BizOrgType.PHOTO_STUDIO]: t('marketplace.orgTypePhotoStudio'),
    [BizOrgType.GUIDE_STUDIO]: t('marketplace.orgTypeGuideStudio'),
    [BizOrgType.OUTDOOR_CLUB]: t('marketplace.orgTypeOutdoorClub'),
    [BizOrgType.OTHER]: t('marketplace.orgTypeOther'),
  };
  return map[orgType] ?? orgType;
}

/**
 * 解析商户状态展示名。
 *
 * @param status - 状态枚举值
 * @returns 本地化标签
 */
function orgStatusLabel(status: string) {
  const map: Record<string, string> = {
    [BizOrgStatus.PENDING]: t('marketplace.orgStatusPending'),
    [BizOrgStatus.ACTIVE]: t('marketplace.orgStatusActive'),
    [BizOrgStatus.REJECTED]: t('marketplace.orgStatusRejected'),
    [BizOrgStatus.FROZEN]: t('marketplace.orgStatusFrozen'),
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
 * 组织类型 picker 变更。
 *
 * @param e - picker 事件
 */
function onOrgTypeChange(e: { detail: { value: string } }) {
  orgTypeIndex.value = Number(e.detail.value);
}

/**
 * 选择本地图片并上传为资质文件。
 *
 * @returns 临时文件路径；用户取消时为 null
 */
function chooseImagePath(): Promise<string | null> {
  return new Promise((resolve) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => resolve(res.tempFilePaths[0] ?? null),
      fail: () => resolve(null),
    });
  });
}

/**
 * 上传营业执照。
 */
async function pickLicense() {
  const path = await chooseImagePath();
  if (!path) return;
  uploadingLicense.value = true;
  try {
    licenseDoc.value = await uploadMarketplaceDocument(path);
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('common.uploadFailed')), icon: 'none' });
  } finally {
    uploadingLicense.value = false;
  }
}

/**
 * 上传作品集附件。
 */
async function pickPortfolio() {
  const path = await chooseImagePath();
  if (!path) return;
  uploadingPortfolio.value = true;
  try {
    portfolioDoc.value = await uploadMarketplaceDocument(path);
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('common.uploadFailed')), icon: 'none' });
  } finally {
    uploadingPortfolio.value = false;
  }
}

/**
 * 加载当前用户 owner 商户关系。
 */
async function load() {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  loading.value = true;
  try {
    const items = await fetchMyOrgMemberships();
    ownerOrg.value =
      items.find((item) => item.orgRole === OrgRole.OWNER) ??
      items[0] ??
      null;
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('common.loadFailed')), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

/**
 * 提交商户入驻申请。
 */
async function handleSubmit() {
  const orgType = orgTypeOptions[orgTypeIndex.value];
  if (!name.value.trim() || !orgType || !licenseDoc.value) {
    uni.showToast({ title: t('marketplaceUi.orgApplyInvalid'), icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const documents = [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: licenseDoc.value.fileUrl,
        fileName: licenseDoc.value.fileName,
      },
    ];
    if (portfolioDoc.value) {
      documents.push({
        docType: OrgDocumentType.PORTFOLIO,
        fileUrl: portfolioDoc.value.fileUrl,
        fileName: portfolioDoc.value.fileName,
      });
    }
    await applyMarketplaceOrg({
      name: name.value.trim(),
      orgType,
      licenseNo: licenseNo.value.trim() || undefined,
      contactPhone: contactPhone.value.trim() || undefined,
      description: description.value.trim() || undefined,
      documents,
    });
    uni.showToast({ title: t('marketplaceUi.orgApplySuccess'), icon: 'success' });
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
.field:last-child { margin-bottom: 0; }
.label { display: block; margin-bottom: 12rpx; font-size: 26rpx; color: var(--dx-text-secondary); }
.input, .picker, .textarea { background: var(--dx-bg); border: 2rpx solid var(--dx-border); border-radius: var(--dx-radius-sm); padding: 20rpx 24rpx; font-size: 28rpx; color: var(--dx-text); width: 100%; box-sizing: border-box; }
.picker { display: flex; align-items: center; justify-content: space-between; }
.picker-arrow { font-size: 32rpx; color: var(--dx-text-muted); }
.textarea { min-height: 160rpx; }
.upload-btn { margin: 0 0 8rpx; background: var(--dx-primary-light); color: var(--dx-primary); }
.upload-btn::after { border: none; }
.upload-hint, .hint { display: block; margin-top: 8rpx; font-size: 22rpx; color: var(--dx-text-muted); }
.submit-btn { margin-top: 32rpx; background: var(--dx-primary); color: var(--dx-text-inverse); border-radius: var(--dx-radius-lg); border: none; font-size: 30rpx; font-weight: 600; }
.submit-btn::after { border: none; }
</style>
