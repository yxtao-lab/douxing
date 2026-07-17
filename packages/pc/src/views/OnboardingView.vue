<template>
  <div class="mx-auto max-w-xl px-4 py-10">
    <div
      class="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-dx-primary to-dx-primary-light p-8 text-white shadow-lg"
    >
      <h1 class="text-2xl font-bold">{{ t('personalization.onboarding.title') }}</h1>
      <p class="mt-2 text-sm opacity-90">{{ stepLabel }}</p>
    </div>

    <div class="dx-card mb-6 space-y-4">
      <template v-if="step === 1">
        <h2 class="text-lg font-semibold text-dx-text">
          {{ t('personalization.onboarding.step1Title') }}
        </h2>
        <p class="text-sm text-dx-muted">{{ t('personalization.onboarding.step1Hint') }}</p>
        <p class="text-sm font-medium text-dx-muted">
          {{ t('personalization.onboarding.genderLabel') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="g in genderPresets"
            :key="g"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="chipClass(form.gender === g)"
            @click="form.gender = g"
          >
            {{ formatGenderLabel(g, currentLocale) }}
          </button>
        </div>
        <p class="text-sm font-medium text-dx-muted">
          {{ t('personalization.onboarding.ageRangeLabel') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="a in ageRangePresets"
            :key="a"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="chipClass(form.ageRange === a)"
            @click="form.ageRange = a"
          >
            {{ formatAgeRangeLabel(a, currentLocale) }}
          </button>
        </div>
      </template>

      <template v-else-if="step === 2">
        <h2 class="text-lg font-semibold text-dx-text">
          {{ t('personalization.onboarding.step2Title') }}
        </h2>
        <p class="text-sm text-dx-muted">{{ t('personalization.onboarding.step2Hint') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in travelRadiusPresets"
            :key="r"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="chipClass(form.travelRadius === r)"
            @click="form.travelRadius = r"
          >
            {{ formatTravelRadiusLabel(r, currentLocale) }}
          </button>
        </div>
      </template>

      <template v-else>
        <h2 class="text-lg font-semibold text-dx-text">
          {{ t('personalization.onboarding.step3Title') }}
        </h2>
        <p class="text-sm text-dx-muted">{{ t('personalization.onboarding.step3Hint') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in sceneTagPresets"
            :key="s"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="chipClass(form.preferredScenes.includes(s))"
            @click="toggleScene(s)"
          >
            {{ formatSceneTagLabel(s, currentLocale) }}
          </button>
        </div>

        <button
          type="button"
          class="text-sm text-dx-primary hover:underline"
          @click="showMore = !showMore"
        >
          {{
            showMore
              ? t('personalization.onboarding.moreCollapse')
              : t('personalization.onboarding.moreExpand')
          }}
        </button>

        <div v-if="showMore" class="space-y-4 border-t border-dx-border pt-4">
          <p class="text-sm font-medium text-dx-muted">
            {{ t('personalization.onboarding.interestLabel') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in interestTagPresets"
              :key="tag"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm transition"
              :class="chipClass(form.interestTags.includes(tag))"
              @click="toggleInterest(tag)"
            >
              {{ formatInterestTagLabel(tag, currentLocale) }}
            </button>
          </div>
          <p class="text-sm font-medium text-dx-muted">
            {{ t('personalization.onboarding.companionLabel') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in companionStructurePresets"
              :key="c"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm transition"
              :class="chipClass(form.companionStructure.includes(c))"
              @click="toggleCompanion(c)"
            >
              {{ formatCompanionStructureLabel(c, currentLocale) }}
            </button>
          </div>
          <p class="text-sm font-medium text-dx-muted">
            {{ t('personalization.onboarding.budgetLabel') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in budgetTierPresets"
              :key="b"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm transition"
              :class="chipClass(form.budgetTier === b)"
              @click="form.budgetTier = form.budgetTier === b ? null : b"
            >
              {{ formatBudgetTierLabel(b, currentLocale) }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        v-if="step > 1"
        type="button"
        class="dx-btn-secondary flex-1"
        :disabled="saving"
        @click="step -= 1"
      >
        {{ t('personalization.onboarding.back') }}
      </button>
      <button
        type="button"
        class="dx-btn-secondary flex-1"
        :disabled="saving"
        @click="handleFinish(true)"
      >
        {{ t('personalization.onboarding.skipAll') }}
      </button>
      <button
        v-if="step < 3"
        type="button"
        class="dx-btn-primary flex-1"
        :disabled="saving"
        @click="step += 1"
      >
        {{ t('personalization.onboarding.next') }}
      </button>
      <button
        v-else
        type="button"
        class="dx-btn-primary flex-1"
        :disabled="saving"
        @click="handleFinish(false)"
      >
        {{ saving ? t('personalization.onboarding.saving') : t('personalization.onboarding.finish') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  genderPresets,
  ageRangePresets,
  travelRadiusPresets,
  companionStructurePresets,
  budgetTierPresets,
  sceneTagPresets,
  interestTagPresets,
  USER_INTEREST_MAX,
  formatGenderLabel,
  formatAgeRangeLabel,
  formatTravelRadiusLabel,
  formatCompanionStructureLabel,
  formatBudgetTierLabel,
  formatSceneTagLabel,
  formatInterestTagLabel,
} from '@douxing/shared';
import { completeOnboarding } from '@/api/user';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t, currentLocale } = useLocale();

const step = ref(1);
const saving = ref(false);
const showMore = ref(false);

const form = reactive({
  gender: null as string | null,
  ageRange: null as string | null,
  travelRadius: null as string | null,
  preferredScenes: [] as string[],
  interestTags: [] as string[],
  companionStructure: [] as string[],
  budgetTier: null as string | null,
});

const stepLabel = computed(() =>
  t('personalization.onboarding.stepOf', { current: step.value, total: 3 }),
);

/**
 * Chip 选中态样式类。
 *
 * @param active - 是否选中
 * @returns Tailwind class 字符串
 */
function chipClass(active: boolean): string {
  return active
    ? 'bg-dx-primary text-white'
    : 'bg-gray-100 text-dx-muted hover:bg-gray-200';
}

/**
 * 切换场景标签。
 *
 * @param slug - 场景 slug
 */
function toggleScene(slug: string) {
  const idx = form.preferredScenes.indexOf(slug);
  if (idx >= 0) form.preferredScenes.splice(idx, 1);
  else form.preferredScenes.push(slug);
}

/**
 * 切换兴趣标签。
 *
 * @param tag - 兴趣标签
 */
function toggleInterest(tag: string) {
  const idx = form.interestTags.indexOf(tag);
  if (idx >= 0) {
    form.interestTags.splice(idx, 1);
    return;
  }
  if (form.interestTags.length >= USER_INTEREST_MAX) {
    appMessage.warning(t('profileEdit.maxTagsToast', { max: USER_INTEREST_MAX }));
    return;
  }
  form.interestTags.push(tag);
}

/**
 * 切换同伴结构。
 *
 * @param slug - 同伴 slug
 */
function toggleCompanion(slug: string) {
  const idx = form.companionStructure.indexOf(slug);
  if (idx >= 0) form.companionStructure.splice(idx, 1);
  else form.companionStructure.push(slug);
}

/**
 * 提交引导并跳转原 redirect 或首页。
 *
 * @param skipped - 是否整页跳过
 */
async function handleFinish(skipped: boolean) {
  saving.value = true;
  try {
    const user = await completeOnboarding(
      skipped
        ? { skipped: true }
        : {
            gender: form.gender,
            ageRange: form.ageRange,
            travelRadius: form.travelRadius,
            preferredScenes: form.preferredScenes,
            interestTags: form.interestTags.length ? form.interestTags : null,
            companionStructure: form.companionStructure.length
              ? form.companionStructure
              : null,
            budgetTier: form.budgetTier,
          },
    );
    if (userStore.token) userStore.setAuth(userStore.token, user);
    if (skipped) {
      appMessage.info(t('personalization.onboarding.defaultHint'));
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.replace(redirect === '/onboarding' ? '/' : redirect);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('personalization.onboarding.saveFailed')));
  } finally {
    saving.value = false;
  }
}
</script>
