<template>
  <PageContainer admin>
    <template v-if="activePanel">
      <div class="onboard-panel-head">
        <a-button type="link" class="onboard-back-btn" @click="backToHub">
          <ArrowLeftOutlined />
          {{ t('partner.backToOnboard') }}
        </a-button>
        <h2 class="onboard-panel-title">{{ panelTitle }}</h2>
        <p class="onboard-panel-desc">{{ panelDesc }}</p>
      </div>
      <PartnerOrgApplyPanel v-if="activePanel === 'org'" />
      <PartnerProviderApplyPanel v-else-if="activePanel === 'provider'" />
    </template>

    <template v-else>
      <p class="onboard-hub-desc">{{ t('partner.onboardDesc') }}</p>
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :md="12">
          <a-card hoverable class="onboard-card" @click="openPanel('org')">
            <h3 class="onboard-card-title">{{ t('partner.orgApplyCard') }}</h3>
            <p class="onboard-card-desc">{{ t('partner.orgApplyDesc') }}</p>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-card hoverable class="onboard-card" @click="openPanel('provider')">
            <h3 class="onboard-card-title">{{ t('partner.providerApplyCard') }}</h3>
            <p class="onboard-card-desc">{{ t('partner.providerApplyDesc') }}</p>
          </a-card>
        </a-col>
      </a-row>
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import PartnerOrgApplyPanel from '@/components/partner/PartnerOrgApplyPanel.vue';
import PartnerProviderApplyPanel from '@/components/partner/PartnerProviderApplyPanel.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

const ONBOARD_PANELS = ['org', 'provider'] as const;
type OnboardPanel = (typeof ONBOARD_PANELS)[number];

usePageTitle('partner.onboardTitle');
const { t } = useLocale();
const route = useRoute();
const router = useRouter();

const activePanel = computed<OnboardPanel | null>(() => {
  const panel = route.query.panel;
  if (typeof panel !== 'string') return null;
  return ONBOARD_PANELS.includes(panel as OnboardPanel) ? (panel as OnboardPanel) : null;
});

const panelTitle = computed(() => {
  if (activePanel.value === 'org') return t('marketplace.orgApplyTitle');
  if (activePanel.value === 'provider') return t('marketplace.providerApplyTitle');
  return '';
});

const panelDesc = computed(() => {
  if (activePanel.value === 'org') return t('partner.orgApplyDesc');
  if (activePanel.value === 'provider') return t('partner.providerApplyDesc');
  return '';
});

/**
 * 在当前入驻页内切换子面板（不离开 /partner/onboard 路由）。
 *
 * @param panel - 子面板标识：`org` 商户入驻；`provider` 个人服务者认证
 */
function openPanel(panel: OnboardPanel) {
  router.replace({ name: 'partner-onboard', query: { panel } });
}

/**
 * 返回入驻入口选择区。
 */
function backToHub() {
  router.replace({ name: 'partner-onboard' });
}
</script>

<style scoped>
.onboard-hub-desc {
  margin: 0 0 16px;
  color: #6b7280;
  line-height: 1.6;
}

.onboard-panel-head {
  margin-bottom: 16px;
}

.onboard-back-btn {
  padding-left: 0;
  margin-bottom: 4px;
}

.onboard-panel-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.onboard-panel-desc {
  margin: 0;
  color: #6b7280;
  line-height: 1.6;
}

.onboard-card {
  cursor: pointer;
  height: 100%;
}

.onboard-card-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.onboard-card-desc {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.6;
}
</style>
