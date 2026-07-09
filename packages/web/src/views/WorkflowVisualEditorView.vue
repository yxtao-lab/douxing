<template>
  <div class="workflow-visual-editor">
    <a-page-header
      :title="pageTitle"
      :sub-title="t('workflowEditor.desc')"
      @back="goBack"
    >
      <template #extra>
        <div ref="toolbarRef" class="workflow-visual-editor__toolbar">
          <a-space wrap>
          <a-tag :color="publishStatusColor">{{ publishStatusLabel }}</a-tag>
          <a-tag>{{ t('workflowEditor.versionTag', { version: template?.version ?? '-' }) }}</a-tag>
          <a-button @click="loadDefaultGraph">{{ t('workflowEditor.loadDefault') }}</a-button>
          <a-button :loading="validating" @click="runValidate">{{ t('workflowEditor.validate') }}</a-button>
          <a-button type="primary" :loading="saving" @click="saveDraft">{{ t('workflowEditor.saveDraft') }}</a-button>
          <a-button
            type="primary"
            ghost
            :loading="publishing"
            :disabled="!validationResult?.valid"
            @click="publishGraph"
          >
            {{ t('workflowEditor.publish') }}
          </a-button>
          </a-space>
        </div>
      </template>
    </a-page-header>

    <a-spin :spinning="loading" wrapper-class-name="workflow-visual-editor__spin">
      <div class="workflow-visual-editor__layout">
        <aside ref="paletteRef" class="workflow-visual-editor__palette">
          <WorkflowNodePalette
            :selected-key="selectedPaletteKey"
            @select="onPaletteSelect"
          />
        </aside>

        <main ref="canvasWrapRef" class="workflow-visual-editor__canvas-wrap">
          <WorkflowGraphCanvas
            v-if="currentGraph"
            ref="canvasRef"
            :graph="currentGraph"
            :execution="graphExecution"
            :sandbox-prompt="sandboxPrompt"
            :sandbox-running="sandboxRunning"
            @change="onGraphChange"
            @node-select="onNodeSelect"
            @update:sandbox-prompt="sandboxPrompt = $event"
            @sandbox-run="runSandboxPreview"
          />
        </main>

        <aside ref="sidePanelRef" class="workflow-visual-editor__side">
          <a-collapse
            v-model:active-key="sideActiveKeys"
            :bordered="false"
            class="workflow-visual-editor__side-collapse"
          >
            <a-collapse-panel key="config" :header="t('workflowEditor.sidePanelTitle')">
              <WorkflowPaletteNodeDocPanel
                v-if="paletteSelection && !selectedNode"
                :selection="paletteSelection"
              />
              <WorkflowToolNodeConfigPanel
                v-else
                bare
                :selected-node="selectedNode"
                @update-overrides="onNodeOverridesUpdate"
              />
            </a-collapse-panel>

            <a-collapse-panel key="validation" :header="t('workflowEditor.validationTitle')">
              <a-empty v-if="!validationResult" :description="t('workflowEditor.validationEmpty')" />
              <a-alert
                v-else-if="validationResult.valid"
                type="success"
                :message="t('workflowEditor.validationPassed')"
                show-icon
              />
              <a-list v-else size="small" :data-source="validationResult.issues">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-typography-text type="danger">
                      {{ t(item.messageKey) }}
                      <span v-if="item.nodeId"> ({{ item.nodeId }})</span>
                    </a-typography-text>
                  </a-list-item>
                </template>
              </a-list>
            </a-collapse-panel>

            <a-collapse-panel key="preview" :header="t('workflowEditor.previewTitle')">
              <p class="preview-desc">{{ t('workflowEditor.previewDesc') }}</p>
              <a-alert
                type="info"
                show-icon
                :message="t('workflowEditor.previewDraftHint')"
                class="preview-draft-alert"
              />
              <a-form layout="vertical">
                <a-form-item :label="t('planDiagnostics.sandboxPrompt')" required>
                  <a-textarea
                    v-model:value="sandboxPrompt"
                    :rows="2"
                    :maxlength="500"
                    :placeholder="t('planDiagnostics.sandboxPromptPlaceholder')"
                    :disabled="sandboxRunning"
                  />
                </a-form-item>
                <a-space direction="vertical" style="width: 100%">
                  <a-button
                    type="primary"
                    block
                    :loading="sandboxRunning"
                    :disabled="!sandboxPrompt.trim()"
                    @click="runSandboxPreview"
                  >
                    {{ t('workflowEditor.previewRun') }}
                  </a-button>
                  <a-button
                    v-if="graphExecution"
                    block
                    @click="clearExecutionOverlay"
                  >
                    {{ t('workflowEditor.execution.clearHighlight') }}
                  </a-button>
                </a-space>
              </a-form>
              <div v-if="previewSessionId" class="preview-result">
                <a-button type="link" @click="openDiagnostics(previewSessionId)">
                  {{ t('workflowEditor.openDiagnostics', { sessionId: previewSessionId }) }}
                </a-button>
              </div>
            </a-collapse-panel>

            <a-collapse-panel key="execution" :header="t('workflowEditor.execution.panelTitle')">
              <WorkflowGraphExecutionPanel
                :execution="graphExecution"
                :selected-node-id="executionSelectedNodeId"
                :selected-tool-name="selectedNode?.toolName"
                :selected-label-key="selectedNodeLabelKey"
                :graph-node-label-key-by-id="graphNodeLabelKeyById"
              />
            </a-collapse-panel>
          </a-collapse>
        </aside>
      </div>
    </a-spin>

    <WorkflowEditorOnboardingTour
      :open="onboardingOpen"
      :palette-target="paletteRef"
      :canvas-target="canvasWrapRef"
      :toolbar-target="toolbarRef"
      :side-target="sidePanelRef"
      @complete="completeOnboarding"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type {
  WorkflowGraphDefinition,
  WorkflowGraphExecutionSnapshot,
  WorkflowGraphValidationResult,
  WorkflowTemplateInfo,
} from '@douxing/shared';
import {
  applyWorkflowGraphExecutionToolCall,
  buildWorkflowGraphExecutionFromTrace,
} from '@douxing/shared';
import { buildDefaultPlanDefaultGraph, validateWorkflowGraph } from '@douxing/shared';
import WorkflowNodePalette from '@/components/workflow-editor/WorkflowNodePalette.vue';
import WorkflowGraphCanvas from '@/components/workflow-editor/WorkflowGraphCanvas.vue';
import WorkflowGraphExecutionPanel from '@/components/workflow-editor/WorkflowGraphExecutionPanel.vue';
import WorkflowPaletteNodeDocPanel from '@/components/workflow-editor/WorkflowPaletteNodeDocPanel.vue';
import WorkflowToolNodeConfigPanel, {
  type WorkflowSelectedNodeSnapshot,
} from '@/components/workflow-editor/WorkflowToolNodeConfigPanel.vue';
import WorkflowEditorOnboardingTour from '@/components/workflow-editor/WorkflowEditorOnboardingTour.vue';
import { readFlowNodeData } from '@/utils/workflow-graph-flow';
import {
  buildWorkflowPaletteSelectionKey,
  type WorkflowPaletteSelection,
} from '@/utils/workflow-palette-selection';
import {
  markWorkflowEditorOnboardingComplete,
  shouldShowWorkflowEditorOnboarding,
} from '@/utils/workflow-editor-onboarding';
import {
  fetchDefaultWorkflowGraph,
  fetchWorkflowTemplateById,
  publishWorkflowTemplateGraph,
  updateWorkflowTemplate,
  validateWorkflowGraphApi,
} from '@/api/workflow-templates';
import {
  fetchPlanSessionWorkflowTrace,
  startAdminSandboxPlanAsync,
} from '@/api/plan-sessions';
import { startAdminPlanSessionStreamSubscription } from '@/api/plan-session-stream';
import { usePageTitle } from '@/i18n/usePageTitle';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const templateId = computed(() => String(route.params.id ?? ''));

