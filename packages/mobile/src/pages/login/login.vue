<template>
  <view class="login-page">
    <view class="card">
      <text class="title">登录 {{ APP_NAME }}</text>
      <input v-model="username" class="input" placeholder="用户名" />
      <input v-model="password" class="input" password placeholder="密码" />
      <text v-if="error" class="error">{{ error }}</text>
      <button class="btn" :loading="loading" @click="handleLogin">登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { APP_NAME } from '@douxing/shared';
import type { LoginResult } from '@douxing/shared';
import { request, setAuth } from '@/utils/request';

const username = ref('admin');
const password = ref('admin123');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<LoginResult>('/auth/login', {
      method: 'POST',
      data: { username: username.value, password: password.value },
    });
    setAuth(data.token, data.user);
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 500);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
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
  margin-bottom: 48rpx;
}
.input {
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
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
  margin-bottom: 16rpx;
}
</style>
