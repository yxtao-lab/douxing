<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="min-h-0 flex-1">
      <router-view />
    </main>
    <BackToTop />
    <AppMessage />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
import AppMessage from '@/components/AppMessage.vue';
import BackToTop from '@/components/BackToTop.vue';
</script>
