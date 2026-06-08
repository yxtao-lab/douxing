<template>
  <div class="mx-auto max-w-4xl px-4 py-6 lg:max-w-5xl lg:px-8">
    <div class="mb-6">
      <RouterLink
        :to="backTo ?? { name: 'profile' }"
        class="mb-3 inline-flex items-center text-sm text-dx-primary hover:underline"
      >
        ← {{ backLabel }}
      </RouterLink>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-dx-text">{{ title }}</h1>
          <p v-if="description" class="mt-1 text-sm text-dx-muted">{{ description }}</p>
        </div>
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

defineProps<{
  title: string;
  description?: string;
  backTo?: RouteLocationRaw;
  backLabel: string;
}>();
</script>
