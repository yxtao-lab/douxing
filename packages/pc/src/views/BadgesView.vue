<template>
  <SubPageShell
    :title="t('nav.badges')"
    :description="t('emptyState.badgesDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <template #actions>
      <span class="rounded-full bg-dx-primary-light px-3 py-1 text-sm font-medium text-dx-primary">
        {{ unlockedCount }}/{{ catalog.length }}
      </span>
    </template>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="opt in categoryOptions"
        :key="opt.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs"
        :class="activeCategory === opt.key ? 'bg-dx-primary text-white' : 'bg-gray-100 text-dx-muted'"
        @click="activeCategory = opt.key"
      >
        {{ opt.label }}
      </button>
    </div>
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="opt in unlockOptions"
        :key="opt.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs"
        :class="activeUnlock === opt.key ? 'bg-dx-primary-light text-dx-primary' : 'bg-gray-100 text-dx-muted'"
        @click="activeUnlock = opt.key"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="filtered.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('badges.emptyFilter') }}
    </div>
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="dx-card text-center"
        :class="isCompleted(item) ? '' : 'opacity-60 grayscale'"
      >
        <div class="text-4xl">{{ item.iconUrl || '🎖️' }}</div>
        <h3 class="mt-2 font-semibold">{{ item.name }}</h3>
        <p class="mt-1 text-xs text-dx-muted">{{ item.description }}</p>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { BadgeCatalogItem } from '@douxing/shared';
import { BadgeCategory } from '@douxing/shared';
import { fetchBadgeCatalog } from '@/api/badges';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
const catalog = ref<BadgeCatalogItem[]>([]);
const loading = ref(true);
const activeCategory = ref('all');
const activeUnlock = ref('all');

const categoryOptions = computed(() => [
  { key: 'all', label: t('common.filterAll') },
  { key: BadgeCategory.CITY, label: t('badgeCategory.city') },
  { key: BadgeCategory.ACHIEVEMENT, label: t('badgeCategory.achievement') },
  { key: BadgeCategory.SPECIAL, label: t('badgeCategory.special') },
]);

const unlockOptions = computed(() => [
  { key: 'all', label: t('common.statusAll') },
  { key: 'unlocked', label: t('common.statusUnlocked') },
  { key: 'locked', label: t('common.statusLocked') },
]);

const unlockedCount = computed(() => catalog.value.filter((item) => isCompleted(item)).length);

const filtered = computed(() => {
  let list = catalog.value;
  if (activeCategory.value !== 'all') {
    list = list.filter((item) => item.category === activeCategory.value);
  }
  if (activeUnlock.value === 'unlocked') list = list.filter((item) => isCompleted(item));
  if (activeUnlock.value === 'locked') list = list.filter((item) => !isCompleted(item));
  return [...list].sort((a, b) => Number(isCompleted(b)) - Number(isCompleted(a)));
});

function isCompleted(item: BadgeCatalogItem) {
  return item.unlocked === true;
}

onMounted(async () => {
  try {
    catalog.value = await fetchBadgeCatalog();
  } finally {
    loading.value = false;
  }
});
</script>