const loading = ref(true);
const saving = ref(false);
const validating = ref(false);
const publishing = ref(false);
const sandboxRunning = ref(false);

const template = ref<WorkflowTemplateInfo | null>(null);
const currentGraph = ref<WorkflowGraphDefinition | null>(null);
const validationResult = ref<WorkflowGraphValidationResult | null>(null);
const canvasRef = ref<InstanceType<typeof WorkflowGraphCanvas> | null>(null);

const paletteRef = ref<HTMLElement | null>(null);
const canvasWrapRef = ref<HTMLElement | null>(null);
const toolbarRef = ref<HTMLElement | null>(null);
const sidePanelRef = ref<HTMLElement | null>(null);

const onboardingOpen = ref(false);

const selectedNode = ref<WorkflowSelectedNodeSnapshot | null>(null);
/** 左侧面板选中项（展示目录说明） */
const paletteSelection = ref<WorkflowPaletteSelection | null>(null);
/** 左侧面板选中键（高亮用） */
const selectedPaletteKey = ref<string | null>(null);

/** 右侧栏折叠面板默认展开项 */
const sideActiveKeys = ref(['config', 'validation', 'preview', 'execution']);

const sandboxPrompt = ref('');
const previewSessionId = ref<number | null>(null);
const graphExecution = ref<WorkflowGraphExecutionSnapshot | null>(null);
const executionSelectedNodeId = ref<string | null>(null);
const sandboxAbortController = ref<AbortController | null>(null);
let stopSandboxStream: (() => void) | null = null;

