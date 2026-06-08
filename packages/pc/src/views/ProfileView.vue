<template>
  <div class="mx-auto max-w-5xl px-4 py-6 lg:px-8">
    <section class="mb-8 overflow-hidden rounded-2xl bg-dx-hero text-white shadow-hero">
      <div class="p-6 lg:p-8">
        <div v-if="user" class="flex items-start gap-4">
          <img
            v-if="user.avatar"
            :src="user.avatar"
            alt=""
            class="h-16 w-16 rounded-2xl border-2 border-white/30 object-cover"
          />
          <div
            v-else
            class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold"
          >
            {{ avatarText }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-bold">{{ user.nickname || user.username }}</h1>
              <RouterLink
                :to="{ name: 'membership' }"
                class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium hover:bg-white/30"
              >
                {{ memberLevelLabel }}
              </RouterLink>
            </div>
            <p class="mt-1 text-sm text-white/85">{{ planQuotaText }}</p>
            <div v-if="user.interestTags?.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="tag in user.interestTags"
                :key="tag"
                class="rounded-full bg-white/15 px-2 py-0.5 text-xs"
              >
                {{ labelOf(tag) }}
              </span>
            </div>
          </div>
          <RouterLink
            :to="{ name: 'profile-edit' }"
            class="rounded-xl bg-white/15 px-4 py-2 text-sm hover:bg-white/25"
          >
            {{ t('profile.actionEdit') }}
          </RouterLink>
        </div>
        <div v-else class="text-center">
          <p class="text-xl font-semibold">{{ t('profile.guestTitle') }}</p>
          <p class="mt-2 text-white/85">{{ t('profile.guestDesc') }}</p>
          <RouterLink to="/login" class="mt-4 inline-block dx-btn-primary !bg-white !text-dx-primary">
            {{ t('profile.loginRegister') }}
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="mb-8">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-dx-muted">
        {{ t('profile.sectionPersonalize') }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="item in gridItems"
          :key="item.key"
          type="button"
          class="flex items-center gap-3 rounded-2xl border border-dx-border bg-white p-4 text-left shadow-card transition hover:border-dx-primary/40"
          @click="handleGridTap(item)"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-xl text-xl" :style="{ background: item.bg }">
            {{ item.icon }}
          </span>
          <span class="font-medium text-dx-text">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-dx-muted">
        {{ t('profile.sectionAccount') }}
      </h2>
      <div class="space-y-2 rounded-2xl border border-dx-border bg-white p-2 shadow-card">
        <RouterLink
          :to="{ name: 'routes' }"
          class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-dx-text transition hover:bg-dx-bg"
        >
          {{ t('profile.actionRoutes') }}
          <span class="text-dx-muted">›</span>
        </RouterLink>
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-dx-text transition hover:bg-dx-bg"
          @click="goOrders"
        >
          {{ t('profile.actionOrders') }}
          <span class="text-dx-muted">›</span>
        </button>
        <button
          v-if="user"
          type="button"
          class="flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
          @click="handleLogout"
        >
          {{ t('common.logout') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { UserInfo } from '@douxing/shared';
import {
  canAppendPlanByMemberLevel,
  formatInterestTagLabel,
  getMemberLevelI18nKey,
  getPlanCandidateCountByMemberLevel,
} from '@douxing/shared';
import { fetchUserProfile } from '@/api/user';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale } = useLocale();

const user = ref<UserInfo | null>(userStore.user);

const avatarText = computed(() => (user.value?.nickname || user.value?.username || '?').slice(0, 1));

const memberLevelLabel = computed(() => t(getMemberLevelI18nKey(user.value?.memberLevel)));

const planQuotaText = computed(() => {
  if (!user.value) return '';
  const followUp = canAppendPlanByMemberLevel(user.value.memberLevel)
    ? t('profile.planQuotaFollowUpYes')
    : t('profile.planQuotaFollowUpNo');
  return t('profile.planQuota', {
    username: user.value.username,
    count: getPlanCandidateCountByMemberLevel(user.value.memberLevel),
    followUp,
  });
});

function labelOf(tag: string) {
  return formatInterestTagLabel(tag, currentLocale.value);
}

const gridItems = computed(() => [
  { key: 'checkins', icon: '📍', label: t('profile.gridCheckins'), bg: '#e8f3ff', needLogin: true, to: { name: 'checkins' } },
  { key: 'achievements', icon: '🏅', label: t('profile.gridAchievements'), bg: '#fff7e6', needLogin: true, to: { name: 'achievements' } },
  { key: 'badges', icon: '🎖️', label: t('profile.gridBadges'), bg: '#f9f0ff', needLogin: true, to: { name: 'badges' } },
  { key: 'leaderboard', icon: '🏆', label: t('profile.gridLeaderboard'), bg: '#fff1f0', needLogin: true, to: { name: 'leaderboard' } },
  { key: 'membership', icon: '💎', label: t('nav.membership'), bg: '#e6fffb', needLogin: true, to: { name: 'membership' } },
]);

function handleGridTap(item: (typeof gridItems.value)[number]) {
  if (item.needLogin && !user.value) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
    return;
  }
  router.push(item.to);
}

function handleLogout() {
  userStore.logout();
  router.push({ name: 'home' });
}

function goOrders() {
  if (!user.value) {
    router.push({ name: 'login', query: { redirect: '/orders' } });
    return;
  }
  router.push({ name: 'orders' });
}

async function loadUser() {
  if (!userStore.token) {
    user.value = null;
    return;
  }
  try {
    user.value = await fetchUserProfile();
    if (userStore.token && user.value) {
      userStore.setAuth(userStore.token, user.value);
    }
  } catch (err) {
    user.value = userStore.user;
  }
}

onMounted(() => {
  void loadUser();
});
</script>
