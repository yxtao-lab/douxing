<template>
  <view class="page" :class="themeClass">
    <view class="hero">
      <view class="hero-bg" />
      <text class="hero-title">{{ t('personalization.onboarding.title') }}</text>
      <text class="hero-step">{{ stepLabel }}</text>
    </view>

    <view class="page-body">
      <!-- Step 1: gender + ageRange -->
      <view v-if="step === 1" class="card">
        <text class="card-title">{{ t('personalization.onboarding.step1Title') }}</text>
        <text class="card-hint">{{ t('personalization.onboarding.step1Hint') }}</text>

        <text class="field-label">{{ t('personalization.onboarding.genderLabel') }}</text>
        <view class="chips">
          <text
            v-for="g in genderPresets"
            :key="g"
            class="chip"
            :class="{ active: form.gender === g }"
            @click="form.gender = g"
          >
            {{ formatGenderLabel(g, locale) }}
          </text>
        </view>

        <text class="field-label">{{ t('personalization.onboarding.ageRangeLabel') }}</text>
        <view class="chips">
          <text
            v-for="a in ageRangePresets"
            :key="a"
            class="chip"
            :class="{ active: form.ageRange === a }"
            @click="form.ageRange = a"
          >
            {{ formatAgeRangeLabel(a, locale) }}
          </text>
        </view>
      </view>

      <!-- Step 2: travelRadius -->
      <view v-else-if="step === 2" class="card">
        <text class="card-title">{{ t('personalization.onboarding.step2Title') }}</text>
        <text class="card-hint">{{ t('personalization.onboarding.step2Hint') }}</text>
        <view class="chips">
          <text
            v-for="r in travelRadiusPresets"
            :key="r"
            class="chip"
            :class="{ active: form.travelRadius === r }"
            @click="form.travelRadius = r"
          >
            {{ formatTravelRadiusLabel(r, locale) }}
          </text>
        </view>
      </view>

      <!-- Step 3: preferredScenes + optional more -->
      <view v-else class="card">
        <text class="card-title">{{ t('personalization.onboarding.step3Title') }}</text>
        <text class="card-hint">{{ t('personalization.onboarding.step3Hint') }}</text>
        <view class="chips">
          <text
            v-for="s in sceneTagPresets"
            :key="s"
            class="chip"
            :class="{ active: form.preferredScenes.includes(s) }"
            @click="toggleScene(s)"
          >
            {{ formatSceneTagLabel(s, locale) }}
          </text>
        </view>

        <view class="more-toggle" @click="showMore = !showMore">
          <text>
            {{
              showMore
                ? t('personalization.onboarding.moreCollapse')
                : t('personalization.onboarding.moreExpand')
            }}
          </text>
        </view>

        <view v-if="showMore" class="more-block">
          <text class="field-label">{{ t('personalization.onboarding.interestLabel') }}</text>
          <view class="chips">
            <text
              v-for="tag in interestPresets"
              :key="tag"
              class="chip"
              :class="{ active: form.interestTags.includes(tag) }"
              @click="toggleInterest(tag)"
            >
              {{ formatInterestTagLabel(tag, locale) }}
            </text>
          </view>

          <text class="field-label">{{ t('personalization.onboarding.companionLabel') }}</text>
          <view class="chips">
            <text
              v-for="c in companionStructurePresets"
              :key="c"
              class="chip"
              :class="{ active: form.companionStructure.includes(c) }"
              @click="toggleCompanion(c)"
            >
              {{ formatCompanionStructureLabel(c, locale) }}
            </text>
          </view>

          <text class="field-label">{{ t('personalization.onboarding.budgetLabel') }}</text>
          <view class="chips">
            <text
              v-for="b in budgetTierPresets"
              :key="b"
              class="chip"
              :class="{ active: form.budgetTier === b }"
              @click="form.budgetTier = form.budgetTier === b ? null : b"
            >
              {{ formatBudgetTierLabel(b, locale) }}
            </text>
          </view>
        </view>
      </view>

      <view class="actions">
        <button v-if="step > 1" class="btn ghost" :disabled="saving" @click="step -= 1">
          {{ t('personalization.onboarding.back') }}
        </button>
        <button class="btn ghost" :disabled="saving" @click="handleSkipAll">
          {{ t('personalization.onboarding.skipAll') }}
        </button>
        <button
          v-if="step < 3"
          class="btn primary"
          :disabled="saving"
          @click="step += 1"
        >
          {{ t('personalization.onboarding.next') }}
        </button>
        <button
          v-else
          class="btn primary"
          :loading="saving"
          :disabled="saving"
          @click="handleFinish(false)"
        >
          {{ t('personalization.onboarding.finish') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import {
  genderPresets,
  ageRangePresets,
  travelRadiusPresets,
  companionStructurePresets,
  budgetTierPresets,
  sceneTagPresets,
  formatGenderLabel,
  formatAgeRangeLabel,
  formatTravelRadiusLabel,
  formatCompanionStructureLabel,
  formatBudgetTierLabel,
  formatSceneTagLabel,
  formatInterestTagLabel,
  interestTagPresets,
  USER_INTEREST_MAX,
} from '@douxing/shared';
import { completeOnboarding } from '@/api/user';
import { getAppErrorMessage } from '@/utils/request';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useLocale } from '@/i18n/useLocale';

const { t, tf } = useTf();
const { themeClass } = useTheme();
const { currentLocale: locale } = useLocale();
usePageTitle('nav.onboarding');

const step = ref(1);
const saving = ref(false);
const showMore = ref(false);
const interestPresets = interestTagPresets;

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
  tf('personalization.onboarding.stepOf', { current: step.value, total: 3 }),
);

