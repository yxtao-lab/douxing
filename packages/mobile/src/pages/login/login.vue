<template>
  <view class="login-page">
    <view class="card">
      <text class="title">{{ isRegister ? t('common.register') : t('common.login') }} {{ t('app.name') }}</text>

      <view class="tabs">
        <text
          class="tab"
          :class="{ active: loginMode === 'sms' }"
          @click="loginMode = 'sms'"
        >
          {{ t('login.smsTab') }}
        </text>
        <text
          class="tab"
          :class="{ active: loginMode === 'password' }"
          @click="loginMode = 'password'"
        >
          {{ t('login.passwordTab') }}
        </text>
      </view>

      <template v-if="loginMode === 'sms'">
        <input
          v-model="phone"
          class="input"
          type="number"
          maxlength="11"
          :placeholder="t('login.phonePlaceholder')"
        />
        <view class="code-row">
          <input
            v-model="smsCode"
            class="input code-input"
            type="number"
            maxlength="6"
            :placeholder="t('login.codePlaceholder')"
          />
          <button
            class="code-btn"
            :disabled="sendingCode || countdown > 0"
            @click="handleSendCode"
          >
            {{ codeButtonLabel }}
          </button>
        </view>
        <text v-if="devCodeHint" class="dev-hint">{{ devCodeHintText }}</text>
        <button class="btn" :loading="loading" @click="handleSmsLogin">
          {{ t('login.smsSubmit') }}
        </button>
        <text class="hint">{{ t('login.smsHint') }}</text>
      </template>

      <template v-else>
        <input v-model="username" class="input" :placeholder="t('login.usernamePlaceholder')" />
        <input v-model="password" class="input" password :placeholder="t('login.passwordPlaceholder')" />
        <button class="btn" :loading="loading" @click="handlePasswordSubmit">
          {{ isRegister ? t('common.register') : t('common.login') }}
        </button>
        <text class="switch" @click="isRegister = !isRegister">
          {{ isRegister ? t('login.toggleToLogin') : t('login.toggleToRegister') }}
        </text>
        <text class="hint">{{ t('login.demoHint') }}</text>
      </template>

      <text v-if="error" class="error">{{ error }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import type { LoginResult } from '@douxing/shared';
import { request, setAuth } from '@/utils/request';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.login');

type LoginMode = 'sms' | 'password';

const loginMode = ref<LoginMode>('sms');
const phone = ref('');
const smsCode = ref('');
const username = ref('demo');
const password = ref('demo123');
const loading = ref(false);
const sendingCode = ref(false);
const error = ref('');
const isRegister = ref(false);
const countdown = ref(0);
const devCodeHint = ref('');

let countdownTimer: ReturnType<typeof setInterval> | null = null;

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
    if (data.devCode) {
      devCodeHint.value = data.devCode;
    }
    uni.showToast({ title: t('login.smsSent'), icon: 'success' });
    startCountdown();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('login.sendFailed');
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
    setAuth(data.token, data.user);
    uni.showToast({ title: t('login.loginSuccess'), icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 500);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('login.loginFailed');
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
    setAuth(data.token, data.user);
    uni.showToast({
      title: isRegister.value ? t('login.registerSuccess') : t('login.loginSuccess'),
      icon: 'success',
    });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 500);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.operationFailed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  padding: 48rpx 32rpx;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 48rpx 32rpx;
}
.title {
  display: block;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 32rpx;
}
.tabs {
  display: flex;
  margin-bottom: 32rpx;
  border-bottom: 1rpx solid #e5e7eb;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  color: #6b7280;
}
.tab.active {
  color: #1677ff;
  font-weight: 600;
  border-bottom: 4rpx solid #1677ff;
  margin-bottom: -1rpx;
}
.input {
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.code-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.code-input {
  flex: 1;
  margin-bottom: 0;
}
.code-btn {
  flex-shrink: 0;
  width: 220rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
  background: #f3f4f6;
  color: #1677ff;
  border: none;
  border-radius: 12rpx;
  line-height: 88rpx;
  height: 88rpx;
}
.code-btn[disabled] {
  color: #9ca3af;
}
.btn {
  background: #1677ff;
  color: #fff;
  margin-top: 16rpx;
}
.error {
  color: #ef4444;
  font-size: 26rpx;
  display: block;
  margin-top: 16rpx;
}
.switch {
  display: block;
  text-align: center;
  color: #1677ff;
  font-size: 26rpx;
  margin-top: 24rpx;
}
.hint {
  display: block;
  text-align: center;
  color: #9ca3af;
  font-size: 22rpx;
  margin-top: 16rpx;
}
.dev-hint {
  display: block;
  color: #f59e0b;
  font-size: 24rpx;
  margin-bottom: 16rpx;
}
</style>
