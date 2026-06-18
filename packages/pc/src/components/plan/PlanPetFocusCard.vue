<script setup lang="ts">
import type { PlanPetFocusViewModel } from '@douxing/shared';

defineProps<{
  viewModel: PlanPetFocusViewModel;
}>();
</script>

<template>
  <section
    class="mb-3 shrink-0 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3 shadow-sm"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm"
        aria-hidden="true"
      >
        🦊
      </div>
      <div>
        <p class="text-sm font-semibold text-amber-900">{{ viewModel.nickname }}</p>
        <p class="text-xs text-amber-700">{{ viewModel.personalityLabel }}</p>
      </div>
    </div>

    <div class="mt-3 border-t border-amber-100/80 pt-3">
      <p class="text-xs font-semibold text-amber-900">{{ viewModel.memoryTitle }}</p>
      <p v-if="viewModel.hasMemories && viewModel.memorySummary" class="mt-1 text-sm leading-relaxed text-stone-600">
        {{ viewModel.memorySummary }}
      </p>
      <p v-else-if="!viewModel.hasMemories" class="mt-1 text-sm leading-relaxed text-stone-500">
        {{ viewModel.emptyMemoryText }}
      </p>
      <ul v-if="viewModel.recallItems.length" class="mt-2 space-y-2">
        <li
          v-for="(item, index) in viewModel.recallItems"
          :key="`${item.content}-${index}`"
          class="rounded-xl bg-white/80 px-3 py-2"
        >
          <p class="text-sm text-stone-800">{{ item.content }}</p>
          <p class="mt-0.5 text-xs text-stone-400">{{ item.reason }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
