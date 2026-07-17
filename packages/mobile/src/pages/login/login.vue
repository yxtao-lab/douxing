<template>
  <view class="login-page" :class="[themeClass, { 'login-page--register': isRegisterMode }]">
    <view class="login-hero">
      <view class="hero-bg" />
      <view class="hero-safe" :style="heroSafeStyle">
        <view class="hero-content">
          <view class="logo-mark">
            <text class="logo-text">兜</text>
          </view>
          <text class="brand-name">{{ t('app.name') }}</text>
          <text class="brand-sub">{{ t('home.subtitle') }}</text>
          <text class="hero-tagline">{{ heroTagline }}</text>
          <view class="hero-chips">
            <text v-for="item in valueProps" :key="item" class="hero-chip">{{ item }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="login-sheet">
      <view class="sheet-card" :class="{ 'sheet-card--register': isRegisterMode }">
        <text class="form-title">{{ formTitle }}</text>

        <view class="mode-tabs">
          <text
            class="mode-tab"
            :class="{ active: loginMode === 'sms' }"
            @click="loginMode = 'sms'"
          >
            {{ t('login.smsTab') }}
          </text>
          <text
            class="mode-tab"
            :class="{ active: loginMode === 'password' }"
            @click="loginMode = 'password'"
          >
            {{ t('login.passwordTab') }}
          </text>
        </view>

        <template v-if="loginMode === 'sms'">
          <view class="field">
            <text class="field-label">{{ t('login.phonePlaceholder') }}</text>
            <input
              v-model="phone"
              class="field-input"
              type="number"
              maxlength="11"
              :placeholder="t('login.phonePlaceholder')"
              placeholder-class="field-placeholder"
            />
          </view>
          <view class="field">
            <text class="field-label">{{ t('login.codePlaceholder') }}</text>
            <view class="code-row">
              <input
                v-model="smsCode"
                class="field-input code-input"
                type="number"
                maxlength="6"
                :placeholder="t('login.codePlaceholder')"
                placeholder-class="field-placeholder"
              />
              <button
                class="code-btn"
                :disabled="sendingCode || countdown > 0"
                @click="handleSendCode"
              >
                {{ codeButtonLabel }}
              </button>
            </view>
          </view>
          <text v-if="showDemoAccount && devCodeHint" class="dev-hint">{{ devCodeHintText }}</text>
          <button class="submit-btn" :loading="loading" @click="handleSmsLogin">
            {{ t('login.smsSubmit') }}
          </button>
          <text class="foot-hint">{{ t('login.smsHint') }}</text>
        </template>

        <template v-else>
          <view class="field">
            <text class="field-label">{{ t('login.usernamePlaceholder') }}</text>
            <input
              v-model="username"
              class="field-input"
              :placeholder="t('login.usernamePlaceholder')"
              placeholder-class="field-placeholder"
            />
          </view>
          <view class="field">
            <text class="field-label">{{ t('login.passwordPlaceholder') }}</text>
            <input
              v-model="password"
              class="field-input"
              password
              :placeholder="t('login.passwordPlaceholder')"
              placeholder-class="field-placeholder"
            />
          </view>
          <button class="submit-btn" :loading="loading" @click="handlePasswordSubmit">
            {{ isRegister ? t('common.register') : t('common.login') }}
          </button>
          <text class="switch-link" @click="isRegister = !isRegister">
            {{ isRegister ? t('login.toggleToLogin') : t('login.toggleToRegister') }}
          </text>
          <view v-if="showDemoAccount" class="demo-box">
            <text class="demo-label">{{ t('login.demoLabel') }}</text>
            <text class="demo-hint">{{ t('login.demoHint') }}</text>
          </view>
        </template>

        <view v-if="error" class="error-box">
          <text class="error-text">{{ error }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import type { LoginResult, UserInfo } from '@douxing/shared';
import { needsOnboarding } from '@douxing/shared';
import { request, setAuth, getAppErrorMessage } from '@/utils/request';
import { buildCustomNavTopPadding } from '@/utils/safe-area';
import { isDevelopmentExperienceEnabled } from '@/utils/build-env';
import { useTheme } from '@/i18n/useTheme';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
const { themeClass } = useTheme();
// 登录页使用 custom 导航栏，不展示系统标题栏与返回按钮

/**
 * 登录成功后跳转：未完成引导进引导页，否则进首页。
 *
 * @param user - 登录返回的用户信息
 */
function redirectAfterAuth(user: UserInfo) {
  const url = needsOnboarding(user.onboardedAt)
    ? '/pages/onboarding/guide'
    : '/pages/index/index';
  uni.reLaunch({ url });
}

const showDemoAccount = isDevelopmentExperienceEnabled();

const heroSafeStyle = computed(() => ({
  paddingTop: buildCustomNavTopPadding(32),
}));

type LoginMode = 'sms' | 'password';

const loginMode = ref<LoginMode>('sms');
const phone = ref('');
const smsCode = ref('');
const username = ref(showDemoAccount ? 'demo' : '');
const password = ref(showDemoAccount ? 'demo123' : '');
const loading = ref(false);
const sendingCode = ref(false);
const error = ref('');
const isRegister = ref(false);
const countdown = ref(0);
const devCodeHint = ref('');

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const valueProps = computed(() => [
  t('home.valueProp1'),
  t('home.valueProp2'),
  t('home.valueProp3'),
]);

const formTitle = computed(() =>
  isRegisterMode.value ? t('login.formTitleRegister') : t('login.formTitleLogin'),
);

const isRegisterMode = computed(() => loginMode.value === 'password' && isRegister.value);

const heroTagline = computed(() =>
  isRegisterMode.value ? t('login.heroRegisterSubtitle') : t('login.heroSubtitle'),
);

const codeButtonLabel = computed(() => {
  if (countdown.value > 0) {
    return tf('login.codeCountdown', { seconds: countdown.value });
  }
  if (sendingCode.value) return t('common.sending');
  return t('login.getCode');
});

const devCodeHintText = computed(() =>
  devCodeHint.value ? tf('login.devCodeHint', { code: devCodeHint.value }) : '',
);

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

function startCountdown(seconds = 60) {
  countdown.value = seconds;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

function validatePhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
}

async function handleSendCode() {
  error.value = '';
  devCodeHint.value = '';

  if (!validatePhone(phone.value)) {
    error.value = t('login.invalidPhone');
    return;
  }

  sendingCode.value = true;
  try {
    const data = await request<{ devCode?: string }>('/auth/sms/send', {
      method: 'POST',
      data: { phone: phone.value },
    });
    if (showDemoAccount && data.devCode) {
      devCodeHint.value = data.devCode;
    }
    uni.showToast({ title: t('login.smsSent'), icon: 'success' });
    startCountdown();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('login.sendFailed'));
  } finally {
    sendingCode.value = false;
  }
}

async function handleSmsLogin() {
  error.value = '';
  if (!validatePhone(phone.value)) {
    error.value = t('login.invalidPhone');
    return;
  }
  if (!/^\d{6}$/.test(smsCode.value)) {
    error.value = t('login.invalidCodeLength');
    return;
  }

  loading.value = true;
  try {
    const data = await request<LoginResult>('/auth/sms/login', {
      method: 'POST',
      data: { phone: phone.value, code: smsCode.value },
    });
    setAuth(data.token, data.user, data.refreshToken);
    uni.showToast({ title: t('login.loginSuccess'), icon: 'success' });
    setTimeout(() => {
      redirectAfterAuth(data.user);
    }, 500);
  } catch (e) {
    error.value = getAppErrorMessage(e, t('login.loginFailed'));
  } finally {
    loading.value = false;
  }
}

async function handlePasswordSubmit() {
  loading.value = true;
  error.value = '';
  try {
    const path = isRegister.value ? '/auth/register' : '/auth/login';
    const data = await request<LoginResult>(path, {
      method: 'POST',
      data: { username: username.value, password: password.value },
    });
    setAuth(data.token, data.user, data.refreshToken);
    uni.showToast({
      title: isRegister.value ? t('login.registerSuccess') : t('login.loginSuccess'),
      icon: 'success',
    });
    setTimeout(() => {
      redirectAfterAuth(data.user);
    }, 500);
  } catch (e) {
    error.value = getAppErrorMessage(e, t('common.operationFailed'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--dx-bg);
  display: flex;
  flex-direction: column;
}

.login-hero {
  position: relative;
  flex-shrink: 0;
  padding: 0 40rpx 64rpx;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 48rpx 48rpx;
  box-shadow: var(--dx-shadow-hero);
  transition: background 0.35s ease, box-shadow 0.35s ease;
}

.hero-safe {
  position: relative;
  z-index: 1;
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8rpx 16rpx 0;
}

.logo-mark {
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--dx-radius-xl);
  background: rgba(255, 255, 255, 0.22);
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.logo-text {
  font-size: 52rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
}

.brand-name {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  letter-spacing: 4rpx;
}

.brand-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
}

.hero-tagline {
  display: block;
  margin-top: 24rpx;
  max-width: 560rpx;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.95);
}

.hero-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx;
  margin-top: 24rpx;
  max-width: 620rpx;
}

