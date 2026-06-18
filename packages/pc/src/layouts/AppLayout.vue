<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="min-h-0 flex-1">
      <router-view />
    </main>
    <TravelPetFloatingLayer v-if="showPetFloating" />
    <BackToTop />
    <AppMessage />
    <AppDialogHost />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppDialogHost from '@/components/AppDialogHost.vue';
import AppHeader from '@/components/AppHeader.vue';
import AppMessage from '@/components/AppMessage.vue';
import BackToTop from '@/components/BackToTop.vue';
import TravelPetFloatingLayer from '@/components/TravelPetFloatingLayer.vue';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const userStore = useUserStore();

const showPetFloating = computed(() => {
  if (route.meta.hidePetFloating) return false;
  if (route.meta.petFloating !== true) return false;
  if (route.meta.requiresAuth && !userStore.token) return false;
  return true;
});
</script>
