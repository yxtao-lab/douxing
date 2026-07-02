<script setup lang="ts">
import type { PlanPetFocusViewModel } from '@douxing/shared';

defineProps<{
  viewModel: PlanPetFocusViewModel;
}>();
</script>

<template>
  <section
    class="mb-3 flex shrink-0 items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 shadow-sm"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm"
      aria-hidden="true"
    >
      🦊
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-amber-900">
        {{ viewModel.nickname }}
        <span class="font-normal text-amber-700"> · {{ viewModel.personalityLabel }}</span>
      </p>
      <p v-if="viewModel.hasMemories" class="mt-0.5 truncate text-xs text-stone-500">
        {{ viewModel.memoryAppliedHint }}
      </p>
      <p v-else class="mt-0.5 truncate text-xs text-stone-400">
        {{ viewModel.emptyMemoryText }}
      </p>
    </div>
  </section>
</template>
