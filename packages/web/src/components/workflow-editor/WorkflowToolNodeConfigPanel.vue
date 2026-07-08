<template>
  <component :is="bare ? 'div' : 'a-card'" v-bind="wrapperProps">
    <a-spin :spinning="schemasLoading">
      <a-empty v-if="!selectedNode" :description="t('workflowEditor.paletteDoc.empty')" />
      <a-empty
        v-else-if="selectedNode.kind !== 'tool'"
        :description="t('workflowEditor.toolConfig.notToolNode')"
      />
      <a-empty
        v-else-if="!editableFields.length"
        :description="t('workflowEditor.toolConfig.noSchema')"
      />
      <template v-else>
        <a-tag class="tool-config-panel__badge" color="green">
          {{ t('workflowEditor.paletteDoc.canvasBadge') }}
        </a-tag>
        <p class="tool-config-panel__node-id">{{ selectedNode.id }}</p>
        <p class="tool-config-panel__tool-name">{{ toolTitle }}</p>
        <a-form layout="vertical" class="tool-config-panel__form">
          <a-form-item
            v-for="field in editableFields"
            :key="field.key"
            :label="fieldLabel(field)"
            :required="field.required"
          >
            <a-select
              v-if="field.schema.enum?.length"
              :value="(formModel[field.key] ?? undefined) as string | number | undefined"
              allow-clear
              :placeholder="t('workflowEditor.toolConfig.placeholder')"
              @update:value="(v) => setFieldValue(field.key, v as string | number | boolean | undefined)"
            >
              <a-select-option
                v-for="option in field.schema.enum"
                :key="String(option)"
                :value="option"
              >
                {{ String(option) }}
              </a-select-option>
            </a-select>
            <a-switch
              v-else-if="resolveJsonSchemaPrimaryType(field.schema) === 'boolean'"
              :checked="Boolean(formModel[field.key])"
              @update:checked="(v) => setFieldValue(field.key, v)"
            />
            <a-input-number
              v-else-if="isNumberField(field)"
              :value="formModel[field.key] as number | undefined"
              class="tool-config-panel__number"
              :min="field.schema.minimum"
              :max="field.schema.maximum"
              :step="resolveJsonSchemaPrimaryType(field.schema) === 'integer' ? 1 : 0.01"
              @update:value="(v) => setFieldValue(field.key, v)"
            />
            <a-input
              v-else
              :value="String(formModel[field.key] ?? '')"
              allow-clear
              :placeholder="t('workflowEditor.toolConfig.placeholder')"
              @update:value="(v) => setFieldValue(field.key, v)"
            />
            <div v-if="field.schema.description" class="tool-config-panel__hint">
              {{ field.schema.description }}
            </div>
          </a-form-item>
        </a-form>
        <a-button block size="small" @click="resetOverrides">
          {{ t('workflowEditor.toolConfig.reset') }}
        </a-button>
      </template>
    </a-spin>
  </component>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AgentToolJsonSchemaMap } from '@douxing/shared';
import { hasAgentToolInputSchema } from '@douxing/shared';
import { fetchAgentToolJsonSchemas } from '@/api/agent-tool-schemas';
import type { WorkflowToolSchemaField } from '@/utils/workflow-tool-schema-form';
import {
  buildWorkflowToolFormModel,
  listWorkflowToolSchemaFields,
  resolveJsonSchemaPrimaryType,
  workflowToolFormModelToOverrides,
} from '@/utils/workflow-tool-schema-form';

/** 选中节点快照（来自画布） */
export interface WorkflowSelectedNodeSnapshot {
  id: string;
  kind: string;
  toolName?: string;
  overrides?: Record<string, unknown>;
}

const props = defineProps<{
  selectedNode: WorkflowSelectedNodeSnapshot | null;
  /** 嵌入折叠面板时不渲染外层 Card */
  bare?: boolean;
}>();

const emit = defineEmits<{
  'update-overrides': [nodeId: string, overrides: Record<string, unknown> | undefined];
}>();

const { t } = useI18n();

