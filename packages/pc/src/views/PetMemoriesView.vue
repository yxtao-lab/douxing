<template>
  <SubPageShell
    :title="copy.title"
    :description="copy.analyzePrePlan"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-4">
      <button
        type="button"
        class="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-60"
        :disabled="analyzing"
        @click="runAnalyze"
      >
        {{ analyzing ? copy.analyzing : copy.analyzePrePlan }}
      </button>
    </div>

    <section v-if="analyzeCard" class="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-semibold text-amber-900">{{ analyzeCard.sceneLabel }}</span>
        <span v-if="analyzeCard.cached" class="text-xs text-stone-400">{{ copy.cachedHint }}</span>
      </div>
      <p class="text-xs font-semibold text-amber-900">{{ copy.insightTitle }}</p>
      <p class="mt-1 text-sm leading-relaxed text-stone-700">{{ analyzeCard.insight }}</p>
      <p class="mt-3 text-xs font-semibold text-amber-900">{{ copy.petReplyTitle }}</p>
      <p class="mt-1 text-sm leading-relaxed text-amber-900">{{ analyzeCard.petReply }}</p>

      <div v-if="analyzeCard.memoriesToSave.length" class="mt-4">
        <p class="text-xs font-semibold text-amber-900">{{ copy.suggestedMemories }}</p>
        <label
          v-for="(item, index) in analyzeCard.memoriesToSave"
          :key="`${item.content}-${index}`"
          class="mt-2 flex cursor-pointer items-start gap-2 rounded-xl bg-white/85 px-3 py-2"
        >
          <input v-model="item.selected" type="checkbox" class="mt-1" />
          <span class="text-sm text-stone-800">{{ item.content }}</span>
        </label>
        <button
          type="button"
          class="mt-3 w-full rounded-full border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
          @click="saveSelectedMemories"
        >
          {{ copy.confirmSave }}
        </button>
      </div>
    </section>

    <div v-if="loading && items.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="items.length === 0" class="dx-card text-center">
      <p class="mb-4 text-dx-muted">{{ copy.empty }}</p>
      <button type="button" class="dx-btn-primary" @click="runAnalyze">{{ copy.analyzePrePlan }}</button>
    </div>
    <div v-else class="space-y-3">
      <article v-for="item in items" :key="item.id" class="dx-card">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-amber-700">{{ item.typeLabel }}</span>
          <span v-if="item.pinned" aria-hidden="true">📌</span>
        </div>
        <p class="mt-2 text-sm leading-relaxed text-dx-text">{{ item.content }}</p>
        <div class="mt-3 flex items-center justify-between gap-2">
          <span class="text-xs text-dx-muted">{{ item.dateLabel }}</span>
          <div class="flex gap-3 text-xs">
            <button type="button" class="text-amber-700 hover:underline" @click="togglePin(item)">
              {{ item.pinned ? copy.unpinLabel : copy.pinLabel }}
            </button>
            <button type="button" class="text-red-600 hover:underline" @click="confirmDelete(item)">
              {{ copy.deleteLabel }}
            </button>
          </div>
        </div>
      </article>
      <InfiniteScrollFooter
        :has-more="hasMore"
        :loading="loading"
        :loading-more="loadingMore"
        :on-load-more="loadMore"
      />
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  buildPetAnalyzeCardViewModel,
  buildPetMemoryWallListItemViewModel,
  resolvePetMemoryWallPageCopy,
  type PetAnalyzeCardViewModel,
  type PetMemoryWallItem,
  type PetMemoryWallListItemViewModel,
} from '@douxing/shared';
import {
  analyzeTravelPet,
  confirmPetMemories,
  deletePetMemory,
  fetchPetMemoriesPage,
  patchPetMemoryPin,
} from '@/api/pets';
import InfiniteScrollFooter from '@/components/InfiniteScrollFooter.vue';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t, currentLocale } = useLocale();
const route = useRoute();
const copy = computed(() => resolvePetMemoryWallPageCopy(currentLocale.value));

const analyzing = ref(false);
const analyzeCard = ref<PetAnalyzeCardViewModel | null>(null);
const rawItems = ref<PetMemoryWallItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const page = ref(0);
const pageSize = 20;

const items = computed(() =>
  rawItems.value.map((item) => buildPetMemoryWallListItemViewModel(item, currentLocale.value)),
);

async function loadPage(nextPage: number, append: boolean) {
  if (nextPage === 1) loading.value = true;
  else loadingMore.value = true;
  try {
    const result = await fetchPetMemoriesPage(nextPage, pageSize);
    rawItems.value = append ? [...rawItems.value, ...result.items] : result.items;
    hasMore.value = result.hasMore;
    page.value = result.page;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadInitial() {
  await loadPage(1, false);
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  await loadPage(page.value + 1, true);
}

async function runAnalyze() {
  analyzing.value = true;
  try {
    const result = await analyzeTravelPet({ scene: 'pre_plan' });
    analyzeCard.value = buildPetAnalyzeCardViewModel(result, currentLocale.value);
  } catch {
    window.alert(t('common.operationFailed'));
  } finally {
    analyzing.value = false;
  }
}

async function saveSelectedMemories() {
  if (!analyzeCard.value) return;
  const selected = analyzeCard.value.memoriesToSave.filter((m) => m.selected);
  if (!selected.length) return;
  try {
    await confirmPetMemories({
      items: selected.map(({ memoryType, content, importance, metadata }) => ({
        memoryType,
        content,
        importance,
        metadata,
      })),
    });
    analyzeCard.value = null;
    await loadInitial();
  } catch {
    window.alert(t('common.operationFailed'));
  }
}

async function togglePin(item: PetMemoryWallListItemViewModel) {
  try {
    await patchPetMemoryPin(item.id, !item.pinned);
    await loadInitial();
  } catch {
    window.alert(t('common.operationFailed'));
  }
}

async function confirmDelete(item: PetMemoryWallListItemViewModel) {
  if (!window.confirm(copy.value.deleteConfirm)) return;
  try {
    await deletePetMemory(item.id);
    await loadInitial();
  } catch {
    window.alert(t('common.operationFailed'));
  }
}

onMounted(async () => {
  await loadInitial();
  if (route.query.analyze === '1') {
    await runAnalyze();
  }
});
</script>
