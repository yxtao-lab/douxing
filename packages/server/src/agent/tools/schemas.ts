import { z } from 'zod';

export const toolSuccess = <T>(data: T) => ({ ok: true as const, data });
export const toolFail = (message: string, code = 'TOOL_ERROR') => ({
  ok: false as const,
  error: { message, code },
});

export const parseIntentInputSchema = z.object({
  prompt: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .optional(),
  days: z.number().int().positive().optional(),
  budget: z.string().optional(),
  userId: z.number().int().positive().optional(),
  sessionIntent: z.record(z.unknown()).optional(),
});

export const retrieveAttractionsInputSchema = z.object({
  city: z.string().optional(),
  themes: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  days: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  excludeIds: z.array(z.number()).optional(),
  excludeNames: z.array(z.string()).optional(),
  boostNames: z.array(z.string()).optional(),
});

export const generateRouteDraftInputSchema = z.object({
  prompt: z.string().min(1),
  days: z.number().int().positive().optional(),
  budget: z.string().optional(),
  provider: z.string().optional(),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  intent: z.record(z.unknown()).optional(),
  ragCandidates: z.array(z.record(z.unknown())).optional(),
  variantHint: z.string().optional(),
  variantKey: z.string().optional(),
  userId: z.number().int().positive().optional(),
});

export const enrichRouteInputSchema = z.object({
  draft: z.record(z.unknown()),
  intent: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
});

export const validateRouteInputSchema = z.object({
  draft: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  ragCandidates: z.array(z.record(z.unknown())).optional(),
  autoFix: z.boolean().optional(),
});

export const patchRouteDayInputSchema = z.object({
  draft: z.record(z.unknown()),
  dayIndex: z.number().int().min(0).optional(),
  intent: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  relaxed: z.boolean().optional(),
  excludeNames: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  skipFinalize: z.boolean().optional(),
});

export const tuneRouteBudgetInputSchema = z.object({
  draft: z.record(z.unknown()),
  intent: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
});

export const answerFoodQaInputSchema = z.object({
  intent: z.record(z.unknown()),
  prompt: z.string().min(1),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  userId: z.number().int().positive().optional(),
});

export const selectPlanVariantInputSchema = z.object({
  sessionId: z.number().int().positive(),
  userId: z.number().int().positive(),
  prompt: z.string().min(1),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
});

export const recallMemoryInputSchema = z.object({
  userId: z.number().int().positive(),
  query: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export const writeMemoryInputSchema = z.object({
  userId: z.number().int().positive(),
  memoryType: z.enum(['preference', 'regret', 'visited', 'trip_summary', 'milestone']),
  content: z.string().min(1),
  importance: z.number().int().min(1).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ToolName =
  | 'parse_intent'
  | 'retrieve_attractions'
  | 'retrieve_playbooks'
  | 'generate_route_draft'
  | 'enrich_route'
  | 'validate_route'
  | 'patch_route_day'
  | 'tune_route_budget'
  | 'answer_food_qa'
  | 'select_plan_variant'
  | 'recall_user_memory'
  | 'write_trip_memory';
