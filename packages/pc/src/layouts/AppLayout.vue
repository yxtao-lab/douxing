<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="min-h-0 flex-1">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
</script>
