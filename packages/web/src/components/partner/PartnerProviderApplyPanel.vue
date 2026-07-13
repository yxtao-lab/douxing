<template>
  <a-spin :spinning="loading">
    <a-card v-if="provider && !canApply" class="partner-form-card">
      <h3 class="partner-status-title">{{ t('partner.statusCardTitle') }}</h3>
      <p class="partner-status-line">{{ t('partner.fieldProviderType') }}：{{ providerTypeLabel(provider.providerType) }}</p>
      <p class="partner-status-line">{{ t('marketplace.colStatus') }}：{{ certStatusLabel(provider.certStatus) }}</p>
      <p v-if="provider.displayName" class="partner-status-line">{{ t('partner.fieldDisplayName') }}：{{ provider.displayName }}</p>
      <p v-if="provider.reviewNote" class="partner-status-line">{{ t('partner.reviewNote') }}：{{ provider.reviewNote }}</p>
    </a-card>

    <a-card v-else class="partner-form-card">
      <a-form layout="vertical">
        <a-alert
          v-if="provider?.certStatus === 'rejected'"
          type="warning"
          :message="t('partner.reapplyHint')"
          show-icon
          class="partner-form-alert"
        />
        <a-form-item :label="t('partner.fieldProviderType')" required>
          <a-select v-model:value="providerType" :options="providerTypeOptions" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldCategories')" required>
          <a-select v-model:value="selectedCategories" mode="multiple" :options="categoryOptions" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldServiceRegions')">
          <a-input v-model:value="serviceRegions" :placeholder="t('partner.regionsPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldDisplayName')">
          <a-input v-model:value="displayName" :placeholder="t('partner.displayNamePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('partner.fieldBio')">
          <a-textarea v-model:value="bio" :placeholder="t('partner.bioPlaceholder')" :rows="3" />
        </a-form-item>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('partner.providerApplySubmit') }}</a-button>
      </a-form>
    </a-card>
  </a-spin>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CertStatus, ProviderType, SERVICE_CATEGORY_TREE, type ServiceProviderSummary } from '@douxing/shared';
import { applyMarketplaceProvider, fetchMyServiceProvider } from '@/api/marketplace-partner';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import { message } from 'ant-design-vue';

const { t } = useLocale();

const loading = ref(true);
const submitting = ref(false);
const provider = ref<ServiceProviderSummary | null>(null);
const providerType = ref<string>(ProviderType.GUIDE);
const selectedCategories = ref<string[]>([]);
const serviceRegions = ref('');
const displayName = ref('');
const bio = ref('');

const providerTypeOptions = computed(() => [
  { value: ProviderType.GUIDE, label: t('marketplace.providerTypeGuide') },
  { value: ProviderType.PHOTOGRAPHER, label: t('marketplace.providerTypePhotographer') },
  { value: ProviderType.MODEL, label: t('marketplace.providerTypeModel') },
  { value: ProviderType.RETOUCHER, label: t('marketplace.providerTypeRetoucher') },
  { value: ProviderType.LEADER, label: t('marketplace.providerTypeLeader') },
]);

const categoryOptions = computed(() =>
  SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []).map((cat) => ({
    value: cat.code,
    label: t(cat.labelKey),
  })),
);

const canApply = computed(() => {
  if (!provider.value) return true;
  return provider.value.certStatus === CertStatus.REJECTED;
});

/**
 * 解析服务者类型展示名。
 *
 * @param type - 类型值
 * @returns 本地化标签
 */
function providerTypeLabel(type: string) {
  return providerTypeOptions.value.find((item) => item.value === type)?.label ?? type;
}

/**
 * 解析认证状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function certStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('marketplace.certStatusPending'),
    approved: t('marketplace.certStatusApproved'),
    rejected: t('marketplace.certStatusRejected'),
  };
  return map[status] ?? status;
}

/**
 * 加载已有认证状态。
 */
async function load() {
  loading.value = true;
  try {
    provider.value = await fetchMyServiceProvider();
  } finally {
    loading.value = false;
  }
}

/**
 * 提交个人服务者认证。
 */
async function handleSubmit() {
  if (selectedCategories.value.length === 0) {
    message.warning(t('partner.providerApplyInvalid'));
    return;
  }
  submitting.value = true;
  try {
    const regions = serviceRegions.value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
    await applyMarketplaceProvider({
      providerType: providerType.value as typeof ProviderType.GUIDE,
      categoryCodes: selectedCategories.value,
      serviceRegions: regions.length > 0 ? regions : undefined,
      displayName: displayName.value.trim() || undefined,
      bio: bio.value.trim() || undefined,
    });
    message.success(t('partner.providerApplySuccess'));
    await load();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.providerApplyInvalid')));
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
</style>
