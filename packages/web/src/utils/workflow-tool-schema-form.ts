import type { AgentToolJsonSchema, AgentToolJsonSchemaProperty } from '@douxing/shared';

/** 表单可编辑字段元数据 */
export interface WorkflowToolSchemaField {
  key: string;
  schema: AgentToolJsonSchemaProperty;
  required: boolean;
}

/**
 * 解析 JSON Schema 属性的主类型（处理 nullable union）。
 *
 * @param property - JSON Schema 属性
 * @returns 主类型字符串；无法识别时为 `unknown`
 */
export function resolveJsonSchemaPrimaryType(
  property: AgentToolJsonSchemaProperty,
): string {
  const raw = property.type;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const filtered = raw.filter((item) => item !== 'null');
    return filtered[0] ?? 'unknown';
  }
  if (property.enum?.length) return 'string';
  return 'unknown';
}

/**
 * 列出 Tool 入参 Schema 中可渲染的表单字段（排除无 type 的空属性）。
 *
 * @param schema - Tool JSON Schema
 * @returns 字段列表
 */
export function listWorkflowToolSchemaFields(schema: AgentToolJsonSchema): WorkflowToolSchemaField[] {
  const requiredSet = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {})
    .filter(([, prop]) => Boolean(prop))
    .map(([key, prop]) => ({
      key,
      schema: prop,
      required: requiredSet.has(key),
    }));
}

/**
 * 从节点 overrides 与 Schema 默认值构建表单初始值。
 *
 * @param fields - 可编辑字段
 * @param overrides - 节点已保存的 overrides
 * @returns 表单模型
 */
export function buildWorkflowToolFormModel(
  fields: WorkflowToolSchemaField[],
  overrides: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  for (const field of fields) {
    if (overrides && field.key in overrides) {
      model[field.key] = overrides[field.key];
      continue;
    }
    if (field.schema.default !== undefined) {
      model[field.key] = field.schema.default;
    }
  }
  return model;
}

/**
 * 将表单模型转为节点 overrides（剔除 undefined 与空字符串）。
 *
 * @param model - 表单当前值
 * @returns overrides；无有效字段时为 undefined
 */
export function workflowToolFormModelToOverrides(
  model: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(model)) {
    if (value === undefined || value === '') continue;
    overrides[key] = value;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