const schemasLoading = ref(true);
const schemas = ref<AgentToolJsonSchemaMap>({});
const formModel = reactive<Record<string, string | number | boolean | undefined>>({});

/**
 * 外层容器 props：Card 模式带标题，bare 模式仅样式类。
 */
const wrapperProps = computed(() =>
  props.bare
    ? { class: 'tool-config-panel tool-config-panel--bare' }
    : {
        size: 'small' as const,
        title: t('workflowEditor.toolConfig.title'),
        class: 'tool-config-panel',
      },
);

/**
 * 加载 Tool JSON Schema（全局缓存于组件生命周期）。
 */
async function loadSchemas(): Promise<void> {
  schemasLoading.value = true;
  try {
    schemas.value = await fetchAgentToolJsonSchemas();
  } finally {
    schemasLoading.value = false;
  }
}

void loadSchemas();

/**
 * 当前 Tool 的可编辑字段列表。
 */
const editableFields = computed((): WorkflowToolSchemaField[] => {
  const toolName = props.selectedNode?.toolName;
  if (!toolName || !hasAgentToolInputSchema(toolName, schemas.value)) return [];
  return listWorkflowToolSchemaFields(schemas.value[toolName]);
});

/**
 * Tool 节点标题（走 agent.status i18n）。
 */
const toolTitle = computed(() => {
  const toolName = props.selectedNode?.toolName;
  if (!toolName) return '';
  const key = `agent.status.${toolName}`;
  const translated = t(key);
  return translated !== key ? translated : toolName;
});

/**
 * 判断字段是否为数值类型。
 *
 * @param field - 表单字段
 * @returns 是否使用 InputNumber
 */
function isNumberField(field: WorkflowToolSchemaField): boolean {
  const type = resolveJsonSchemaPrimaryType(field.schema);
  return type === 'number' || type === 'integer';
}

/**
 * 表单标签：优先 Schema description，否则字段 key。
 *
 * @param field - 表单字段
 * @returns 展示标签
 */
function fieldLabel(field: WorkflowToolSchemaField): string {
  return field.schema.description?.trim() || field.key;
}

/**
 * 选中节点变化时重建表单模型。
 */
watch(
  () => [props.selectedNode?.id, props.selectedNode?.toolName, props.selectedNode?.overrides] as const,
  () => {
    for (const key of Object.keys(formModel)) {
      delete formModel[key];
    }
    const initial = buildWorkflowToolFormModel(editableFields.value, props.selectedNode?.overrides);
    for (const [key, value] of Object.entries(initial)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === undefined
      ) {
        formModel[key] = value;
      }
    }
  },
  { immediate: true, deep: true },
);

/**
 * 更新单个表单字段并同步 overrides。
 *
 * @param key - 字段名
 * @param value - 新值
 */
function setFieldValue(key: string, value: string | number | boolean | undefined): void {
  formModel[key] = value;
  emitOverrides();
}

/**
 * 将当前表单值同步为节点 overrides。
 */
function emitOverrides(): void {
  if (!props.selectedNode) return;
  const raw: Record<string, unknown> = { ...formModel };
  emit('update-overrides', props.selectedNode.id, workflowToolFormModelToOverrides(raw));
}

/**
 * 清空当前节点 overrides 并重置表单。
 */
function resetOverrides(): void {
  if (!props.selectedNode) return;
  for (const key of Object.keys(formModel)) {
    delete formModel[key];
  }
  emit('update-overrides', props.selectedNode.id, undefined);
}
</script>

<style scoped>
.tool-config-panel--bare {
  width: 100%;
}

.tool-config-panel__badge {
  margin-bottom: 8px;
}

.tool-config-panel__node-id {
  margin: 0 0 4px;
  color: #8c8c8c;
  font-size: 11px;
  font-family: ui-monospace, monospace;
}

.tool-config-panel__tool-name {
  margin: 0 0 12px;
  font-weight: 600;
  color: #262626;
}

.tool-config-panel__form {
  margin-bottom: 12px;
}

.tool-config-panel__number {
  width: 100%;
}

.tool-config-panel__hint {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 11px;
  line-height: 1.4;
}
</style>
