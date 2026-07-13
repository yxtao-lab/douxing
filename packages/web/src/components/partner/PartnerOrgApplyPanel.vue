<template>
  <a-spin :spinning="loading">
    <a-card v-if="ownerOrg && !canApply" class="partner-form-card">
      <h3 class="partner-status-title">{{ t('partner.statusCardTitle') }}</h3>
      <p class="partner-status-line">{{ t('partner.fieldOrgName') }}：{{ ownerOrg.org.name }}</p>
      <p class="partner-status-line">{{ t('partner.fieldOrgType') }}：{{ orgTypeLabel(ownerOrg.org.orgType) }}</p>
      <p class="partner-status-line">{{ t('marketplace.colStatus') }}：{{ orgStatusLabel(ownerOrg.org.status) }}</p>
      <p v-if="ownerOrg.org.reviewNote" class="partner-status-line">{{ t('partner.reviewNote') }}：{{ ownerOrg.org.reviewNote }}</p>
    </a-card>

    <a-card v-else class="partner-form-card">
      <a-form layout="vertical">
        <a-alert
          v-if="ownerOrg?.org.status === 'rejected'"
          type="warning"
          :message="t('partner.reapplyHint')"
          show-icon
          class="partner-form-alert"
        />
        <a-form-item :label="t('partner.fieldOrgName')" required>
          <a-input v-model:value="name" :placeholder="t('partner.orgNamePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldOrgType')" required>
          <a-select v-model:value="orgType" :options="orgTypeOptions" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldLicenseNo')">
          <a-input v-model:value="licenseNo" :placeholder="t('partner.licenseNoPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldContactPhone')">
          <a-input v-model:value="contactPhone" :placeholder="t('partner.phonePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldDescription')">
          <a-textarea v-model:value="description" :placeholder="t('partner.orgDescPlaceholder')" :rows="3" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldLicenseDoc')" required>
          <input type="file" accept="image/*,application/pdf" @change="onLicenseFile" />
          <p v-if="licenseDoc" class="partner-form-hint">{{ t('partner.docUploaded', { name: licenseDoc.fileName }) }}</p>
        </a-form-item>
        <a-form-item :label="t('partner.fieldPortfolioDoc')">
          <input type="file" accept="image/*,application/pdf" @change="onPortfolioFile" />
          <p v-if="portfolioDoc" class="partner-form-hint">{{ t('partner.docUploaded', { name: portfolioDoc.fileName }) }}</p>
        </a-form-item>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('partner.orgApplySubmit') }}</a-button>
      </a-form>
    </a-card>
  </a-spin>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BizOrgStatus, BizOrgType, OrgDocumentType, OrgRole, type OrgMembershipSummary } from '@douxing/shared';
import {
  applyMarketplaceOrg,
  fetchMyOrgMemberships,
  uploadMarketplaceDocument,
  type MarketplaceDocumentUploadResult,
} from '@/api/marketplace-partner';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import { message } from 'ant-design-vue';

const { t } = useLocale();

const loading = ref(true);
const submitting = ref(false);
const memberships = ref<OrgMembershipSummary[]>([]);
const name = ref('');
const orgType = ref<string>(BizOrgType.TRAVEL_AGENCY);
const licenseNo = ref('');
const contactPhone = ref('');
const description = ref('');
const licenseDoc = ref<MarketplaceDocumentUploadResult | null>(null);
const portfolioDoc = ref<MarketplaceDocumentUploadResult | null>(null);

const orgTypeOptions = computed(() => [
  { value: BizOrgType.TRAVEL_AGENCY, label: t('marketplace.orgTypeTravelAgency') },
  { value: BizOrgType.PHOTO_STUDIO, label: t('marketplace.orgTypePhotoStudio') },
  { value: BizOrgType.GUIDE_STUDIO, label: t('marketplace.orgTypeGuideStudio') },
  { value: BizOrgType.OUTDOOR_CLUB, label: t('marketplace.orgTypeOutdoorClub') },
  { value: BizOrgType.OTHER, label: t('marketplace.orgTypeOther') },
]);

const ownerOrg = computed(() => memberships.value.find((item) => item.orgRole === OrgRole.OWNER) ?? null);
const canApply = computed(() => {
  if (!ownerOrg.value) return true;
  return ownerOrg.value.org.status === BizOrgStatus.REJECTED;
});

/**
 * 解析组织类型展示名。
 *
 * @param type - 组织类型
 * @returns 本地化标签
 */
function orgTypeLabel(type: string) {
  return orgTypeOptions.value.find((item) => item.value === type)?.label ?? type;
}

/**
 * 解析商户状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function orgStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('marketplace.statusPending'),
    active: t('marketplace.statusActive'),
    rejected: t('marketplace.statusRejected'),
    frozen: t('marketplace.statusFrozen'),
  };
  return map[status] ?? status;
}

/**
 * 上传营业执照文件。
 *
 * @param event - input change 事件
 */
async function onLicenseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  licenseDoc.value = await uploadMarketplaceDocument(file);
}

/**
 * 上传作品集文件。
 *
 * @param event - input change 事件
 */
async function onPortfolioFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  portfolioDoc.value = await uploadMarketplaceDocument(file);
}

/**
 * 加载已有入驻申请状态。
 */
async function load() {
  loading.value = true;
  try {
    memberships.value = await fetchMyOrgMemberships();
  } finally {
    loading.value = false;
  }
}

/**
 * 提交商户入驻表单。
 */
async function handleSubmit() {
  if (!name.value.trim() || !licenseDoc.value) {
    message.warning(t('partner.orgApplyInvalid'));
    return;
  }
  submitting.value = true;
  try {
    const documents: Array<{ docType: typeof OrgDocumentType.LICENSE | typeof OrgDocumentType.PORTFOLIO; fileUrl: string; fileName: string }> = [
      { docType: OrgDocumentType.LICENSE, fileUrl: licenseDoc.value.fileUrl, fileName: licenseDoc.value.fileName },
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
      orgType: orgType.value as typeof BizOrgType.TRAVEL_AGENCY,
      licenseNo: licenseNo.value.trim() || undefined,
      contactPhone: contactPhone.value.trim() || undefined,
      description: description.value.trim() || undefined,
      documents,
    });
    message.success(t('partner.orgApplySuccess'));
    await load();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.orgApplyInvalid')));
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.partner-form-card {
  max-width: 640px;
}

.partner-status-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.partner-status-line {
  margin: 0 0 8px;
  color: #6b7280;
}

.partner-form-alert {
  margin-bottom: 16px;
}

.partner-form-hint {
  margin-top: 8px;
  color: #6b7280;
  font-size: 13px;
}
</style>