.hero-chip {
  font-size: 22rpx;
  color: var(--dx-text-inverse);
  background: rgba(255, 255, 255, 0.16);
  border: 1rpx solid rgba(255, 255, 255, 0.26);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}

.login-sheet {
  flex: 1;
  margin-top: -40rpx;
  padding: 0 40rpx calc(40rpx + env(safe-area-inset-bottom));
  position: relative;
  z-index: 2;
  box-sizing: border-box;
}

.sheet-card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-xl);
  padding: 44rpx 40rpx 40rpx;
  box-shadow: var(--dx-shadow-md);
  border: 2rpx solid transparent;
  transition: border-color 0.35s ease;
}

.form-title {
  display: block;
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--dx-text);
  margin-bottom: 32rpx;
}

.mode-tabs {
  display: flex;
  gap: 12rpx;
  padding: 8rpx;
  margin-bottom: 32rpx;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-lg);
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  border-radius: var(--dx-radius-md);
  transition: background 0.2s;
}

.mode-tab.active {
  background: var(--dx-surface);
  color: var(--dx-primary);
  font-weight: 600;
  box-shadow: var(--dx-shadow-sm);
}

.field {
  margin-bottom: 24rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  font-weight: 500;
  color: var(--dx-text-secondary);
  margin-bottom: 12rpx;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  height: 88rpx;
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-md);
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--dx-text);
  background: var(--dx-surface);
}

