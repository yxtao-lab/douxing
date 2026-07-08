<template>
  <div class="plan-diagnostics-page">
    <a-page-header
      :title="t('planDiagnostics.title')"
      :sub-title="t('planDiagnostics.desc')"
      @back="() => router.push({ name: 'analytics' })"
    />

    <PageContainer admin>
      <template #search>
        <AdminSearchBar @search="loadDiagnostics" @reset="resetSearch">
          <a-form-item :label="t('planDiagnostics.sessionId')">
            <a-input-number
              v-model:value="sessionIdInput"
              :min="1"
              :placeholder="t('planDiagnostics.sessionIdPlaceholder')"
              style="width: 200px"
              @press-enter="loadDiagnostics"
            />
          </a-form-item>
        </AdminSearchBar>
      </template>

      <a-row :gutter="[16, 16]" class="top-panels">
        <a-col :xs="24" :xl="14">
          <a-card :title="t('planDiagnostics.sandboxTitle')">
            <p class="sandbox-desc">{{ t('planDiagnostics.sandboxDesc') }}</p>
            <a-form layout="vertical">
              <a-form-item :label="t('planDiagnostics.sandboxPrompt')" required>
                <a-textarea
                  v-model:value="sandboxPrompt"
                  :rows="3"
                  :maxlength="500"
                  :placeholder="t('planDiagnostics.sandboxPromptPlaceholder')"
                  :disabled="sandboxRunning"
                />
              </a-form-item>
              <a-row :gutter="12">
                <a-col :span="8">
                  <a-form-item :label="t('planDiagnostics.sandboxDays')">
                    <a-input-number
                      v-model:value="sandboxDays"
                      :min="1"
                      :max="7"
                      style="width: 100%"
                      :disabled="sandboxRunning"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item :label="t('planDiagnostics.sandboxBudget')">
                    <a-input
                      v-model:value="sandboxBudget"
                      :disabled="sandboxRunning"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item :label="t('planDiagnostics.sandboxProvider')">
                    <a-select
                      v-model:value="sandboxProvider"
                      :options="providerOptions"
                      :disabled="sandboxRunning"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-button
                type="primary"
                :loading="sandboxRunning"
                :disabled="!sandboxPrompt.trim()"
                @click="runSandbox"
              >
                {{ sandboxRunning ? t('planDiagnostics.sandboxRunning') : t('planDiagnostics.sandboxRun') }}
              </a-button>
            </a-form>
          </a-card>
        </a-col>
        <a-col :xs="24" :xl="10">
          <a-card :title="t('planDiagnostics.recentTitle')">
            <DouxingAdminTable
              :columns="recentColumns"
              :data-source="recentSessions"
              :loading="recentLoading"
              :pagination="false"
              size="small"
              auto-body-scroll
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                  <TableActionBar :show-edit="false" :show-delete="false">
                    <TableActionButton
                      variant="primary"
                      :label="t('planDiagnostics.actionDiagnose')"
                      @click="openSession(record.id)"
                    />
                  </TableActionBar>
                </template>
              </template>
            </DouxingAdminTable>
          </a-card>
        </a-col>
      </a-row>

      <a-spin :spinning="loading">
        <template v-if="trace">
          <a-row :gutter="[16, 16]" class="summary-row">
            <a-col :xs="24" :md="12" :xl="6">
              <a-card>
                <a-statistic
                  :title="t('planDiagnostics.totalDuration')"
                  :value="trace.totalDurationMs"
                  :suffix="t('planDiagnostics.msUnit')"
                />
              </a-card>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-card>
                <a-statistic
                  :title="t('planDiagnostics.totalCost')"
                  :value="cost?.totalCostCny ?? 0"
                  :precision="6"
                  prefix="¥"
                />
                <p class="stat-sub">{{ t('planDiagnostics.estimateHint') }}</p>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-card>
                <a-statistic
                  :title="t('planDiagnostics.totalTokens')"
                  :value="(cost?.totalInputTokens ?? 0) + (cost?.totalOutputTokens ?? 0)"
                />
                <p class="stat-sub">
                  {{
                    t('planDiagnostics.tokenInOut', {
                      input: cost?.totalInputTokens ?? 0,
                      output: cost?.totalOutputTokens ?? 0,
                    })
                  }}
                </p>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-card>
                <a-statistic
                  :title="t('planDiagnostics.externalApiCalls')"
                  :value="cost?.totalExternalApiCalls ?? 0"
                />
              </a-card>
            </a-col>
          </a-row>

          <a-card class="meta-card" :title="t('planDiagnostics.sessionMeta')">
            <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }" size="small">
              <a-descriptions-item :label="t('planDiagnostics.sessionId')">
                {{ trace.sessionId }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('planDiagnostics.userId')">
                {{ trace.userId }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('planDiagnostics.sessionTitle')">
                {{ trace.title || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('planDiagnostics.generationPath')">
                {{ trace.generationPath }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('planDiagnostics.lastRoutedIntent')">
                {{ trace.lastRoutedIntent }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('planDiagnostics.pricingVersion')">
                {{ cost?.pricingVersion ?? '-' }}
              </a-descriptions-item>
            </a-descriptions>
            <div class="meta-actions">
              <a-button
                v-if="trace.langfuseSessionUrl"
                type="link"
                :href="trace.langfuseSessionUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('planDiagnostics.openLangfuse') }}
              </a-button>
              <a-tooltip v-else :title="t('planDiagnostics.langfuseUnavailable')">
                <a-button type="link" disabled>{{ t('planDiagnostics.openLangfuse') }}</a-button>
              </a-tooltip>
            </div>
          </a-card>

          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :xl="16">
              <a-card :title="t('planDiagnostics.timelineTitle')">
                <WorkflowSpanTimeline
                  v-if="trace.spans.length"
                  :spans="trace.spans"
                  :total-duration-ms="trace.totalDurationMs"
                />
                <a-empty v-else :description="t('planDiagnostics.noSpans')" />
              </a-card>
            </a-col>
            <a-col :xs="24" :xl="8">
              <a-card :title="t('planDiagnostics.costByModel')">
                <DouxingAdminTable
                  v-if="cost?.byModel.length"
                  :columns="modelColumns"
                  :data-source="cost.byModel"
                  :pagination="false"
                  size="small"
                  auto-body-scroll
                />
                <a-empty v-else :description="t('planDiagnostics.noCost')" />
              </a-card>
            </a-col>
          </a-row>
        </template>

        <a-empty
          v-else-if="!loading && searched"
          :description="t('planDiagnostics.notFound')"
        />
      </a-spin>
    </PageContainer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import type {
  LlmProviderChoice,
  PlanSessionAdminSummary,
  PlanSessionCostSummary,
  PlanSessionWorkflowTrace,
} from '@douxing/shared';
import { useI18n } from 'vue-i18n';
import { usePageTitle } from '@/i18n/usePageTitle';
import PageContainer from '@/layouts/components/PageContainer.vue';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import WorkflowSpanTimeline from '@/components/plan-workflow/WorkflowSpanTimeline.vue';
import {
  fetchPlanSessionCostSummary,
  fetchPlanSessionWorkflowTrace,
  fetchRecentPlanSessions,
  runAdminSandboxPlan,
} from '@/api/plan-sessions';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

usePageTitle('web.planDiagnostics');

const sessionIdInput = ref<number | undefined>(undefined);
const loading = ref(false);
const searched = ref(false);
const trace = ref<PlanSessionWorkflowTrace | null>(null);
const cost = ref<PlanSessionCostSummary | null>(null);

const sandboxPrompt = ref('');
const sandboxDays = ref<number | undefined>(3);
const sandboxBudget = ref('');
const sandboxProvider = ref<LlmProviderChoice>('auto');
const sandboxRunning = ref(false);

const recentSessions = ref<PlanSessionAdminSummary[]>([]);
const recentLoading = ref(false);

const providerOptions = computed(() => [
  { label: 'auto', value: 'auto' },
  { label: 'douxing', value: 'douxing' },
  { label: 'deepseek', value: 'deepseek' },
  { label: 'lmstudio', value: 'lmstudio' },
]);

const modelColumns = computed(() => [
  { title: t('planDiagnostics.colModel'), dataIndex: 'model', key: 'model' },
  {
    title: t('planDiagnostics.colTokens'),
    key: 'tokens',
    customRender: ({ record }: { record: { inputTokens: number; outputTokens: number } }) =>
      `${record.inputTokens} / ${record.outputTokens}`,
  },
  {
    title: t('planDiagnostics.colCost'),
    dataIndex: 'costCny',
    key: 'costCny',
    customRender: ({ text }: { text: number }) => `¥${Number(text).toFixed(6)}`,
  },
]);

const recentColumns = computed(() => [
  { title: t('planDiagnostics.colSessionId'), dataIndex: 'id', key: 'id', width: 88 },
  {
    title: t('planDiagnostics.colUser'),
    key: 'user',
    customRender: ({ record }: { record: PlanSessionAdminSummary }) =>
      record.username ? `${record.username} (#${record.userId})` : `#${record.userId}`,
  },
  { title: t('planDiagnostics.colPath'), dataIndex: 'generationPath', key: 'generationPath', width: 88 },
  { title: t('planDiagnostics.colSpans'), dataIndex: 'spanCount', key: 'spanCount', width: 72 },
  { title: t('planDiagnostics.colUpdated'), dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  { title: t('planDiagnostics.actionDiagnose'), key: 'action', width: 88, resizable: false },
]);

/**
 * 打开指定会话的诊断视图。
 *
 * @param sessionId - 规划会话 ID
 */
function openSession(sessionId: number) {
  sessionIdInput.value = sessionId;
  void loadDiagnostics();
}

/**
 * 拉取指定会话的诊断 trace 与费用汇总。
 */
async function loadDiagnostics() {
  if (!sessionIdInput.value || sessionIdInput.value < 1) {
    message.warning(t('planDiagnostics.sessionIdRequired'));
    return;
  }
  loading.value = true;
  searched.value = true;
  try {
    const sessionId = sessionIdInput.value;
    const [traceData, costData] = await Promise.all([
      fetchPlanSessionWorkflowTrace(sessionId),
      fetchPlanSessionCostSummary(sessionId),
    ]);
    trace.value = traceData;
    cost.value = costData;
    router.replace({ name: 'plan-diagnostics', params: { sessionId: String(sessionId) } });
  } catch {
    trace.value = null;
    cost.value = null;
    message.error(t('planDiagnostics.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 加载最近规划会话列表。
 */
async function loadRecentSessions() {
  recentLoading.value = true;
  try {
    recentSessions.value = await fetchRecentPlanSessions(15);
  } catch {
    recentSessions.value = [];
  } finally {
    recentLoading.value = false;
  }
}

/**
 * 管理端沙箱模拟规划，成功后自动打开诊断。
 */
async function runSandbox() {
  const prompt = sandboxPrompt.value.trim();
  if (!prompt) return;
  sandboxRunning.value = true;
  try {
    const result = await runAdminSandboxPlan({
      prompt,
      days: sandboxDays.value,
      budget: sandboxBudget.value.trim() || undefined,
      provider: sandboxProvider.value,
    });
    message.success(t('planDiagnostics.sandboxSuccess', { sessionId: result.sessionId }));
    openSession(result.sessionId);
    await loadRecentSessions();
  } catch {
    message.error(t('planDiagnostics.sandboxFailed'));
  } finally {
    sandboxRunning.value = false;
  }
}

/**
 * 重置搜索条件并清空诊断结果。
 */
function resetSearch() {
  sessionIdInput.value = undefined;
  trace.value = null;
  cost.value = null;
  searched.value = false;
}

watch(
  () => route.params.sessionId,
  (raw) => {
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      sessionIdInput.value = parsed;
      void loadDiagnostics();
    }
  },
  { immediate: true },
);

onMounted(() => {
  void loadRecentSessions();
});
</script>

<style scoped>
.plan-diagnostics-page {
  min-height: 100%;
}

/* 诊断页内容较长：勿锁死 100% 高度，交给 layout content-inner 滚动 */
.plan-diagnostics-page :deep(.page-container) {
  height: auto;
  flex: none;
}

.plan-diagnostics-page :deep(.admin-page-card),
.plan-diagnostics-page :deep(.admin-page-card > .ant-card-body),
.plan-diagnostics-page :deep(.page-container-body) {
  height: auto;
  flex: none;
  overflow: visible;
}

.top-panels {
  margin-bottom: 16px;
}

.sandbox-desc {
  margin: 0 0 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

.summary-row {
  margin-bottom: 16px;
}

.stat-sub {
  margin: 8px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.meta-card {
  margin-bottom: 16px;
}

.meta-actions {
  margin-top: 12px;
}
</style>
