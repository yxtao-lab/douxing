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
          class="app-message-item pointer-events-auto flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur"
          :class="typeClass(item.type)"
          role="status"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            :class="iconWrapClass(item.type)"
            aria-hidden="true"
          >
            <svg
              v-if="item.type === 'success'"
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M5 10.5 8.5 14 15 7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-else-if="item.type === 'error'"
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M10 6v5M10 14h.01"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <svg
              v-else-if="item.type === 'warning'"
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M10 6v4M10 14h.01M4.5 16h11L10 4 4.5 16Z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-else
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M10 13V9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle cx="10" cy="6.5" r="1.1" fill="currentColor" />
            </svg>
          </span>
          <p class="min-w-0 flex-1 font-medium leading-relaxed">{{ item.content }}</p>
          <button
            type="button"
            class="shrink-0 rounded-md p-0.5 text-current opacity-50 transition hover:bg-black/5 hover:opacity-100"
            :aria-label="t('common.cancel')"
            @click="removeMessage(item.id)"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="m6 6 8 8M14 6l-8 8"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
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
    return 'border-emerald-300/90 bg-emerald-50/98 text-emerald-900';
  }
  if (type === 'error') {
    return 'border-red-300/90 bg-red-50/98 text-red-900';
  }
  if (type === 'warning') {
    return 'border-amber-300/90 bg-amber-50/98 text-amber-950';
  }
  return 'border-dx-primary/45 bg-dx-primary-light/95 text-dx-text';
}

function iconWrapClass(type: AppMessageType): string {
  if (type === 'success') return 'bg-emerald-500 text-white';
  if (type === 'error') return 'bg-red-500 text-white';
  if (type === 'warning') return 'bg-amber-500 text-white';
  return 'bg-dx-primary text-white';
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
