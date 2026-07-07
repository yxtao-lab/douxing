<template>
  <header class="sticky top-0 z-50 border-b border-dx-border bg-white/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
      <RouterLink to="/" class="flex items-center gap-3">
        <AppLogo size="sm" />
        <div class="hidden sm:block">
          <p class="text-base font-semibold text-dx-text">{{ t('app.name') }}</p>
          <p class="text-xs text-dx-muted">{{ t('pc.layout.slogan') }}</p>
        </div>
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="
            activeNav === item.name
              ? 'bg-dx-primary-light text-dx-primary'
              : 'text-dx-muted hover:bg-gray-100 hover:text-dx-text'
          "
        >
          {{ t(item.labelKey) }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <select
          :value="currentLocale"
          class="rounded-lg border border-dx-border bg-white px-2 py-1.5 text-sm text-dx-text"
          @change="onLocaleChange"
        >
          <option v-for="opt in localeOptions" :key="opt.code" :value="opt.code">
            {{ opt.label }}
          </option>
        </select>

        <template v-if="userStore.user">
          <span class="hidden max-w-[120px] truncate text-sm text-dx-muted lg:inline">
            {{ userStore.user.nickname || userStore.user.username }}
          </span>
          <button type="button" class="dx-btn-secondary !px-3 !py-1.5 text-xs" @click="handleLogout">
            {{ t('pc.layout.logout') }}
          </button>
        </template>
        <RouterLink v-else to="/login" class="dx-btn-primary !px-4 !py-1.5 text-xs">
          {{ t('pc.layout.login') }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { logoutSession } from '@/api/auth';
import type { LocaleCode } from '@douxing/shared';

const navItems = [
  { name: 'home', to: '/', labelKey: 'pc.nav.home' },
  { name: 'plan', to: '/plan', labelKey: 'pc.nav.plan' },
  { name: 'routes', to: '/routes', labelKey: 'pc.nav.routes' },
  { name: 'profile', to: '/profile', labelKey: 'pc.nav.profile' },
] as const;

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale, localeOptions, setLocale } = useLocale();

const activeNav = computed(() => (route.meta.navKey as string | undefined) ?? 'home');

function onLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  setLocale(value as LocaleCode);
}

async function handleLogout() {
  await logoutSession(userStore.refreshToken);
  userStore.logout();
  router.push({ name: 'home' });
}
</script>
