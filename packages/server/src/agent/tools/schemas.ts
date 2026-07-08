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
  days: z.number().int().positive().nullish(),
  budget: z.string().nullish(),
  userId: z.number().int().positive().nullish(),
  sessionIntent: z.record(z.unknown()).nullish(),
});

export const retrieveAttractionsInputSchema = z.object({
  city: z.string().optional(),
  themes: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  days: z.number().int().positive().nullish(),
  limit: z.number().int().positive().nullish(),
  excludeIds: z.array(z.number()).optional(),
  excludeNames: z.array(z.string()).optional(),
  boostNames: z.array(z.string()).optional(),
});

export const generateRouteDraftInputSchema = z.object({
  prompt: z.string().min(1),
  days: z.number().int().positive().nullish(),
  budget: z.string().nullish(),
  provider: z.string().nullish(),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  intent: z.record(z.unknown()).optional(),
  ragCandidates: z.array(z.record(z.unknown())).optional(),
  variantHint: z.string().optional(),
  variantKey: z.string().optional(),
  ragVariantIndex: z.number().int().min(0).optional(),
  userId: z.number().int().positive().optional(),
});

export const enrichRouteInputSchema = z.object({
  draft: z.record(z.unknown()),
  intent: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  /** W0-3：上游 retrieve_playbooks 已检索时可传入，避免重复 RAG */
  playbooks: z.array(z.record(z.unknown())).optional(),
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
  locale: z.enum(['zh-CN', 'en-US']).optional(),
});

export const applyMemoryContextInputSchema = z.object({
  intent: z.record(z.unknown()),
  userId: z.number().int().positive(),
  memorySummary: z.string().optional(),
  context: z
    .object({
      memoryThemes: z.array(z.string()).optional(),
      excludePoiNames: z.array(z.string()).optional(),
      boostPoiNames: z.array(z.string()).optional(),
    })
    .optional(),
});

export const writeMemoryInputSchema = z.object({
  userId: z.number().int().positive(),
  memoryType: z.enum(['preference', 'regret', 'visited', 'trip_summary', 'milestone']),
  content: z.string().min(1),
  importance: z.number().int().min(1).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const buildRouteVariantsInputSchema = z.object({
  intent: z.record(z.unknown()),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  userId: z.number().int().positive().optional(),
  candidateCount: z.number().int().positive().optional(),
});

export const replanSegmentContextSchema = z.object({
  dayIndex: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  currentTimeMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  visitedPoiNames: z.array(z.string()).optional(),
  remainingPoiNames: z.array(z.string()).optional(),
  gpsLabel: z.string().optional(),
});

export const replanSegmentInputSchema = z.object({
  routeId: z.number().int().positive(),
  userId: z.number().int().positive(),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  context: replanSegmentContextSchema,
});

export const detectMissedPoisInputSchema = z.object({
  routeId: z.number().int().positive(),
  userId: z.number().int().positive(),
  dayIndex: z.number().int().min(0),
  currentTimeMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  includeAlternatives: z.boolean().optional(),
  autoRecordRegrets: z.boolean().optional(),
});

export type ToolName =
  | 'parse_intent'
  | 'retrieve_attractions'
  | 'retrieve_playbooks'
  | 'generate_route_draft'
  | 'enrich_route'
  | 'validate_route'
  | 'build_route_variants'
  | 'patch_route_day'
  | 'tune_route_budget'
  | 'answer_food_qa'
  | 'select_plan_variant'
  | 'recall_user_memory'
  | 'apply_memory_context'
  | 'write_trip_memory'
  | 'replan_segment'
  | 'detect_missed_pois';
