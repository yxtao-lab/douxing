<template>
  <div class="login-page">
    <div class="login-card">
      <h1>登录 {{ APP_NAME }}</h1>
      <form @submit.prevent="handleSubmit">
        <label>
          <span>用户名</span>
          <input v-model="form.username" type="text" placeholder="admin" required />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="admin123" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { APP_NAME } from '@douxing/shared';
import { login } from '@/api/auth';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const form = reactive({ username: 'admin', password: 'admin123' });
const loading = ref(false);
const error = ref('');

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    const result = await login(form.username, form.password);
    userStore.setAuth(result.token, result.user);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>
