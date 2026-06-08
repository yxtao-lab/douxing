<template>
  <div class="flex min-h-full flex-col">
    <AppHeader />
    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
</script>
