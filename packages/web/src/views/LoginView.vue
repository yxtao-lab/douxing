<template>
  <div class="login-view">
    <div class="login-head">
      <h2>{{ isRegister ? t('common.register') : t('layout.loginTitle') }}</h2>
      <p class="subtitle">{{ t('layout.loginSubtitle') }}</p>
    </div>

    <a-tabs v-model:activeKey="loginMode">
      <a-tab-pane key="sms" :tab="t('login.smsTab')">
        <a-form layout="vertical" :model="smsForm" @finish="handleSmsSubmit">
          <a-form-item :label="t('login.phone')" name="phone" :rules="[{ required: true }]">
            <a-input
              v-model:value="smsForm.phone"
              type="tel"
              :maxlength="11"
              :placeholder="t('login.phonePlaceholder')"
            />
          </a-form-item>
          <a-form-item :label="t('login.code')" name="code" :rules="[{ required: true }]">
            <div class="code-row">
              <a-input
                v-model:value="smsForm.code"
                :maxlength="6"
                :placeholder="t('login.codePlaceholder')"
              />
              <a-button :disabled="sendingCode || countdown > 0" @click="handleSendCode">
                {{ codeButtonLabel }}
              </a-button>
            </div>
          </a-form-item>
          <a-alert v-if="devCodeHint" type="warning" :message="t('login.devCodeHint', { code: devCodeHint })" show-icon />
          <a-alert v-if="error" type="error" :message="error" show-icon class="form-alert" />
          <a-button type="primary" html-type="submit" block :loading="loading">
            {{ t('login.smsSubmit') }}
          </a-button>
          <p class="hint">{{ t('login.smsHint') }}</p>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="password" :tab="t('login.passwordTab')">
        <a-form layout="vertical" :model="form" @finish="handlePasswordSubmit">
          <a-form-item :label="t('login.username')" name="username" :rules="[{ required: true }]">
            <a-input v-model:value="form.username" :placeholder="t('login.usernamePlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('login.password')" name="password" :rules="[{ required: true }]">
            <a-input-password v-model:value="form.password" :placeholder="t('login.passwordPlaceholder')" />
          </a-form-item>
          <a-alert v-if="error" type="error" :message="error" show-icon class="form-alert" />
          <a-button type="primary" html-type="submit" block :loading="loading">
            {{ isRegister ? t('common.register') : t('common.login') }}
          </a-button>
          <p class="switch-link">
            <a @click.prevent="isRegister = !isRegister">
              {{ isRegister ? t('login.toggleToLogin') : t('login.toggleToRegister') }}
            </a>
          </p>
          <p v-if="showDevHint" class="hint">{{ t('login.demoHint') }}</p>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { login, register, sendSmsCode, smsLogin } from '@/api/auth';
import { useUserStore } from '@/stores/user';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import { isDevelopmentExperienceEnabled } from '@/utils/build-env';
import { establishSessionAfterLogin } from '@/utils/session';

type LoginMode = 'sms' | 'password';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useLocale();

const codeButtonLabel = computed(() => {
  if (countdown.value > 0) {
    return t('login.codeCountdown', { seconds: countdown.value });
  }
  if (sendingCode.value) return t('common.sending');
  return t('login.getCode');
});

const loginMode = ref<LoginMode>('password');
const isRegister = ref(false);
const showDevHint = isDevelopmentExperienceEnabled();
const form = reactive({
  username: showDevHint ? 'admin' : '',
  password: showDevHint ? 'admin123' : '',
});
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
    error.value = t('login.invalidPhone');
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
    error.value = getAppErrorMessage(e, t('login.sendFailed'));
  } finally {
    sendingCode.value = false;
  }
}

async function handleSmsSubmit() {
  loading.value = true;
  error.value = '';
  try {
    if (!validatePhone(smsForm.phone)) {
      error.value = t('login.invalidPhone');
      return;
    }
    const result = await smsLogin(smsForm.phone, smsForm.code);
    userStore.setAuth(result.token, result.user, result.refreshToken);
    const sessionOk = await establishSessionAfterLogin();
    if (!sessionOk) {
      error.value = t('login.notStaff');
      return;
    }
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
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
    const result = isRegister.value
      ? await register(form.username, form.password)
      : await login(form.username, form.password);
    userStore.setAuth(result.token, result.user, result.refreshToken);
    const sessionOk = await establishSessionAfterLogin();
    if (!sessionOk) {
      error.value = t('login.notStaff');
      return;
    }
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e) {
    error.value = getAppErrorMessage(e, t('common.operationFailed'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-head {
  margin-bottom: 24px;
}

.login-head h2 {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  color: #6b7280;
}

.form-alert {
  margin-bottom: 16px;
}

.hint {
  margin-top: 12px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

.switch-link {
  margin-top: 12px;
  text-align: center;
}

.code-row {
  display: flex;
  gap: 8px;
}

.code-row .ant-input {
  flex: 1;
}
</style>
