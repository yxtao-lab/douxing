<template>
  <PageContainer :title="t('partner.demandDetailTitle')" :description="demand?.demandNo">
    <template #extra>
      <a-button @click="$router.push({ name: 'partner-demands' })">
        {{ t('partner.backToDemands') }}
      </a-button>
    </template>

    <a-spin :spinning="loading">
      <template v-if="demand">
        <a-card class="detail-card">
          <h2 class="detail-title">{{ demand.title }}</h2>
          <p class="detail-meta">{{ demand.destination || '-' }} · {{ demandStatusLabel(demand.status) }}</p>
          <p v-if="demand.description" class="detail-desc">{{ demand.description }}</p>
        </a-card>

        <a-card v-if="canQuote" :title="t('partner.quoteFormTitle')" class="detail-card">
          <a-form layout="vertical" @finish="handleSubmit">
            <a-form-item v-if="quoteOrgOptions.length > 1" :label="t('partner.quoteOrg')">
              <a-select v-model:value="selectedOrgId" :options="quoteOrgOptions" />
            </a-form-item>
            <a-form-item :label="t('partner.quoteAmount')" required>
              <a-input v-model:value="amount" type="number" min="0" step="0.01" />
            </a-form-item>
            <a-form-item :label="t('partner.quoteProposal')">
              <a-textarea v-model:value="proposalText" :rows="3" />
            </a-form-item>
            <a-button type="primary" html-type="submit" :loading="submitting">{{ t('partner.quoteSubmit') }}</a-button>
          </a-form>
        </a-card>
        <a-alert v-else type="info" :message="t('partner.notQuotable')" show-icon />
      </template>
    </a-spin>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ServiceDemandDetail } from '@douxing/shared';
import { fetchPartnerDemandDetail, submitPartnerQuote } from '@/api/marketplace-partner';
import { usePartnerContext } from '@/composables/usePartnerContext';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import { message } from 'ant-design-vue';

usePageTitle('partner.demandDetailTitle');
const { t } = useLocale();
const route = useRoute();
const router = useRouter();
const { context, reload: reloadContext } = usePartnerContext();

const demandId = computed(() => Number(route.params.id));
const loading = ref(true);
const submitting = ref(false);
const demand = ref<ServiceDemandDetail | null>(null);
const amount = ref('');
const proposalText = ref('');
const selectedOrgId = ref<number | 'personal'>('personal');

const canQuote = computed(() => {
  if (!context.value) return false;
  return context.value.canQuoteAsProvider || context.value.quotableOrgIds.length > 0;
});

const quoteOrgOptions = computed(() => {
  const options: Array<{ value: number | 'personal'; label: string }> = [];
  if (context.value?.canQuoteAsProvider) {
    options.push({ value: 'personal', label: t('partner.quoteAsPersonal') });
  }
  for (const orgId of context.value?.quotableOrgIds ?? []) {
    const membership = context.value?.memberships.find((item) => item.orgId === orgId);
    options.push({ value: orgId, label: membership?.org.name ?? String(orgId) });
  }
  return options;
});

/**
 * 解析需求状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 加载需求详情。
 */
async function load() {
  loading.value = true;
  try {
    demand.value = await fetchPartnerDemandDetail(demandId.value);
  } finally {
    loading.value = false;
  }
}

/**
 * 提交报价表单。
 */
async function handleSubmit() {
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) {
    message.warning(t('partner.quoteInvalid'));
    return;
  }
  submitting.value = true;
  try {
    await submitPartnerQuote(demandId.value, {
      amount: value.toFixed(2),
      proposalText: proposalText.value.trim() || undefined,
      orgId: selectedOrgId.value === 'personal' ? undefined : selectedOrgId.value,
    });
    message.success(t('partner.quoteSuccess'));
    router.push({ name: 'partner-quotes' });
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await reloadContext();
  if (quoteOrgOptions.value.length > 0) {
    selectedOrgId.value = quoteOrgOptions.value[0]!.value;
  }
  await load();
});
</script>

<style scoped>
.detail-card {
  margin-bottom: 16px;
}

.detail-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.detail-meta {
  margin: 0;
  color: #6b7280;
}

.detail-desc {
  margin: 12px 0 0;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
