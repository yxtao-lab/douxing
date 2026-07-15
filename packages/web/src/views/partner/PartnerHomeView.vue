<template>
  <div class="workbench">
    <a-page-header
      class="workbench-header"
      :title="t('partner.pageTitle')"
      :sub-title="t('partner.homeDesc')"
    />

    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :md="12" :lg="8">
          <WorkbenchPanel :title="t('partner.nav.onboard')">
            <template v-if="context">
              <p v-if="context.provider" class="panel-line">
                {{ t('marketplace.providerApplyTitle') }}：
                {{ certStatusLabel(context.provider.certStatus) }}
              </p>
              <p v-for="item in context.memberships" :key="item.orgId" class="panel-line">
                {{ item.org.name }} · {{ orgStatusLabel(item.org.status) }}
              </p>
              <p v-if="!context.provider && context.memberships.length === 0" class="panel-muted">
                {{ t('partner.notQuotable') }}
              </p>
            </template>
            <a-button type="link" class="panel-link" @click="$router.push({ name: 'partner-onboard' })">
              {{ t('partner.goOnboard') }}
            </a-button>
          </WorkbenchPanel>
        </a-col>

        <a-col :xs="24" :md="12" :lg="8">
          <WorkbenchPanel :title="t('partner.nav.demands')">
            <p class="panel-line">{{ canQuote ? t('partner.demandsDesc') : t('partner.notQuotable') }}</p>
            <a-button type="primary" :disabled="!canQuote" @click="$router.push({ name: 'partner-demands' })">
              {{ t('partner.nav.demands') }}
            </a-button>
          </WorkbenchPanel>
        </a-col>

        <a-col :xs="24" :md="12" :lg="8">
          <WorkbenchPanel :title="t('partner.nav.orders')">
            <p class="panel-line">{{ t('partner.ordersHomeHint') }}</p>
            <a-button @click="$router.push({ name: 'partner-orders' })">
              {{ t('partner.nav.orders') }}
            </a-button>
          </WorkbenchPanel>
        </a-col>

        <a-col :xs="24" :md="12" :lg="8">
          <WorkbenchPanel :title="t('partner.nav.schedule')">
            <p class="panel-line">{{ t('partner.scheduleHomeHint') }}</p>
            <a-button @click="$router.push({ name: 'partner-schedule' })">
              {{ t('partner.nav.schedule') }}
            </a-button>
          </WorkbenchPanel>
        </a-col>

        <a-col :xs="24" :md="12" :lg="8">
          <WorkbenchPanel :title="t('partner.nav.settlements')">
            <p class="panel-line">{{ t('partner.settlementsHomeHint') }}</p>
            <a-button @click="$router.push({ name: 'partner-settlements' })">
              {{ t('partner.nav.settlements') }}
            </a-button>
          </WorkbenchPanel>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { BizOrgStatus, CertStatus } from '@douxing/shared';
import WorkbenchPanel from '@/components/workbench/WorkbenchPanel.vue';
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
.workbench {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.workbench-header {
  padding: 0 0 16px;
  background: transparent;
}

.panel-line {
  margin: 0 0 8px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.6;
}

.panel-muted {
  margin: 0 0 8px;
  color: #9ca3af;
  font-size: 14px;
}

.panel-link {
  padding: 0;
}
</style>
