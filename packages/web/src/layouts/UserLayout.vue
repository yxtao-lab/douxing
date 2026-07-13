<template>
  <div class="user-layout">
    <header class="user-layout-top">
      <AppLogo />
      <a-select
        class="locale-select"
        :value="currentLocale"
        :options="localeSelectOptions"
        @change="onLocaleChange"
      />
    </header>

    <div class="user-layout-main">
      <section class="user-layout-hero">
        <h1>{{ isPartnerLogin ? t('partner.brand') : t('layout.loginHeroTitle') }}</h1>
        <p>{{ isPartnerLogin ? t('partner.loginHeroDesc') : t('layout.loginHeroDesc') }}</p>
      </section>
      <section class="user-layout-form">
        <router-view />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { isLocaleCode } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';
import AppLogo from './components/AppLogo.vue';

const route = useRoute();
const { t, currentLocale, localeOptions, setLocale } = useLocale();
const isPartnerLogin = computed(() => route.query.portal === 'partner');

const localeSelectOptions = computed(() =>
  localeOptions.map((item) => ({ value: item.code, label: item.label })),
);

function onLocaleChange(value: unknown) {
  if (typeof value === 'string' && isLocaleCode(value)) {
    setLocale(value);
  }
}
</script>

<style scoped>
.user-layout {
  height: 100%;
  overflow: auto;
  background: var(--gradient-admin-hero);
}

.user-layout-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
}

.user-layout-top :deep(.app-logo) {
  border-bottom: none;
  height: auto;
  padding: 0;
}

.user-layout-top :deep(.logo-title) {
  color: #fff;
}

.locale-select {
  width: 120px;
}

.user-layout-main {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 48px;
  align-items: center;
  min-height: calc(100% - 68px);
  padding: 24px 48px 48px;
  max-width: 1100px;
  margin: 0 auto;
}

.user-layout-hero {
  color: #fff;
}

.user-layout-hero h1 {
  font-size: 2rem;
  margin-bottom: 16px;
}

.user-layout-hero p {
  font-size: 1rem;
  opacity: 0.85;
  line-height: 1.7;
}

.user-layout-form {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

@media (max-width: 900px) {
  .user-layout-main {
    grid-template-columns: 1fr;
    padding: 24px;
  }

  .user-layout-hero {
    text-align: center;
  }
}
</style>