.field-input:focus {
  border-color: var(--dx-primary);
}

.code-row {
  display: flex;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  flex-shrink: 0;
  min-width: 200rpx;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
  font-weight: 600;
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  border: none;
  border-radius: var(--dx-radius-md);
}

.code-btn::after {
  border: none;
}

.code-btn[disabled] {
  background: var(--dx-bg);
  color: var(--dx-text-muted);
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  margin-top: 8rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  font-size: 30rpx;
  font-weight: 600;
  border-radius: var(--dx-radius-lg);
  border: none;
  box-shadow: var(--dx-shadow-md);
  transition: background 0.35s ease, box-shadow 0.35s ease;
}

.submit-btn::after {
  border: none;
}

.foot-hint {
  display: block;
  text-align: center;
  color: var(--dx-text-muted);
  font-size: 22rpx;
  margin-top: 20rpx;
  line-height: 1.5;
}

.switch-link {
  display: block;
  text-align: center;
  color: var(--dx-primary);
  font-size: 26rpx;
  font-weight: 500;
  margin-top: 24rpx;
}

.demo-box {
  margin-top: 28rpx;
  padding: 20rpx 24rpx;
  background: var(--dx-accent-soft);
  border-radius: var(--dx-radius-md);
  border: 1rpx solid rgba(19, 194, 194, 0.25);
  text-align: center;
}

.demo-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--dx-accent-dark);
  margin-bottom: 6rpx;
}

.demo-hint {
  display: block;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  line-height: 1.45;
}

.dev-hint {
  display: block;
  color: #d48806;
  font-size: 24rpx;
  margin-bottom: 16rpx;
  padding: 12rpx 16rpx;
  background: #fffbe6;
  border-radius: var(--dx-radius-sm);
}

.error-box {
  margin-top: 24rpx;
  padding: 16rpx 20rpx;
  background: #fff2f0;
  border-radius: var(--dx-radius-md);
  border: 1rpx solid #ffccc7;
}

.error-text {
  color: #cf1322;
  font-size: 26rpx;
  line-height: 1.45;
}

/* 密码 Tab 切换到注册：青绿主色微调，与登录蓝调区分 */
.login-page--register .hero-bg {
  background: var(--dx-gradient-hero-register);
  box-shadow: var(--dx-shadow-hero-register);
}

.login-page--register .submit-btn {
  background: var(--dx-accent-dark);
  box-shadow: var(--dx-shadow-md-register);
}

.login-page--register .mode-tab.active {
  color: var(--dx-accent-dark);
}

.login-page--register .switch-link {
  color: var(--dx-accent-dark);
}

.login-page--register .field-input:focus {
  border-color: var(--dx-accent);
}

.sheet-card--register {
  border: 2rpx solid rgba(19, 194, 194, 0.2);
}
</style>

<style>
.field-placeholder {
  color: var(--dx-text-muted);
  font-size: 28rpx;
}
</style>
