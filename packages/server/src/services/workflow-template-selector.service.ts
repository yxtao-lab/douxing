import type { TravelIntentSnapshot, WorkflowTemplateSelectionResult } from '@douxing/shared';
import { mergeWorkflowTemplateNodeConfig } from '@douxing/shared';
import { evaluateJsonLogic } from '../utils/json-logic.util.js';
import {
  DEFAULT_WORKFLOW_TEMPLATE_ID,
  getWorkflowTemplateById,
  loadEnabledWorkflowTemplates,
  resolveBudgetTierFromIntent,
} from './workflow-template.service.js';

export interface WorkflowTemplateSelectionInput {
  userId: number;
  intent?: TravelIntentSnapshot | Record<string, unknown> | null;
  routedIntent?: string;
  memberLevel?: number;
}

/**
 * 按 userId 计算稳定 A/B 分桶（0～99）。
 *
 * @param userId - 用户 ID
 * @returns 0～99 的哈希值
 */
export function hashUserIdForAbBucket(userId: number): number {
  let hash = userId % 9973;
  hash = (hash * 9301 + 49297) % 233280;
  return hash % 100;
}

/**
 * 构建 JSON Logic 求值上下文。
 *
 * @param input - 选择器入参
 * @returns var 变量表
 */
export function buildWorkflowTemplateSelectionContext(
  input: WorkflowTemplateSelectionInput,
): Record<string, unknown> {
  const intent = input.intent ?? {};
  const cities = Array.isArray(intent.cities) ? intent.cities : [];
  const days = typeof intent.days === 'number' ? intent.days : null;

  return {
    days,
    budgetMin: typeof intent.budgetMin === 'number' ? intent.budgetMin : null,
    budgetMax: typeof intent.budgetMax === 'number' ? intent.budgetMax : null,
    budgetTier: resolveBudgetTierFromIntent(intent),
    citiesCount: cities.length > 0 ? cities.length : intent.city ? 1 : 0,
    memberLevel: input.memberLevel ?? 0,
    routedIntent: input.routedIntent ?? 'unknown',
    userId: input.userId,
  };
}

/**
 * 按 JSON Logic + priority 选择工作流模板，并应用 A/B 分流。
 *
 * @param input - userId、intent、memberLevel 等
 * @returns 命中模板 ID、版本与 nodeConfig
 */
export async function selectWorkflowTemplate(
  input: WorkflowTemplateSelectionInput,
): Promise<WorkflowTemplateSelectionResult> {
  const templates = await loadEnabledWorkflowTemplates();
  const context = buildWorkflowTemplateSelectionContext(input);

  let matched = templates.find((template) =>
    evaluateJsonLogic(template.selectionRules, context),
  );

  if (!matched) {
    matched =
      templates.find((t) => t.id === DEFAULT_WORKFLOW_TEMPLATE_ID) ??
      (await getWorkflowTemplateById(DEFAULT_WORKFLOW_TEMPLATE_ID)) ??
      templates[templates.length - 1];
  }

  if (!matched) {
    return {
      templateId: DEFAULT_WORKFLOW_TEMPLATE_ID,
      templateVersion: 1,
      nodeConfig: { topK: 12, variantCount: 2, playbookLimit: 3 },
    };
  }

  let templateId = matched.id;
  let nodeConfig = mergeWorkflowTemplateNodeConfig(matched.nodeConfig);
  let abBucket: 'A' | 'B' | undefined;
  const split = matched.abSplitPercent ?? 0;
  const variantBId = matched.abVariantBId?.trim();

  if (variantBId && split > 0 && split < 100) {
    const bucket = hashUserIdForAbBucket(input.userId);
    if (bucket < split) {
      const variantB = await getWorkflowTemplateById(variantBId);
      if (variantB?.enabled) {
        templateId = variantB.id;
        nodeConfig = mergeWorkflowTemplateNodeConfig(variantB.nodeConfig);
        abBucket = 'B';
      } else {
        abBucket = 'A';
      }
    } else {
      abBucket = 'A';
    }
  }

  return {
    templateId,
    templateVersion: matched.version,
    nodeConfig,
    abBucket,
    matchedPriority: matched.priority,
  };
}
