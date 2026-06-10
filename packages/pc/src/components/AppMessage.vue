<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed left-1/2 top-6 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      <TransitionGroup name="app-message">
        <div
          v-for="item in messages"
          :key="item.id"
          class="app-message-item pointer-events-auto flex w-full items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur"
          :class="typeClass(item.type)"
          role="status"
        >
          <span class="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
            {{ typeIcon(item.type) }}
          </span>
          <p class="min-w-0 flex-1 leading-relaxed">{{ item.content }}</p>
          <button
            type="button"
            class="shrink-0 text-current opacity-60 transition hover:opacity-100"
            :aria-label="t('common.cancel')"
            @click="removeMessage(item.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useAppMessage, type AppMessageType } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';

const { messages, removeMessage } = useAppMessage();
const { t } = useLocale();

function typeClass(type: AppMessageType): string {
  if (type === 'success') {
    return 'border-emerald-200/80 bg-emerald-50/95 text-emerald-800';
  }
  if (type === 'error') {
    return 'border-red-200/80 bg-red-50/95 text-red-800';
  }
  if (type === 'warning') {
    return 'border-amber-200/80 bg-amber-50/95 text-amber-900';
  }
  return 'border-dx-primary/25 bg-white/95 text-dx-text';
}

function typeIcon(type: AppMessageType): string {
  if (type === 'success') return '✓';
  if (type === 'error') return '!';
  if (type === 'warning') return '⚠';
  return 'ℹ';
}
</script>

<style scoped>
.app-message-enter-active,
.app-message-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.app-message-enter-from,
.app-message-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.app-message-move {
  transition: transform 0.22s ease;
}
</style>
