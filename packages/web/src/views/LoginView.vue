<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card-head">
        <h1>{{ isRegister ? t('common.register') : t('common.login') }} {{ t('app.name') }}</h1>
        <select class="locale-select" :value="currentLocale" @change="onLocaleChange">
          <option v-for="item in localeOptions" :key="item.code" :value="item.code">
            {{ item.label }}
          </option>
        </select>
      </div>

      <div class="login-tabs">
        <button
          type="button"
          class="login-tab"
          :class="{ active: loginMode === 'sms' }"
          @click="loginMode = 'sms'"
        >
          {{ t('login.smsTab') }}
        </button>
        <button
          type="button"
          class="login-tab"
          :class="{ active: loginMode === 'password' }"
          @click="loginMode = 'password'"
        >
          {{ t('login.passwordTab') }}
        </button>
      </div>

      <form v-if="loginMode === 'sms'" @submit.prevent="handleSmsSubmit">
        <label>
          <span>{{ t('login.phone') }}</span>
          <input
            v-model="smsForm.phone"
            type="tel"
            maxlength="11"
            :placeholder="t('login.phonePlaceholder')"
            required
          />
        </label>
        <label class="code-label">
          <span>{{ t('login.code') }}</span>
          <div class="code-row">
            <input
              v-model="smsForm.code"
              type="text"
              maxlength="6"
              :placeholder="t('login.codePlaceholder')"
              required
            />
            <button
              type="button"
              class="code-btn"
              :disabled="sendingCode || countdown > 0"
              @click="handleSendCode"
            >
              {{ codeButtonLabel }}
            </button>
          </div>
        </label>
        <p v-if="devCodeHint" class="dev-hint">{{ t('login.devCodeHint', { code: devCodeHint }) }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? t('login.signingIn') : t('login.smsSubmit') }}
        </button>
        <p class="hint">{{ t('login.smsHint') }}</p>
      </form>

      <form v-else @submit.prevent="handlePasswordSubmit">
        <label>
          <span>{{ t('login.username') }}</span>
          <input v-model="form.username" type="text" placeholder="admin" required />
        </label>
        <label>
          <span>{{ t('login.password') }}</span>
          <input v-model="form.password" type="password" placeholder="admin123" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{
            loading
              ? isRegister
                ? t('login.signingUp')
                : t('login.signingIn')
              : isRegister
                ? t('common.register')
                : t('common.login')
          }}
        </button>
        <p class="switch-link">
          <a href="#" @click.prevent="isRegister = !isRegister">
            {{ isRegister ? t('login.toggleToLogin') : t('login.toggleToRegister') }}
          </a>
        </p>
        <p class="hint">{{ t('login.demoHint') }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { LocaleCode } from '@douxing/shared';
import { login, register, sendSmsCode, smsLogin } from '@/api/auth';
import { useUserStore } from '@/stores/user';
import { useLocale } from '@/i18n/useLocale';

type LoginMode = 'sms' | 'password';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t, currentLocale, localeOptions, setLocale } = useLocale();

function onLocaleChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as LocaleCode);
}

const codeButtonLabel = computed(() => {
  if (countdown.value > 0) {
    return t('login.codeCountdown', { seconds: countdown.value });
  }
  if (sendingCode.value) return t('common.sending');
  return t('login.getCode');
});

const loginMode = ref<LoginMode>('sms');
const isRegister = ref(false);
const form = reactive({ username: 'admin', password: 'admin123' });
const smsForm = reactive({ phone: '', code: '' });
const loading = ref(false);
const sendingCode = ref(false);
const error = ref('');
const countdown = ref(0);
const devCodeHint = ref('');

let countdownTimer: ReturnType<typeof setInterval> | null = null;

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

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

async function handleSendCode() {
  error.value = '';
  devCodeHint.value = '';

  if (!validatePhone(smsForm.phone)) {
    error.value = '请输入正确的手机号';
    return;
  }

  sendingCode.value = true;
  try {
    const result = await sendSmsCode(smsForm.phone);
    if (result.devCode) {
      devCodeHint.value = result.devCode;
    }
    startCountdown();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败';
  } finally {
    sendingCode.value = false;
  }
}

async function handleSmsSubmit() {
  loading.value = true;
  error.value = '';
  try {
    if (!validatePhone(smsForm.phone)) {
      error.value = '请输入正确的手机号';
      return;
    }
    const result = await smsLogin(smsForm.phone, smsForm.code);
    userStore.setAuth(result.token, result.user);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

async function handlePasswordSubmit() {
  loading.value = true;
  error.value = '';
  try {
    const result = isRegister.value
      ? await register(form.username, form.password)
      : await login(form.username, form.password);
    userStore.setAuth(result.token, result.user);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败';
  } finally {
    loading.value = false;
  }
}
</script>