/**
 * 切换场景标签多选。
 *
 * @param slug - 场景 slug
 */
function toggleScene(slug: string) {
  const idx = form.preferredScenes.indexOf(slug);
  if (idx >= 0) form.preferredScenes.splice(idx, 1);
  else form.preferredScenes.push(slug);
}

/**
 * 切换兴趣标签多选（受 USER_INTEREST_MAX 限制）。
 *
 * @param tag - 兴趣标签中文值
 */
function toggleInterest(tag: string) {
  const idx = form.interestTags.indexOf(tag);
  if (idx >= 0) {
    form.interestTags.splice(idx, 1);
    return;
  }
  if (form.interestTags.length >= USER_INTEREST_MAX) {
    uni.showToast({
      title: tf('profileEdit.maxTagsToast', { max: USER_INTEREST_MAX }),
      icon: 'none',
    });
    return;
  }
  form.interestTags.push(tag);
}

/**
 * 切换同伴结构多选。
 *
 * @param slug - 同伴结构 slug
 */
function toggleCompanion(slug: string) {
  const idx = form.companionStructure.indexOf(slug);
  if (idx >= 0) form.companionStructure.splice(idx, 1);
  else form.companionStructure.push(slug);
}

/**
 * 提交引导结果并跳转首页。
 *
 * @param skipped - 是否整页跳过（用默认值）
 */
async function handleFinish(skipped: boolean) {
  saving.value = true;
  try {
    await completeOnboarding(
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
    if (skipped) {
      uni.showToast({
        title: t('personalization.onboarding.defaultHint'),
        icon: 'none',
        duration: 2000,
      });
    }
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, skipped ? 600 : 300);
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('personalization.onboarding.saveFailed')),
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

/** 全部跳过：服务端填默认值并完成引导 */
function handleSkipAll() {
  void handleFinish(true);
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 80rpx;
}

.hero {
  position: relative;
  padding: 80rpx 40rpx 48rpx;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--dx-primary), var(--dx-primary-light));
  opacity: 0.95;
}

.hero-title,
.hero-step {
  position: relative;
  display: block;
  color: #fff;
}

.hero-title {
  font-size: 40rpx;
  font-weight: 700;
}

.hero-step {
  margin-top: 12rpx;
  font-size: 26rpx;
  opacity: 0.9;
}

.page-body {
  padding: 0 32rpx;
  margin-top: -24rpx;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--dx-text);
}

.card-hint {
  display: block;
  margin-top: 8rpx;
  margin-bottom: 28rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary, #6b7280);
}

.field-label {
  display: block;
  margin: 24rpx 0 16rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary, #6b7280);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  background: var(--dx-bg, #f5f7fa);
  color: var(--dx-text);
  border: 2rpx solid transparent;
}

.chip.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  border-color: var(--dx-primary-light);
  font-weight: 600;
}

.more-toggle {
  margin-top: 32rpx;
  padding: 16rpx 0;
  color: var(--dx-primary);
  font-size: 26rpx;
}

.more-block {
  margin-top: 8rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 40rpx;
}

.btn {
  flex: 1;
  min-width: 160rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
}

.btn.primary {
  background: var(--dx-primary);
  color: #fff;
}

.btn.ghost {
  background: #fff;
  color: var(--dx-text);
  border: 2rpx solid var(--dx-border, #e5e7eb);
}

.btn::after {
  border: none;
}
</style>
