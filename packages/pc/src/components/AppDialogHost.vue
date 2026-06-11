<template>
  <TransitionRoot appear :show="Boolean(state)" as="template">
    <Dialog as="div" class="relative z-[110]" @close="cancelAction">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="duration-200 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-150 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              v-if="state"
              class="w-full max-w-md rounded-2xl border border-dx-border bg-white p-6 shadow-xl"
            >
              <DialogTitle v-if="state.title" class="mb-2 text-lg font-semibold text-dx-text">
                {{ state.title }}
              </DialogTitle>
              <p class="text-sm leading-relaxed text-dx-muted">{{ state.content }}</p>
              <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="dx-btn-secondary" @click="cancelAction">
                  {{ state.cancelText }}
                </button>
                <button
                  type="button"
                  class="rounded-xl px-4 py-2 text-sm font-medium text-white transition"
                  :class="state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-dx-primary hover:opacity-90'"
                  @click="confirmAction"
                >
                  {{ state.confirmText }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { useAppDialog } from '@/composables/useAppDialog';

const { dialogState, confirmAction, cancelAction } = useAppDialog();
const state = computed(() => dialogState.value);
</script>
