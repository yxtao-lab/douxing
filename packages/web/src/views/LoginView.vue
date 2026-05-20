<template>
  <div class="login-page">
    <div class="login-card">
      <h1>{{ isRegister ? '注册' : '登录' }} {{ APP_NAME }}</h1>

      <div class="login-tabs">
        <button
          type="button"
          class="login-tab"
          :class="{ active: loginMode === 'sms' }"
          @click="loginMode = 'sms'"
        >
          验证码登录
        </button>
        <button
          type="button"
          class="login-tab"
          :class="{ active: loginMode === 'password' }"
          @click="loginMode = 'password'"
        >
          密码登录
        </button>
      </div>

      <form v-if="loginMode === 'sms'" @submit.prevent="handleSmsSubmit">
        <label>
          <span>手机号</span>
          <input v-model="smsForm.phone" type="tel" maxlength="11" placeholder="请输入手机号" required />
        </label>
        <label class="code-label">
          <span>验证码</span>
          <div class="code-row">
            <input
              v-model="smsForm.code"
              type="text"
              maxlength="6"
              placeholder="6位验证码"
              required
            />
            <button
              type="button"
              class="code-btn"
              :disabled="sendingCode || countdown > 0"
              @click="handleSendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码' }}
            </button>
          </div>
        </label>
        <p v-if="devCodeHint" class="dev-hint">开发环境验证码：{{ devCodeHint }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录 / 注册' }}</button>
        <p class="hint">未注册手机号将自动创建账号</p>
      </form>

      <form v-else @submit.prevent="handlePasswordSubmit">
        <label>
          <span>用户名</span>
          <input v-model="form.username" type="text" placeholder="admin" required />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="admin123" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? (isRegister ? '注册中...' : '登录中...') : isRegister ? '注册' : '登录' }}
        </button>
        <p class="switch-link">
          <a href="#" @click.prevent="isRegister = !isRegister">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </a>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { APP_NAME } from '@douxing/shared';
import { login, register, sendSmsCode, smsLogin } from '@/api/auth';
import { useUserStore } from '@/stores/user';

type LoginMode = 'sms' | 'password';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

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
