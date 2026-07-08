/**
 * W6 · Agent Tool 入参 JSON Schema（由 server 脚本从 Zod 导出，供管理端节点表单渲染）。
 */

/** JSON Schema 子集（管理端表单够用） */
export interface AgentToolJsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: Array<string | number | boolean>;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  items?: AgentToolJsonSchemaProperty;
  properties?: Record<string, AgentToolJsonSchemaProperty>;
  required?: string[];
}

/** 单个 Tool 的 JSON Schema */
export interface AgentToolJsonSchema {
  type: 'object';
  properties: Record<string, AgentToolJsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/** Tool 名 → 入参 Schema */
export type AgentToolJsonSchemaMap = Record<string, AgentToolJsonSchema>;

/**
 * 判断 Tool 是否有可编辑的静态入参 Schema。
 *
 * @param toolName - Agent Tool 名
 * @param schemas - Schema 映射
 * @returns 是否存在且含 properties
 */
export function hasAgentToolInputSchema(
  toolName: string,
  schemas: AgentToolJsonSchemaMap,
): boolean {
  const schema = schemas[toolName];
  return Boolean(schema?.properties && Object.keys(schema.properties).length > 0);
}

/**
 * 合并节点 overrides 与默认值（浅合并，忽略 undefined）。
 *
 * @param defaults - 编译器生成的默认 payload 字段
 * @param overrides - 编辑器配置的静态覆盖
 * @returns 合并后的对象
 */
export function mergeWorkflowNodeOverrides<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Record<string, unknown> | undefined | null,
): T {
  if (!overrides) return defaults;
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
