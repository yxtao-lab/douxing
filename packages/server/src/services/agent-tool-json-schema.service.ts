import type { AgentToolJsonSchemaMap } from '@douxing/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  answerFoodQaInputSchema,
  applyMemoryContextInputSchema,
  buildRouteVariantsInputSchema,
  detectMissedPoisInputSchema,
  enrichRouteInputSchema,
  generateRouteDraftInputSchema,
  parseIntentInputSchema,
  patchRouteDayInputSchema,
  recallMemoryInputSchema,
  replanSegmentInputSchema,
  retrieveAttractionsInputSchema,
  selectPlanVariantInputSchema,
  selectWorkflowTemplateInputSchema,
  tuneRouteBudgetInputSchema,
  validateRouteInputSchema,
  writeMemoryInputSchema,
  type ToolName,
} from '../agent/tools/schemas.js';

/** 编辑器可配置 Tool 入参 Schema（不含纯运行时 state 绑定字段过多的 Tool） */
const EDITABLE_TOOL_SCHEMAS: Partial<Record<ToolName, unknown>> = {
  parse_intent: parseIntentInputSchema,
  select_workflow_template: selectWorkflowTemplateInputSchema,
  retrieve_attractions: retrieveAttractionsInputSchema,
  retrieve_playbooks: retrieveAttractionsInputSchema,
  generate_route_draft: generateRouteDraftInputSchema,
  enrich_route: enrichRouteInputSchema,
  validate_route: validateRouteInputSchema,
  build_route_variants: buildRouteVariantsInputSchema,
  patch_route_day: patchRouteDayInputSchema,
  tune_route_budget: tuneRouteBudgetInputSchema,
  answer_food_qa: answerFoodQaInputSchema,
  select_plan_variant: selectPlanVariantInputSchema,
  recall_user_memory: recallMemoryInputSchema,
  apply_memory_context: applyMemoryContextInputSchema,
  write_trip_memory: writeMemoryInputSchema,
  replan_segment: replanSegmentInputSchema,
  detect_missed_pois: detectMissedPoisInputSchema,
};

/** 管理端表单隐藏字段（由运行时 state 自动注入） */
const HIDDEN_TOOL_FIELDS: Partial<Record<ToolName, string[]>> = {
  parse_intent: ['prompt', 'history', 'userId', 'sessionIntent'],
  select_workflow_template: ['userId', 'intent', 'routedIntent', 'memberLevel'],
  retrieve_attractions: ['city', 'themes', 'prompt', 'days', 'userId', 'excludeIds', 'excludeNames', 'boostNames'],
  retrieve_playbooks: ['city', 'themes', 'prompt', 'days', 'userId', 'excludeIds', 'excludeNames', 'boostNames'],
  generate_route_draft: ['prompt', 'intent', 'ragCandidates', 'userId', 'variantKey', 'variantHint', 'ragVariantIndex'],
  enrich_route: ['draft', 'intent', 'playbooks'],
  validate_route: ['draft', 'ragCandidates'],
  build_route_variants: ['intent', 'userId'],
  patch_route_day: ['draft', 'intent', 'prompt'],
  tune_route_budget: ['draft', 'intent'],
  answer_food_qa: ['intent', 'prompt', 'userId'],
  select_plan_variant: ['sessionId', 'userId', 'prompt'],
  recall_user_memory: ['userId', 'query'],
  apply_memory_context: ['intent', 'userId', 'memorySummary', 'context'],
  write_trip_memory: ['userId'],
  replan_segment: ['routeId', 'userId', 'context'],
  detect_missed_pois: ['routeId', 'userId', 'dayIndex'],
};

let cachedSchemas: AgentToolJsonSchemaMap | null = null;

/**
 * 将 Zod schema 转为管理端可用的 JSON Schema（剔除运行时绑定字段）。
 *
 * @param toolName - Tool 名
 * @param zodSchema - Zod 入参 schema
 * @returns JSON Schema 对象
 */
function zodToEditableJsonSchema(toolName: ToolName, zodSchema: unknown): AgentToolJsonSchemaMap[string] {
  const raw = zodToJsonSchema(zodSchema as Parameters<typeof zodToJsonSchema>[0], {
    name: toolName,
    $refStrategy: 'none',
  }) as AgentToolJsonSchemaMap[string];

  const hidden = new Set(HIDDEN_TOOL_FIELDS[toolName] ?? []);
  const properties = { ...(raw.properties ?? {}) };
  for (const key of hidden) {
    delete properties[key];
  }

  const required = (raw.required ?? []).filter((key) => !hidden.has(key) && key in properties);

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  };
}

/**
 * 获取全部可编辑 Tool 入参 JSON Schema（内存缓存）。
 *
 * @returns Tool 名 → JSON Schema
 */
export function getAgentToolJsonSchemas(): AgentToolJsonSchemaMap {
  if (cachedSchemas) return cachedSchemas;

  const result: AgentToolJsonSchemaMap = {};
  for (const [toolName, zodSchema] of Object.entries(EDITABLE_TOOL_SCHEMAS) as [ToolName, unknown][]) {
    if (!zodSchema) continue;
    result[toolName] = zodToEditableJsonSchema(toolName, zodSchema);
  }
  cachedSchemas = result;
  return result;
}

/**
 * 清除 Schema 缓存（测试或热更新用）。
 *
 * @returns void
 */
export function invalidateAgentToolJsonSchemaCache(): void {
  cachedSchemas = null;
}
