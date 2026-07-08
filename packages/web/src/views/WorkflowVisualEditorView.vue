<template>
  <div class="workflow-visual-editor">
    <a-page-header
      :title="pageTitle"
      :sub-title="t('workflowEditor.desc')"
      @back="goBack"
    >
      <template #extra>
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
      </template>
    </a-page-header>

    <a-spin :spinning="loading" wrapper-class-name="workflow-visual-editor__spin">
      <div class="workflow-visual-editor__layout">
        <aside class="workflow-visual-editor__palette">
          <WorkflowNodePalette />
        </aside>

        <main class="workflow-visual-editor__canvas-wrap">
          <WorkflowGraphCanvas
            v-if="currentGraph"
            ref="canvasRef"
            :graph="currentGraph"
            @change="onGraphChange"
            @node-select="onNodeSelect"
          />
        </main>

        <aside class="workflow-visual-editor__side">
          <a-collapse
            v-model:active-key="sideActiveKeys"
            :bordered="false"
            class="workflow-visual-editor__side-collapse"
          >
            <a-collapse-panel key="config" :header="t('workflowEditor.toolConfig.title')">
              <WorkflowToolNodeConfigPanel
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
                <a-button
                  type="primary"
                  block
                  :loading="sandboxRunning"
                  :disabled="!sandboxPrompt.trim()"
                  @click="runSandboxPreview"
                >
                  {{ t('workflowEditor.previewRun') }}
                </a-button>
              </a-form>
              <div v-if="previewSessionId" class="preview-result">
                <a-button type="link" @click="openDiagnostics(previewSessionId)">
                  {{ t('workflowEditor.openDiagnostics', { sessionId: previewSessionId }) }}
                </a-button>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </aside>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type {
  WorkflowGraphDefinition,
  WorkflowGraphValidationResult,
  WorkflowTemplateInfo,
} from '@douxing/shared';
import { buildDefaultPlanDefaultGraph, validateWorkflowGraph } from '@douxing/shared';
import WorkflowNodePalette from '@/components/workflow-editor/WorkflowNodePalette.vue';
import WorkflowGraphCanvas from '@/components/workflow-editor/WorkflowGraphCanvas.vue';
import WorkflowToolNodeConfigPanel, {
  type WorkflowSelectedNodeSnapshot,
} from '@/components/workflow-editor/WorkflowToolNodeConfigPanel.vue';
import { readFlowNodeData } from '@/utils/workflow-graph-flow';
import {
  fetchDefaultWorkflowGraph,
  fetchWorkflowTemplateById,
  publishWorkflowTemplateGraph,
  updateWorkflowTemplate,
  validateWorkflowGraphApi,
} from '@/api/workflow-templates';
import { runAdminSandboxPlan } from '@/api/plan-sessions';
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

const selectedNode = ref<WorkflowSelectedNodeSnapshot | null>(null);

/** 右侧栏折叠面板默认展开项 */
const sideActiveKeys = ref(['config', 'validation']);

const sandboxPrompt = ref('');
const previewSessionId = ref<number | null>(null);

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
  }
}

/**
 * 画布节点选中：同步属性面板。
 *
 * @param snapshot - 选中节点快照；null 表示取消选中
 */
function onNodeSelect(snapshot: { id: string; position: { x: number; y: number }; data?: unknown } | null): void {
  if (!snapshot) {
    selectedNode.value = null;
    return;
  }
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
 * 沙箱预览运行（不写生产 routes）。
 */
async function runSandboxPreview(): Promise<void> {
  const prompt = sandboxPrompt.value.trim();
  if (!prompt) return;
  sandboxRunning.value = true;
  try {
    const result = await runAdminSandboxPlan({ prompt, days: 3 });
    previewSessionId.value = result.sessionId;
    message.success(t('workflowEditor.previewSuccess'));
  } catch {
    message.error(t('workflowEditor.previewFailed'));
  } finally {
    sandboxRunning.value = false;
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
