<template>
  <img
    src="/logo.png"
    :alt="t('app.name')"
    class="shrink-0 object-contain"
    :class="sizeClass"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '@/i18n/useLocale';

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    size: 'sm',
  },
);

const { t } = useLocale();

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'h-14 w-14';
  if (props.size === 'md') return 'h-12 w-12';
  return 'h-9 w-9';
});
</script>