/**
 * 选中节点的 labelKey（非 Tool 节点）。
 */
const selectedNodeLabelKey = computed(() => {
  if (!selectedNode.value) return undefined;
  const node = currentGraph.value?.nodes.find((item) => item.id === selectedNode.value?.id);
  return node?.labelKey;
});

/**
 * 画布节点 id → labelKey（分支名展示）。
 */
const graphNodeLabelKeyById = computed((): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const node of currentGraph.value?.nodes ?? []) {
    if (node.labelKey) map[node.id] = node.labelKey;
  }
  return map;
});

const pageTitle = computed(() => {
  if (!template.value) return t('workflowEditor.title');
  const name = locale.value === 'en-US' ? template.value.nameEn : template.value.nameZh;
  return `${t('workflowEditor.title')} · ${name}`;
});

usePageTitle('web.workflowEditor');

const publishStatusLabel = computed(() => {
  const status = template.value?.graphPublishStatus ?? 'draft';
  return t(`workflowEditor.publishStatus.${status}`);
});

const publishStatusColor = computed(() =>
  template.value?.graphPublishStatus === 'published' ? 'success' : 'default',
);

/**
 * 新建模板首次进入时尝试启动操作引导。
 */
async function tryOpenOnboarding(): Promise<void> {
  if (loading.value || !currentGraph.value) return;
  if (!shouldShowWorkflowEditorOnboarding(templateId.value, route.query.onboarding)) return;
  await nextTick();
  onboardingOpen.value = true;
}

/**
 * 完成或跳过引导：写入 localStorage 并清理 URL 参数。
 */
function completeOnboarding(): void {
  markWorkflowEditorOnboardingComplete(templateId.value);
  onboardingOpen.value = false;
  if (route.query.onboarding) {
    const nextQuery = { ...route.query };
    delete nextQuery.onboarding;
    void router.replace({ query: nextQuery });
  }
}

/**
 * 返回模板列表页。
 */
function goBack(): void {
  router.push({ name: 'workflow-templates' });
}

/**
 * 加载模板与图定义。
 */
async function loadTemplate(): Promise<void> {
  loading.value = true;
  try {
    const item = await fetchWorkflowTemplateById(templateId.value);
    template.value = item;
    if (item.graphDef) {
      currentGraph.value = item.graphDef;
    } else {
      currentGraph.value = buildDefaultPlanDefaultGraph();
    }
    validationResult.value = validateWorkflowGraph(currentGraph.value);
  } catch {
    message.error(t('workflowEditor.loadFailed'));
    goBack();
  } finally {
    loading.value = false;
    void tryOpenOnboarding();
  }
}

/**
 * 左侧面板选中：展示节点目录说明并取消画布选中。
 *
 * @param selection - 面板选中项
 */
function onPaletteSelect(selection: WorkflowPaletteSelection): void {
  paletteSelection.value = selection;
  selectedPaletteKey.value = buildWorkflowPaletteSelectionKey(selection);
  selectedNode.value = null;
  canvasRef.value?.clearNodeSelection();
}

/**
 * 画布节点选中：同步属性面板并清除面板目录选中。
 *
 * @param snapshot - 选中节点快照；null 表示取消选中
 */
function onNodeSelect(snapshot: { id: string; position: { x: number; y: number }; data?: unknown } | null): void {
  if (!snapshot) {
    selectedNode.value = null;
    executionSelectedNodeId.value = null;
    return;
  }
  executionSelectedNodeId.value = snapshot.id;
  paletteSelection.value = null;
  selectedPaletteKey.value = null;
  const data = readFlowNodeData(snapshot);
  const config = data.config as { overrides?: Record<string, unknown> } | undefined;
  selectedNode.value = {
    id: snapshot.id,
    kind: data.kind,
    toolName: data.toolName,
    overrides: config?.overrides,
  };
}

/**
 * Tool 节点 overrides 变更：写回画布并触发校验。
 *
 * @param nodeId - 节点 ID
 * @param overrides - 静态入参覆盖
 */
