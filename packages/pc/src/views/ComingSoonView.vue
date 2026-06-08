<template>
  <div class="mx-auto max-w-lg px-4 py-16 text-center lg:px-8">
    <div class="dx-card">
      <p class="mb-2 text-4xl">🚧</p>
      <h1 class="mb-2 text-xl font-semibold">{{ t('pc.comingSoon.title') }}</h1>
      <p class="mb-6 text-dx-muted">{{ t('pc.comingSoon.desc') }}</p>
      <RouterLink to="/" class="dx-btn-primary inline-flex">
        {{ t('pc.comingSoon.backHome') }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
</script>
