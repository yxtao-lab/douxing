<template>
  <SubPageShell
    :title="t('nav.achievements')"
    :description="t('emptyState.achievementsDesc')"
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
    <div v-else-if="filtered.length === 0" class="dx-card text-center">
      <p class="text-dx-muted">{{ t('achievements.emptyFilter') }}</p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="dx-card flex gap-4"
        :class="isCompleted(item) ? 'border-emerald-200 bg-emerald-50/30' : 'opacity-80'"
      >
        <span class="text-3xl">{{ item.iconUrl || '🏅' }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-semibold text-dx-text">{{ item.name }}</h3>
            <span v-if="isCompleted(item)" class="text-xs text-emerald-700">{{ t('common.statusUnlocked') }}</span>
          </div>
          <p class="mt-1 text-sm text-dx-muted">{{ item.description }}</p>
          <div v-if="!isCompleted(item) && item.progress" class="mt-2">
            <div class="h-2 overflow-hidden rounded-full bg-gray-200">
              <div class="h-full bg-dx-primary" :style="{ width: `${progressPercent(item)}%` }" />
            </div>
            <p class="mt-1 text-xs text-dx-muted">
              {{ t('achievements.progressLabel', { current: item.progress.current, target: item.progress.target }) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AchievementCatalogItem } from '@douxing/shared';
import { AchievementCategory } from '@douxing/shared';
import { fetchAchievementCatalog } from '@/api/achievements';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
const catalog = ref<AchievementCatalogItem[]>([]);
const loading = ref(true);
const activeCategory = ref('all');
const activeUnlock = ref('all');

const categoryOptions = computed(() => [
  { key: 'all', label: t('common.filterAll') },
  { key: AchievementCategory.EXPLORE, label: t('achievementCategory.explore') },
  { key: AchievementCategory.CHALLENGE, label: t('achievementCategory.challenge') },
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

function isCompleted(item: AchievementCatalogItem) {
  if (item.unlocked) return true;
  const progress = item.progress;
  if (!progress) return false;
  return progress.current >= progress.target;
}

function progressPercent(item: AchievementCatalogItem) {
  const progress = item.progress;
  if (!progress || progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.target) * 100));
}

onMounted(async () => {
  try {
    catalog.value = await fetchAchievementCatalog();
  } finally {
    loading.value = false;
  }
});
</script>
