<template>
  <view class="page" :class="themeClass">
    <view class="hero">
      <view class="hero-bg" />
      <view class="hero-inner">
        <text class="title">{{ t('routes.inspirationPageTitle') }}</text>
        <text class="desc">{{ t('routes.inspirationPageDesc') }}</text>
      </view>
    </view>

    <view class="form-card">
      <view class="field">
        <text class="label">{{ t('routes.editNameLabel') }}</text>
        <input
          v-model="form.name"
          class="input"
          maxlength="128"
          :placeholder="t('routes.nameInputPlaceholder')"
        />
      </view>
      <view class="field">
        <text class="label">{{ t('routes.editDescLabel') }}</text>
        <textarea
          v-model="form.description"
          class="textarea"
          maxlength="2000"
          :placeholder="t('routes.descInputPlaceholder')"
        />
      </view>
      <view class="field">
        <text class="label">{{ t('routes.inspirationDaysLabel') }}</text>
        <input
          v-model="form.days"
          class="input"
          type="number"
          :placeholder="t('routes.inspirationDaysLabel')"
        />
      </view>
      <view class="field">
        <text class="label">{{ t('routes.inspirationBudgetLabel') }}</text>
        <input
          v-model="form.budgetRange"
          class="input"
          maxlength="64"
          :placeholder="t('routes.inspirationBudgetPlaceholder')"
        />
      </view>
    </view>

    <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
      {{ submitting ? t('common.loading') : t('routes.inspirationSubmit') }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { createInspirationRoute } from '@/api/routes';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';

const { t } = useTf();
const { themeClass } = useTheme();
usePageTitle('routes.inspirationPageTitle');

const submitting = ref(false);
const form = reactive({
  name: '',
  description: '',
  days: '3',
  budgetRange: '',
});

/**
 * 提交灵感稿并跳转详情。
 */
async function handleSubmit() {
  const name = form.name.trim();
  if (!name) {
    uni.showToast({ title: t('routes.nameRequired'), icon: 'none' });
    return;
  }
  const days = Number(form.days);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    uni.showToast({ title: t('routes.inspirationFailed'), icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    const route = await createInspirationRoute({
      name,
      description: form.description.trim() || null,
      budgetRange: form.budgetRange.trim() || null,
      days,
      sourceKind: 'ugc_original',
    });
    uni.showToast({ title: t('routes.inspirationSuccess'), icon: 'success' });
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/routes/detail?id=${route.id}` });
    }, 400);
  } catch (e) {
    uni.showToast({
      title: getAppErrorMessage(e, t('routes.inspirationFailed')),
      icon: 'none',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}
.hero {
  position: relative;
  padding: 40rpx var(--page-gutter) 32rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--dx-primary-light), transparent);
}
.hero-inner {
  position: relative;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-text);
}
.desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  line-height: 1.5;
}
.form-card {
  margin: 0 var(--page-gutter);
  padding: 28rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.field + .field {
  margin-top: 28rpx;
}
.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  background: var(--dx-bg);
  color: var(--dx-text);
  font-size: 28rpx;
}
.textarea {
  min-height: 160rpx;
}
.submit-btn {
  margin: 40rpx var(--page-gutter) 0;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  font-size: 30rpx;
  font-weight: 600;
}
.submit-btn[disabled] {
  opacity: 0.6;
}
</style>
