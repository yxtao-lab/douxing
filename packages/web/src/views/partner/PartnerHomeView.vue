<template>
  <div class="partner-page">
    <h1 class="partner-page-title">{{ t('partner.pageTitle') }}</h1>
    <p class="partner-page-desc">{{ t('partner.homeDesc') }}</p>

    <a-spin :spinning="loading">
      <div class="partner-cards">
        <a-card class="partner-card" :title="t('partner.nav.onboard')">
          <template v-if="context">
            <p v-if="context.provider">
              {{ t('marketplace.providerApplyTitle') }}：
              {{ certStatusLabel(context.provider.certStatus) }}
            </p>
            <p v-for="item in context.memberships" :key="item.orgId">
              {{ item.org.name }} · {{ orgStatusLabel(item.org.status) }}
            </p>
            <p v-if="!context.provider && context.memberships.length === 0" class="text-muted">
              {{ t('partner.notQuotable') }}
            </p>
          </template>
          <a-button type="link" @click="$router.push({ name: 'partner-onboard' })">{{ t('partner.goOnboard') }}</a-button>
        </a-card>

        <a-card class="partner-card" :title="t('partner.nav.demands')">
          <p>{{ canQuote ? t('partner.demandsDesc') : t('partner.notQuotable') }}</p>
          <a-button type="primary" :disabled="!canQuote" @click="$router.push({ name: 'partner-demands' })">
            {{ t('partner.nav.demands') }}
          </a-button>
        </a-card>

        <a-card class="partner-card" :title="t('partner.nav.orders')">
          <a-button @click="$router.push({ name: 'partner-orders' })">{{ t('partner.nav.orders') }}</a-button>
        </a-card>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { BizOrgStatus, CertStatus } from '@douxing/shared';
import { usePartnerContext } from '@/composables/usePartnerContext';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('partner.pageTitle');
const { t } = useLocale();
const { context, loading, reload } = usePartnerContext();

const canQuote = computed(() => {
  if (!context.value) return false;
  return context.value.canQuoteAsProvider || context.value.quotableOrgIds.length > 0;
});

/**
 * 解析商户状态展示名。
 *
 * @param status - 商户状态值
 * @returns 本地化标签
 */
function orgStatusLabel(status: string) {
  const map: Record<string, string> = {
    [BizOrgStatus.PENDING]: t('marketplace.statusPending'),
    [BizOrgStatus.ACTIVE]: t('marketplace.statusActive'),
    [BizOrgStatus.REJECTED]: t('marketplace.statusRejected'),
    [BizOrgStatus.FROZEN]: t('marketplace.statusFrozen'),
  };
  return map[status] ?? status;
}

/**
 * 解析服务者认证状态展示名。
 *
 * @param status - 认证状态值
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

onMounted(reload);
</script>

<style scoped>
.partner-page-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
}

.partner-page-desc {
  margin: 0 0 24px;
  color: #666;
}

.partner-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.text-muted {
  color: #999;
}
</style>
