<template>
  <div class="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 py-4 lg:px-8">
    <header class="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-dx-text">{{ t('plan.title') }}</h1>
        <p v-if="!sessionId && messages.length === 0" class="mt-1 text-sm text-dx-muted">
          {{ t('plan.desc') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="previousSessionId && !sessionId"
          type="button"
          class="text-sm text-dx-primary hover:underline"
          @click="restorePreviousSession"
        >
          {{ t('plan.backToChat') }}
        </button>
        <button
          v-if="sessionId"
          type="button"
          class="dx-btn-secondary !px-3 !py-1.5 text-xs"
          :disabled="aiPlanning"
          @click="startNewSession"
        >
          {{ t('plan.newSession') }}
        </button>
      </div>
    </header>

    <div v-if="intentSummary" class="mb-3 shrink-0 rounded-xl bg-dx-primary-light px-4 py-2 text-sm">
      <span class="font-medium text-dx-primary">{{ t('plan.intentLabel') }}：</span>
      <span class="text-dx-text">{{ intentSummary }}{{ intentBarExtra }}</span>
    </div>

    <PlanPetFocusCard v-if="petFocus" :view-model="petFocus" />

    <div v-if="membershipHint" class="mb-3 shrink-0 text-xs text-dx-muted">{{ membershipHint }}</div>

    <div
      v-if="appendLockedHint"
      class="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <span>{{ appendLockedHint }}</span>
      <button type="button" class="font-medium text-dx-primary hover:underline" @click="goMembership">
        {{ t('pc.nav.profile') }}
      </button>
    </div>

    <div
      v-if="llmIssueMessage"
      class="mb-3 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      {{ llmIssueMessage }}
    </div>

    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
      <!-- 左侧：对话 -->
      <section class="flex min-h-0 flex-col rounded-2xl border border-dx-border bg-white shadow-card">
        <div
          v-if="!sessionId && messages.length === 0"
          class="shrink-0 border-b border-dx-border p-4"
        >
          <label v-if="showModelPicker" class="mb-3 block">
            <span class="mb-1 block text-xs text-dx-muted">{{ t('plan.selectModel') }}</span>
            <select
              class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm"
              :disabled="!!sessionId || aiPlanning"
              :value="provider"
              @change="onProviderChange"
            >
              <option
                v-for="opt in providerOptions"
                :key="opt.id"
                :value="opt.id"
                :disabled="!opt.available"
              >
                {{ opt.available ? resolveProviderLabel(opt) : `${resolveProviderLabel(opt)}${t('plan.providerNotConfigured')}` }}
              </option>
            </select>
          </label>
          <p class="mb-2 text-xs font-medium text-dx-muted">{{ t('plan.quickPromptsTitle') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in quickPrompts"
              :key="item"
              type="button"
              class="rounded-full bg-dx-primary-light px-3 py-1 text-xs text-dx-primary transition hover:bg-dx-primary/10"
              @click="applyQuickPrompt(item)"
            >
              {{ item }}
            </button>
          </div>
        </div>

        <div ref="chatScrollRef" class="min-h-0 flex-1 overflow-y-auto p-4">
          <div v-if="messages.length === 0 && !sessionId" class="py-8 text-center text-sm text-dx-muted">
            {{ t('plan.placeholderNew') }}
          </div>
          <div v-for="msg in messages" :id="`msg-${msg.id}`" :key="msg.id" class="mb-4 flex gap-2">
            <div
              v-if="msg.role === 'assistant'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dx-primary text-xs text-white"
            >
              AI
            </div>
            <div v-else class="w-8 shrink-0" />
            <div
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              :class="
                msg.role === 'user'
                  ? 'ml-auto bg-dx-primary text-white'
                  : 'bg-dx-bg text-dx-text'
              "
            >
              {{ msg.content }}
            </div>
            <div
              v-if="msg.role === 'user'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dx-accent text-xs font-medium text-white"
            >
              {{ userAvatarText }}
            </div>
            <div v-else class="w-8 shrink-0" />
          </div>
          <div :id="scrollAnchor || undefined" />
        </div>

        <div class="shrink-0 border-t border-dx-border p-4">
          <div v-if="recentPrompts.length" class="mb-3">
            <p class="mb-2 text-xs font-medium text-dx-muted">{{ t('plan.recentPromptsTitle') }}</p>
            <div class="flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="item in recentPrompts"
                :key="`recent-dock-${item}`"
                type="button"
                class="shrink-0 rounded-full border border-dx-border bg-white px-3 py-1 text-xs text-dx-text transition hover:border-dx-primary hover:text-dx-primary"
                :title="item"
                @click="applyQuickPrompt(item)"
              >
                {{ recentPromptLabel(item) }}
              </button>
            </div>
          </div>
          <form class="flex gap-2" @submit.prevent="handleSend">
            <textarea
              v-model="inputText"
              rows="2"
              class="min-h-[44px] flex-1 resize-none rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="composerPlaceholder"
              :disabled="composerLocked"
              @keydown.enter.exact.prevent="handleSend"
            />
            <button
              type="submit"
              class="dx-btn-primary shrink-0 self-end !px-4"
              :disabled="composerLocked || aiPlanning"
            >
              {{ t('plan.composerSend') }}
            </button>
          </form>
        </div>
      </section>

      <!-- 右侧：方案预览 -->
      <section
        id="route-preview"
        class="flex min-h-0 flex-col rounded-2xl border border-dx-border bg-white shadow-card"
      >
        <div class="shrink-0 border-b border-dx-border px-4 py-3">
          <h2 class="font-semibold text-dx-text">{{ t('plan.previewTitle') }}</h2>
          <p class="text-xs text-dx-muted">{{ t('plan.previewDesc') }}</p>
        </div>

        <div v-if="candidates.length > 1" class="shrink-0 border-b border-dx-border p-3">
          <div class="grid gap-2" :class="candidates.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'">
            <button
              v-for="item in candidates"
              :key="item.routeId"
              type="button"
              class="rounded-xl border p-3 text-left transition"
              :class="
                item.isSelected
                  ? 'border-dx-primary bg-dx-primary-light'
                  : 'border-dx-border hover:border-dx-primary/40'
              "
              :disabled="aiPlanning"
              @click="handleSelectCandidate(item)"
            >
              <p class="text-xs font-medium text-dx-primary">{{ candidateLabel(item) }}</p>
              <p class="mt-1 line-clamp-1 font-semibold text-dx-text">
                {{ item.route?.name || t('plan.routePlanFallback') }}
              </p>
              <p class="mt-0.5 text-xs text-dx-muted">
                {{ formatRouteDays(item.route?.days) }}
                <span v-if="item.route?.budgetRange"> · {{ item.route.budgetRange }}</span>
              </p>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <template v-if="currentRoute">
            <div class="mb-4">
              <h3 class="text-lg font-semibold text-dx-text">{{ currentRoute.name }}</h3>
              <p v-if="currentRoute.description" class="mt-1 text-sm text-dx-muted">
                {{ currentRoute.description }}
              </p>
              <p class="mt-2 text-xs text-dx-muted">
                {{ formatRouteDays(currentRoute.days) }}
                <span v-if="currentRoute.budgetRange"> · {{ currentRoute.budgetRange }}</span>
              </p>
            </div>

            <div v-if="previewDays.length" class="space-y-4">
              <div
                v-for="(day, index) in previewDays"
                :key="index"
                class="rounded-xl border border-dx-border bg-dx-bg/50 p-3"
              >
                <p class="mb-2 text-sm font-medium text-dx-text">
                  {{ dayHeading(index, day.title) }}
                </p>
                <ul class="space-y-1.5">
                  <li
                    v-for="(spot, spotIndex) in day.attractions"
                    :key="spotIndex"
                    class="flex items-start gap-2 text-sm text-dx-text"
                  >
                    <span class="mt-0.5 text-dx-muted">·</span>
                    <span>{{ spot.name }}</span>
                  </li>
                </ul>
                <p v-if="day.lodging?.name" class="mt-2 text-xs text-dx-muted">
                  🏨 {{ day.lodging.name }}
                </p>
              </div>
            </div>
            <p v-else class="text-sm text-dx-muted">{{ t('plan.previewEmptyDays') }}</p>

            <button
              v-if="currentRouteId"
              type="button"
              class="dx-btn-primary mt-4 w-full"
              @click="openRouteDetail"
            >
              {{ t('plan.routeDetail') }}
            </button>
          </template>

          <div v-else class="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-dx-muted">
            <p class="text-3xl">🗺️</p>
            <p class="mt-3">{{ t('plan.previewEmpty') }}</p>
          </div>
        </div>
      </section>
    </div>

    <AiPlanBlockingOverlay />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import AiPlanBlockingOverlay from '@/components/AiPlanBlockingOverlay.vue';
import PlanPetFocusCard from '@/components/plan/PlanPetFocusCard.vue';
import { usePlanPage } from '@/composables/usePlanPage';
import { useLocale } from '@/i18n/useLocale';
import type { LlmProviderOption } from '@douxing/shared';
import { LlmProvider } from '@douxing/shared';

const { t } = useLocale();
const chatScrollRef = ref<HTMLElement | null>(null);

const plan = usePlanPage();
const {
  inputText,
  sessionId,
  previousSessionId,
  currentRouteId,
  currentRoute,
  messages,
  candidates,
  intentSummary,
  intentBarExtra,
  petFocus,
  membershipHint,
  appendLockedHint,
  llmIssueMessage,
  scrollAnchor,
  aiPlanning,
  showModelPicker,
  provider,
  providerOptions,
  quickPrompts,
  recentPrompts,
  composerLocked,
  composerPlaceholder,
  previewDays,
  userAvatarText,
  formatRouteDays,
  candidateLabel,
  dayHeading,
  startNewSession,
  restorePreviousSession,
  handleSelectCandidate,
  handleSend,
  onProviderChange,
  applyQuickPrompt,
  recentPromptLabel,
  goMembership,
  openRouteDetail,
} = plan;

function resolveProviderLabel(opt: LlmProviderOption): string {
  if (opt.id === LlmProvider.AUTO) return t('plan.providerAuto');
  if (opt.id === LlmProvider.LMSTUDIO) return t('plan.providerLmstudio');
  if (opt.id === LlmProvider.DEEPSEEK) {
    const modelMatch = opt.label.match(/[（(]([^）)]+)[）)]/);
    const model = modelMatch?.[1] ?? opt.label;
    return t('plan.providerDeepseek', { model });
  }
  return opt.label;
}

watch(scrollAnchor, () => {
  nextTick(() => {
    if (!scrollAnchor.value) return;
    const el = document.getElementById(scrollAnchor.value);
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
});

watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (chatScrollRef.value) {
        chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
      }
    });
  },
);
</script>
