<template>
  <div class="maintenance-page">
    <div class="maintenance-card">
      <div class="maintenance-icon" aria-hidden="true">🛠️</div>
      <h1 class="maintenance-title">{{ t('siteStatus.title') }}</h1>
      <p class="maintenance-desc">{{ t('siteStatus.desc') }}</p>
      <button type="button" class="maintenance-btn" :disabled="checking" @click="retry">
        {{ checking ? t('siteStatus.checking') : t('siteStatus.retry') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPublicSiteStatus } from '@/api/site-status';

const { t } = useI18n();
const checking = ref(false);

async function retry() {
  checking.value = true;
  try {
    const status = await fetchPublicSiteStatus();
    if (status.online) {
      window.location.href = '/';
    }
  } catch {
    /* 仍离线或网络异常，保持当前页 */
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

.maintenance-card {
  width: min(420px, 100%);
  padding: 40px 28px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  text-align: center;
}

.maintenance-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.maintenance-title {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.maintenance-desc {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.6;
  color: #6b7280;
}

.maintenance-btn {
  min-width: 140px;
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.maintenance-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
