<template>
  <div class="flex min-h-full">
    <div class="hidden w-[420px] bg-dx-hero lg:flex lg:flex-col lg:justify-between lg:p-10">
      <div>
        <div class="flex items-center gap-3">
          <AppLogo size="md" class="rounded-2xl ring-2 ring-white/25" />
          <div>
            <p class="text-xl font-semibold text-white">{{ t('app.name') }}</p>
            <p class="text-sm text-white/80">{{ t('home.subtitle') }}</p>
          </div>
        </div>
        <p class="mt-10 text-2xl font-semibold leading-snug text-white">
          {{ t('pc.layout.slogan') }}
        </p>
      </div>
      <p class="text-sm text-white/70">{{ t('home.tagline') }}</p>
    </div>

    <div class="flex flex-1 items-center justify-center bg-dx-bg p-6">
      <div class="w-full max-w-md">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
</script>
