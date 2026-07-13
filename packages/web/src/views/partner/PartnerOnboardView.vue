<template>
  <div class="partner-page">
    <h1 class="partner-page-title">{{ t('partner.onboardTitle') }}</h1>
    <p class="partner-page-desc">{{ t('partner.onboardDesc') }}</p>
    <div class="partner-cards">
      <a-card hoverable class="partner-card" @click="$router.push({ name: 'partner-org-apply' })">
        <h3>{{ t('partner.orgApplyCard') }}</h3>
        <p>{{ t('partner.orgApplyDesc') }}</p>
      </a-card>
      <a-card hoverable class="partner-card" @click="$router.push({ name: 'partner-provider-apply' })">
        <h3>{{ t('partner.providerApplyCard') }}</h3>
        <p>{{ t('partner.providerApplyDesc') }}</p>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('partner.onboardTitle');
const { t } = useLocale();
</script>

<style scoped>
.partner-page-title { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
.partner-page-desc { margin: 0 0 24px; color: #666; }
.partner-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.partner-card { cursor: pointer; }
.partner-card h3 { margin: 0 0 8px; font-size: 16px; }
.partner-card p { margin: 0; color: #666; font-size: 14px; }
</style>
