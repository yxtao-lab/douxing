<template>
  <div class="dx-card">
    <h2 class="mb-1 text-xl font-semibold">
      {{ isRegister ? t('common.register') : t('common.login') }}
    </h2>
    <p class="mb-6 text-sm text-dx-muted">
      {{ isRegister ? t('login.heroRegisterSubtitle') : t('login.heroSubtitle') }}
    </p>

    <div class="mb-4 flex gap-2 rounded-xl bg-dx-bg p-1">
      <button
        type="button"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition"
        :class="loginMode === 'sms' ? 'bg-white text-dx-primary shadow-sm' : 'text-dx-muted'"
        @click="loginMode = 'sms'"
      >
        {{ t('login.smsTab') }}
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition"
        :class="loginMode === 'password' ? 'bg-white text-dx-primary shadow-sm' : 'text-dx-muted'"
        @click="loginMode = 'password'"
      >
        {{ t('login.passwordTab') }}
      </button>
    </div>

    <form v-if="loginMode === 'sms'" class="space-y-4" @submit.prevent="handleSmsSubmit">
      <label class="block">
        <span class="mb-1 block text-sm text-dx-muted">{{ t('login.phone') }}</span>
        <input
          v-model="smsForm.phone"
          type="tel"
          maxlength="11"
          class="w-full rounded-xl border border-dx-border px-3 py-2.5 outline-none focus:border-dx-primary"
          :placeholder="t('login.phonePlaceholder')"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm text-dx-muted">{{ t('login.code') }}</span>
        <div class="flex gap-2">
          <input
            v-model="smsForm.code"
            maxlength="6"
            class="min-w-0 flex-1 rounded-xl border border-dx-border px-3 py-2.5 outline-none focus:border-dx-primary"
            :placeholder="t('login.codePlaceholder')"
          />
          <button
            type="button"
            class="dx-btn-secondary shrink-0 !px-3"
            :disabled="sendingCode || countdown > 0"
            @click="handleSendCode"
          >
            {{ codeButtonLabel }}
          </button>
        </div>
      </label>
      <p v-if="devCodeHint" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {{ t('login.devCodeHint', { code: devCodeHint }) }}
      </p>
      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      <button type="submit" class="dx-btn-primary w-full" :disabled="loading">
        {{ t('login.smsSubmit') }}
      </button>
      <p class="text-center text-xs text-dx-muted">{{ t('login.smsHint') }}</p>
    </form>

    <form v-else class="space-y-4" @submit.prevent="handlePasswordSubmit">
      <label class="block">
        <span class="mb-1 block text-sm text-dx-muted">{{ t('login.username') }}</span>
        <input
          v-model="form.username"
          class="w-full rounded-xl border border-dx-border px-3 py-2.5 outline-none focus:border-dx-primary"
          :placeholder="t('login.usernamePlaceholder')"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm text-dx-muted">{{ t('login.password') }}</span>
        <input
          v-model="form.password"
          type="password"
          class="w-full rounded-xl border border-dx-border px-3 py-2.5 outline-none focus:border-dx-primary"
          :placeholder="t('login.passwordPlaceholder')"
        />
      </label>
      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      <button type="submit" class="dx-btn-primary w-full" :disabled="loading">
        {{ isRegister ? t('common.register') : t('common.login') }}
      </button>
      <p class="text-center text-sm">
        <button type="button" class="text-dx-primary hover:underline" @click="isRegister = !isRegister">
          {{ isRegister ? t('login.toggleToLogin') : t('login.toggleToRegister') }}
        </button>
      </p>
      <p v-if="showDevHint" class="text-center text-xs text-dx-muted">{{ t('login.demoHint') }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login, register, sendSmsCode, smsLogin } from '@/api/auth';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { isDevelopmentExperienceEnabled } from '@/utils/build-env';
import { getAppErrorMessage } from '@/utils/error-message';

type LoginMode = 'sms' | 'password';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useLocale();

const loginMode = ref<LoginMode>('password');
const isRegister = ref(false);
const loading = ref(false);
const error = ref('');
const sendingCode = ref(false);
const countdown = ref(0);
const devCodeHint = ref('');
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const form = reactive({ username: '', password: '' });
const smsForm = reactive({ phone: '', code: '' });

const showDevHint = computed(() => isDevelopmentExperienceEnabled());
const codeButtonLabel = computed(() =>
  countdown.value > 0 ? t('login.codeCountdown', { seconds: countdown.value }) : t('login.getCode'),
);

function redirectAfterLogin() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  router.replace(redirect);
}

async function handlePasswordSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const result = isRegister.value
      ? await register(form.username, form.password)
      : await login(form.username, form.password);
    userStore.setAuth(result.token, result.user, result.refreshToken);
    redirectAfterLogin();
  } catch (err) {
    error.value = getAppErrorMessage(err, t('login.loginFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(smsForm.phone)) {
    error.value = t('login.invalidPhone');
    return;
  }
  error.value = '';
  sendingCode.value = true;
  try {
    const data = await sendSmsCode(smsForm.phone);
    devCodeHint.value = data.devCode ?? '';
    countdown.value = 60;
    countdownTimer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  } catch (err) {
    error.value = getAppErrorMessage(err, t('login.sendFailed'));
  } finally {
    sendingCode.value = false;
  }
}

async function handleSmsSubmit() {
  if (!/^1\d{10}$/.test(smsForm.phone)) {
    error.value = t('login.invalidPhone');
    return;
  }
  if (smsForm.code.length !== 6) {
    error.value = t('login.invalidCodeLength');
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    const result = await smsLogin(smsForm.phone, smsForm.code);
    userStore.setAuth(result.token, result.user, result.refreshToken);
    redirectAfterLogin();
  } catch (err) {
    error.value = getAppErrorMessage(err, t('login.loginFailed'));
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>
