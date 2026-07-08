import { z } from 'zod';
import { digestWorkflowPayload } from '@douxing/shared';
import { getUserMemberLevel } from '../../services/membership.service.js';
import { selectWorkflowTemplate } from '../../services/workflow-template-selector.service.js';
import { toolFail, toolSuccess } from './schemas.js';

const selectWorkflowTemplateInputSchema = z.object({
  userId: z.number().int().positive(),
  intent: z.record(z.unknown()).optional(),
  routedIntent: z.string().optional(),
  memberLevel: z.number().int().min(0).optional(),
});

/**
 * W3-2 · 按 intent 选择工作流模板并返回 nodeConfig。
 *
 * @param raw - Tool 入参（userId、intent、routedIntent）
 * @returns templateId、templateVersion、nodeConfig、abBucket
 */
export async function runSelectWorkflowTemplateTool(raw: unknown) {
  const parsed = selectWorkflowTemplateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  let memberLevel = parsed.data.memberLevel;
  if (memberLevel == null) {
    memberLevel = await getUserMemberLevel(parsed.data.userId);
  }

  const selection = await selectWorkflowTemplate({
    userId: parsed.data.userId,
    intent: parsed.data.intent,
    routedIntent: parsed.data.routedIntent,
    memberLevel,
  });

  return toolSuccess({
    ...selection,
    inputDigest: digestWorkflowPayload({
      days: parsed.data.intent?.days,
      budgetMax: parsed.data.intent?.budgetMax,
      routedIntent: parsed.data.routedIntent,
    }),
    outputDigest: digestWorkflowPayload({
      templateId: selection.templateId,
      topK: selection.nodeConfig.topK,
      variantCount: selection.nodeConfig.variantCount,
      abBucket: selection.abBucket,
    }),
  });
}