function onNodeOverridesUpdate(
  nodeId: string,
  overrides: Record<string, unknown> | undefined,
): void {
  canvasRef.value?.updateNodeOverrides(nodeId, overrides);
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = { ...selectedNode.value, overrides };
  }
}

/**
 * 画布变更时本地校验。
 *
 * @param graph - 最新图定义
 */
function onGraphChange(graph: WorkflowGraphDefinition): void {
  currentGraph.value = graph;
  validationResult.value = validateWorkflowGraph(graph);
}

/**
 * 加载 plan_default 参考图。
 */
async function loadDefaultGraph(): Promise<void> {
  try {
    const graph = await fetchDefaultWorkflowGraph();
    currentGraph.value = graph;
    canvasRef.value?.reloadGraph(graph);
    validationResult.value = validateWorkflowGraph(graph);
    message.success(t('workflowEditor.loadDefaultSuccess'));
  } catch {
    message.error(t('workflowEditor.loadDefaultFailed'));
  }
}

/**
 * 调用服务端校验 API。
 */
async function runValidate(): Promise<void> {
  if (!currentGraph.value) return;
  validating.value = true;
  try {
    validationResult.value = await validateWorkflowGraphApi(currentGraph.value);
    if (validationResult.value.valid) {
      message.success(t('workflowEditor.validationPassed'));
    } else {
      message.warning(t('workflowEditor.validationFailed'));
    }
  } catch {
    message.error(t('workflowEditor.validationFailed'));
  } finally {
    validating.value = false;
  }
}

/**
 * 保存草稿图至模板（graph_publish_status 自动回 draft）。
 */
async function saveDraft(): Promise<void> {
  if (!currentGraph.value || !template.value) return;

  const localValidation = validateWorkflowGraph(currentGraph.value);
  validationResult.value = localValidation;
  if (!localValidation.valid) {
    message.error(t('workflowEditor.saveBlocked'));
    return;
  }

  saving.value = true;
  try {
    template.value = await updateWorkflowTemplate(template.value.id, {
      graphDef: currentGraph.value,
    });
    message.success(t('workflowEditor.saveSuccess'));
  } catch {
    message.error(t('workflowEditor.saveFailed'));
  } finally {
    saving.value = false;
  }
}

/**
 * 发布图定义（需已通过校验）。
 */
async function publishGraph(): Promise<void> {
  if (!template.value) return;
  publishing.value = true;
  try {
    if (currentGraph.value) {
      await updateWorkflowTemplate(template.value.id, { graphDef: currentGraph.value });
    }
    template.value = await publishWorkflowTemplateGraph(template.value.id);
    message.success(t('workflowEditor.publishSuccess'));
  } catch {
    message.error(t('workflowEditor.publishFailed'));
  } finally {
    publishing.value = false;
  }
}

/**
 * 清除画布执行高亮与 SSE 订阅。
 */
function clearExecutionOverlay(): void {
  stopSandboxStream?.();
  stopSandboxStream = null;
  sandboxAbortController.value?.abort();
  sandboxAbortController.value = null;
  graphExecution.value = null;
  executionSelectedNodeId.value = null;
}

/**
 * 沙箱运行结束后拉取 trace 并静态高亮（M1 兜底 / 完成后校准）。
 *
 * @param sessionId - 沙箱会话 ID
 */
async function applyExecutionFromTrace(sessionId: number): Promise<void> {
  if (!currentGraph.value) return;
  try {
    const trace = await fetchPlanSessionWorkflowTrace(sessionId);
    graphExecution.value = buildWorkflowGraphExecutionFromTrace(
      currentGraph.value,
      trace.spans,
      { lastRoutedIntent: trace.lastRoutedIntent },
    );
  } catch {
    /* trace 拉取失败时保留 SSE 快照 */
  }
}

/**
 * 订阅沙箱 SSE 并实时更新画布执行态（M2）。
 *
 * @param sessionId - 沙箱会话 ID
 */
