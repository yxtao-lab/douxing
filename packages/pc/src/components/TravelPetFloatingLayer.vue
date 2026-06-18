<script setup lang="ts">
import { usePetCompanion } from '@/composables/usePetCompanion';

const {
  visible,
  sheetOpen,
  showBubble,
  ambientBubble,
  speciesEmoji,
  sheetViewModel,
  openSheet,
  closeSheet,
  goPlan,
  goMemoryWall,
  triggerPrePlanAnalyze,
} = usePetCompanion();
</script>

<template>
  <div v-if="visible" class="pointer-events-none fixed inset-0 z-[9990]">
    <div
      v-if="showBubble && ambientBubble && !sheetOpen"
      class="pointer-events-none absolute bottom-28 right-6 max-w-xs rounded-2xl border border-amber-200/80 bg-white/95 px-4 py-3 text-sm leading-relaxed text-stone-600 shadow-lg"
    >
      {{ ambientBubble }}
    </div>

    <button
      type="button"
      class="pointer-events-auto absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-100 text-3xl shadow-lg shadow-amber-500/20 transition hover:scale-105"
      :aria-label="sheetViewModel?.sheetTitle"
      @click="openSheet"
    >
      {{ speciesEmoji }}
    </button>

    <div
      v-if="sheetOpen && sheetViewModel"
      class="pointer-events-auto fixed inset-0 z-[10001] flex items-end bg-slate-900/35"
      @click="closeSheet"
    >
      <section
        class="max-h-[72vh] w-full overflow-y-auto rounded-t-3xl bg-amber-50 px-5 pb-6 pt-4 shadow-2xl"
        @click.stop
      >
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-amber-900">{{ sheetViewModel.sheetTitle }}</h2>
          <button
            type="button"
            class="rounded-lg px-2 py-1 text-2xl leading-none text-stone-400 hover:text-stone-600"
            @click="closeSheet"
          >
            ×
          </button>
        </div>

        <div class="mt-4 flex items-center gap-3">
          <span class="text-4xl">{{ sheetViewModel.speciesEmoji }}</span>
          <div>
            <p class="text-sm font-semibold text-amber-950">{{ sheetViewModel.nickname }}</p>
            <p class="text-xs text-amber-700">
              {{ sheetViewModel.personalityLabel }} · {{ sheetViewModel.levelLabel }} ·
              {{ sheetViewModel.moodLabel }}
            </p>
          </div>
        </div>

        <div class="mt-4 border-t border-amber-100/80 pt-4">
          <p class="text-xs font-semibold text-amber-900">{{ sheetViewModel.memoryTitle }}</p>
          <p
            v-if="sheetViewModel.hasMemories && sheetViewModel.memorySummary"
            class="mt-1 text-sm leading-relaxed text-stone-600"
          >
            {{ sheetViewModel.memorySummary }}
          </p>
          <p v-else-if="!sheetViewModel.hasMemories" class="mt-1 text-sm leading-relaxed text-stone-500">
            {{ sheetViewModel.emptyMemoryText }}
          </p>
          <ul v-if="sheetViewModel.recallItems.length" class="mt-3 space-y-2">
            <li
              v-for="(item, index) in sheetViewModel.recallItems"
              :key="`${item.content}-${index}`"
              class="rounded-xl bg-white/85 px-3 py-2"
            >
              <p class="text-sm text-stone-800">{{ item.content }}</p>
              <p class="mt-0.5 text-xs text-stone-400">{{ item.reason }}</p>
            </li>
          </ul>
        </div>

        <button
          type="button"
          class="mt-5 w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:from-amber-600 hover:to-orange-700"
          @click="goPlan"
        >
          {{ sheetViewModel.goPlanLabel }}
        </button>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-full border border-amber-300/60 bg-white/90 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50"
            @click="goMemoryWall"
          >
            {{ sheetViewModel.viewMemoryWallLabel }}
          </button>
          <button
            type="button"
            class="rounded-full border border-amber-300/60 bg-white/90 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50"
            @click="triggerPrePlanAnalyze"
          >
            {{ sheetViewModel.analyzePrePlanLabel }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
