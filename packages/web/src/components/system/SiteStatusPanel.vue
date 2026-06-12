<template>
  <a-card class="site-status-card" :loading="loading">
    <div class="site-status-head">
      <div>
        <h3 class="site-status-title">{{ t('system.siteStatusTitle') }}</h3>
        <p class="site-status-desc">{{ t('system.siteStatusDesc') }}</p>
      </div>
      <a-switch
        :checked="online"
        :loading="saving"
        :checked-children="t('system.siteOnline')"
        :un-checked-children="t('system.siteOffline')"
        @change="onToggle"
      />
    </div>
    <a-alert
      v-if="!online"
      type="warning"
      show-icon
      :message="t('system.siteOfflineHint')"
      class="site-status-alert"
    />
  </a-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { fetchSiteStatus, updateSiteOnline } from '@/api/site-status';

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const online = ref(true);

async function load() {
  loading.value = true;
  try {
    const status = await fetchSiteStatus();
    online.value = status.online;
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    loading.value = false;
  }
}

async function onToggle(checked: boolean | string | number) {
  const nextOnline = checked === true;
  const previousOnline = online.value;
  online.value = nextOnline;
  saving.value = true;
  try {
    const status = await updateSiteOnline(nextOnline);
    online.value = status.online;
    if (status.online !== nextOnline) {
      throw new Error(t('common.failed'));
    }
    message.success(t('system.siteStatusUpdated'));
  } catch (err) {
    online.value = previousOnline;
    message.error(err instanceof Error ? err.message : t('common.failed'));
    try {
      const status = await fetchSiteStatus();
      online.value = status.online;
    } catch {
      /* ignore */
    }
  } finally {
    saving.value = false;
  }
}

onMounted(load);

defineExpose({ reload: load });
</script>

<style scoped>
.site-status-card {
  border-radius: 10px;
}

.site-status-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.site-status-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.site-status-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.site-status-alert {
  margin-top: 14px;
}
</style>