function subscribeSandboxStream(sessionId: number): void {
  stopSandboxStream?.();
  const abortController = new AbortController();
  sandboxAbortController.value = abortController;

  stopSandboxStream = startAdminPlanSessionStreamSubscription({
    sessionId,
    signal: abortController.signal,
    handlers: {
      onToolCall: (payload) => {
        if (!currentGraph.value) return;
        graphExecution.value = applyWorkflowGraphExecutionToolCall(
          currentGraph.value,
          graphExecution.value,
          payload,
        );
      },
      onDone: () => {
        if (!graphExecution.value) return;
        graphExecution.value = {
          ...graphExecution.value,
          completed: true,
          runningTool: undefined,
        };
        void applyExecutionFromTrace(sessionId);
        sandboxRunning.value = false;
        message.success(t('workflowEditor.previewSuccess'));
      },
      onError: () => {
        if (graphExecution.value) {
          graphExecution.value = {
            ...graphExecution.value,
            completed: true,
            failed: true,
            runningTool: undefined,
          };
        }
        sandboxRunning.value = false;
        message.error(t('workflowEditor.previewFailed'));
      },
    },
  });
}

/**
 * 沙箱预览运行：异步启动 + SSE 实时高亮，完成后 M1 静态校准。
 */
async function runSandboxPreview(): Promise<void> {
  const prompt = sandboxPrompt.value.trim();
  if (!prompt || !currentGraph.value) return;

  const localValidation = validateWorkflowGraph(currentGraph.value);
  validationResult.value = localValidation;
  if (!localValidation.valid) {
    message.error(t('workflowEditor.previewBlockedInvalidGraph'));
    sideActiveKeys.value = [...new Set([...sideActiveKeys.value, 'validation'])];
    return;
  }

  clearExecutionOverlay();
  sandboxRunning.value = true;

  graphExecution.value = {
    nodeStates: Object.fromEntries(
      currentGraph.value.nodes.map((node) => [node.id, { status: 'pending' as const }]),
    ),
    activeEdgeIds: [],
    flowingEdgeIds: [],
    edgeTransfers: {},
    edgeTransferPayloads: {},
    takenBranchEdgeIds: [],
    skippedBranchEdgeIds: [],
    takenBranchNodeId: null,
    completed: false,
    failed: false,
  };

  if (currentGraph.value.nodes.some((node) => node.kind === 'start')) {
    const startNode = currentGraph.value.nodes.find((node) => node.kind === 'start');
    if (startNode) {
      graphExecution.value.nodeStates[startNode.id] = { status: 'running' };
    }
  }

  sideActiveKeys.value = [...new Set([...sideActiveKeys.value, 'execution', 'preview'])];

  try {
    const { sessionId } = await startAdminSandboxPlanAsync({
      prompt,
      days: 3,
      graphDefOverride: currentGraph.value,
    });
    previewSessionId.value = sessionId;
    subscribeSandboxStream(sessionId);
  } catch {
    sandboxRunning.value = false;
    graphExecution.value = null;
    message.error(t('workflowEditor.previewFailed'));
  }
}

/**
 * 跳转规划诊断页查看沙箱 trace。
 *
 * @param sessionId - 沙箱会话 ID
 */
function openDiagnostics(sessionId: number): void {
  router.push({ name: 'plan-diagnostics', params: { sessionId: String(sessionId) } });
}

onMounted(() => {
  void loadTemplate();
});

onUnmounted(() => {
  clearExecutionOverlay();
});

watch(
  () => route.query.onboarding,
  () => {
    void tryOpenOnboarding();
  },
);
</script>

<style scoped>
.workflow-visual-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workflow-visual-editor :deep(.ant-page-header) {
  flex-shrink: 0;
  padding-bottom: 12px;
}

.workflow-visual-editor__spin {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workflow-visual-editor__spin :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workflow-visual-editor__layout {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  grid-template-rows: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.workflow-visual-editor__palette {
  min-height: 0;
  overflow: hidden;
}

.workflow-visual-editor__canvas-wrap {
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
}

.workflow-visual-editor__side {
  min-height: 0;
  overflow: hidden;
  background: #fafafa;
}

.workflow-visual-editor__side-collapse {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px;
  background: #fafafa;
}

.workflow-visual-editor__side-collapse :deep(.ant-collapse-item) {
  margin-bottom: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.workflow-visual-editor__side-collapse :deep(.ant-collapse-header) {
  font-weight: 600;
  font-size: 13px;
}

.workflow-visual-editor__side-collapse :deep(.ant-collapse-content-box) {
  padding: 12px;
}

.preview-desc {
  margin-bottom: 12px;
  color: #8c8c8c;
  font-size: 12px;
}

.preview-draft-alert {
  margin-bottom: 12px;
}

.preview-result {
  margin-top: 8px;
}

@media (max-width: 1200px) {
  .workflow-visual-editor__layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 200px) minmax(0, 1fr) minmax(0, 240px);
  }
}
</style>
