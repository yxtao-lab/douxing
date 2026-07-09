<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('system.aiServiceLogSource')">
          <a-select
            v-model:value="source"
            :options="sourceOptions"
          />
        </a-form-item>
        <a-form-item :label="t('system.aiServiceLogKeywordLabel')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchAiServiceLogKeyword')"
            allow-clear
            @press-enter="reload"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <a-space>
            <a-switch
              v-model:checked="autoRefresh"
              :checked-children="t('system.aiServiceLogAutoRefresh')"
              :un-checked-children="t('system.aiServiceLogAutoRefresh')"
            />
            <a-tooltip :title="t('system.refresh')">
              <a-button :loading="loading" @click="reload">
                <template #icon><ReloadOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-space>
        </template>
      </AdminToolbar>
    </template>

    <a-alert
      v-if="result && !result.exists"
      type="warning"
      show-icon
      :message="t('system.aiServiceLogFileMissing')"
      class="log-ai-service__alert"
    />

    <a-card v-if="result?.exists" size="small" class="log-ai-service__meta">
      <a-descriptions :column="2" size="small">
        <a-descriptions-item :label="t('system.aiServiceLogFilePath')">
          {{ result.displayPath }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('system.aiServiceLogFileSize')">
          {{ formatBytes(result.sizeBytes) }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card size="small" class="log-ai-service__panel">
      <template #title>
        <span class="log-ai-service__title">
          <RobotOutlined class="log-ai-service__title-icon" />
          {{ t('system.aiServiceLogLines') }}
        </span>
      </template>
      <a-spin :spinning="loading">
        <pre class="log-ai-service__pre">{{ logText }}</pre>
        <a-empty v-if="!loading && !logText" :description="t('system.empty')" />
      </a-spin>
      <div v-if="result && result.total > pageSize" class="log-ai-service__pager">
        <a-pagination
          v-model:current="page"
          :total="result.total"
          :page-size="pageSize"
          show-size-changer
          :page-size-options="['50', '100', '200', '500']"
          @change="reload"
          @show-size-change="onPageSizeChange"
        />
      </div>
    </a-card>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ReloadOutlined, RobotOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { fetchAiServiceLogsPage, type AiServiceLogPageResult, type AiServiceLogSourceId } from '@/api/system';
import { usePageTitle } from '@/i18n/usePageTitle';

const { t } = useI18n();
usePageTitle('web.logAiService');

const AUTO_REFRESH_MS = 5000;

const source = ref<AiServiceLogSourceId>('app');
const keyword = ref('');
const page = ref(1);
const pageSize = ref(100);
const loading = ref(false);
const autoRefresh = ref(false);
const result = ref<AiServiceLogPageResult | null>(null);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const sourceOptions = computed(() => [
  { value: 'app', label: t('system.aiServiceLogSourceApp') },
  { value: 'pm2-out', label: t('system.aiServiceLogSourcePm2Out') },
  { value: 'pm2-error', label: t('system.aiServiceLogSourcePm2Error') },
]);

const logText = computed(() => {
  if (!result.value?.items.length) return '';
  return result.value.items.map((line) => line.text).join('\n');
});

/**
 * 格式化字节数为可读文本。
 *
 * @param bytes - 字节数
 * @returns 如 12.3 KB
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 加载当前页日志。
 *
 * @returns Promise<void>
 */
async function reload(): Promise<void> {
  loading.value = true;
  try {
    result.value = await fetchAiServiceLogsPage({
      source: source.value,
      keyword: keyword.value,
      page: page.value,
      pageSize: pageSize.value,
    });
  } finally {
    loading.value = false;
  }
}

/**
 * 重置筛选并回到第一页。
 */
function resetSearch(): void {
  keyword.value = '';
  page.value = 1;
  void reload();
}

/**
 * 分页大小变化时重置到第一页并刷新。
 *
 * @param _current - 当前页（未使用）
 * @param size - 新分页大小
 */
function onPageSizeChange(_current: number, size: number): void {
  pageSize.value = size;
  page.value = 1;
  void reload();
}

/**
 * 根据自动刷新开关启停定时器。
 *
 * @param enabled - 是否开启自动刷新
 */
function syncAutoRefreshTimer(enabled: boolean): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (!enabled) return;
  refreshTimer = setInterval(() => {
    void reload();
  }, AUTO_REFRESH_MS);
}

watch(autoRefresh, (enabled) => {
  syncAutoRefreshTimer(enabled);
});

onMounted(() => {
  void reload();
});

onUnmounted(() => {
  syncAutoRefreshTimer(false);
});
</script>

<style scoped>
.log-ai-service__alert {
  margin-bottom: 12px;
}

.log-ai-service__meta {
  margin-bottom: 12px;
}

.log-ai-service__panel {
  min-height: 360px;
}

.log-ai-service__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.log-ai-service__title-icon {
  color: #1677ff;
  font-size: 16px;
}

.log-ai-service__pre {
  margin: 0;
  padding: 12px;
  max-height: 60vh;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-ai-service__pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
