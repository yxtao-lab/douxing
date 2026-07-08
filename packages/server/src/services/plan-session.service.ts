import { eq, desc, and, sql } from 'drizzle-orm';
import type {
  PlanChatMessage,
  PlanSessionActionResult,
  PlanSessionAgentState,
  PlanSessionInfo,
  PlanSessionMessageInfo,
  PlanSessionSummary,
  CreatePlanSessionRequest,
  TravelIntentSnapshot,
  PlanPetMeta,
  MemoryRecallExplainItem,
} from '@douxing/shared';
import {
  PlanSessionStatus,
  buildMultiCandidateAssistantReply,
  buildPlanAssistantReply,
  buildPlanCandidateSwitchedReply,
  appendPlanAssistantWarnings,
  formatPlanVariantHint,
  formatPlanVariantLabel,
  normalizeAgentToolTrace,
  type LocaleCode,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import {
  planSessions,
  planSessionMessages,
  planSessionCandidates,
  type PlanRouteSnapshot,
} from '../db/schema/plan-sessions.js';
import {
  createRouteFromPrompt,
  createRouteFromAgentDraft,
  regenerateRouteFromPrompt,
  updateRouteFromAgentDraft,
  getRouteById,
} from './route.service.js';
import type { GeneratedRouteDraft, GenerateRouteInput } from './route-generator.service.js';
import { buildIntentFromHistoryAsync } from './llm-intent-parser.service.js';
import { finalizePlanningIntent } from './travel-intent.service.js';
import {
  loadPlanUserContext,
  mergeIntentWithUserContext,
} from './plan-user-context.service.js';
import { runAgentPlan, isAgentPlanEnabled, type AgentPlanResult, type AgentPlanStreamHooks } from './agent-plan-client.service.js';
import { answerFoodQa } from './answer-food-qa.service.js';
import { resolvePlanVariantSelection } from './select-plan-variant.service.js';
import { writeTripMemory, PetMemoryType } from './pet-memory.service.js';
import {
  finalizePlanAssistantMessage,
  mergePetMetaIntoAgentState,
  buildPlanPetMeta,
} from './plan-pet-meta.service.js';
import { routeAgentIntent } from './agent-intent-router.service.js';
import {
  beginPlanSessionGeneration,
  completePlanSessionStream,
  emitPlanSessionAssistantFinal,
  emitPlanSessionToolCall,
  failPlanSessionStream,
  runPlanSessionTrackedTool,
} from './plan-session-stream.service.js';
import {
  buildPlanRouteVariants,
} from '../config/plan-route-variants.js';
import { getPlanCandidateCountForUser, getUserMemberLevel } from './membership.service.js';
import { ApiError, ApiMessageKey, canAppendPlanByMemberLevel, getMemberLevelLabel, isApiError } from '@douxing/shared';
import type { PlanRouteCandidate } from '@douxing/shared';

const SESSION_TITLE_MAX = 40;

function parsePlanSessionAgentState(raw: unknown): PlanSessionAgentState | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const normalizedTrace = normalizeAgentToolTrace(record.toolTrace);
  if (!Array.isArray(record.toolTrace)) return null;
  const generationPath = record.generationPath === 'agent' ? 'agent' : 'pipeline';
  const lastRoutedIntent =
    typeof record.lastRoutedIntent === 'string' ? record.lastRoutedIntent : 'unknown';
  const assistantHint =
    typeof record.assistantHint === 'string' ? record.assistantHint : undefined;
  const rawPetMeta = record.petMeta;
  let petMeta: PlanSessionAgentState['petMeta'] = null;
  if (rawPetMeta && typeof rawPetMeta === 'object') {
    const pm = rawPetMeta as Record<string, unknown>;
    petMeta = {
      nickname: typeof pm.nickname === 'string' ? pm.nickname : '小兜',
      species: typeof pm.species === 'string' ? pm.species : 'fox',
      personality: typeof pm.personality === 'string' ? pm.personality : 'guide',
      memorySummary: typeof pm.memorySummary === 'string' ? pm.memorySummary : '',
      recallExplain: Array.isArray(pm.recallExplain)
        ? (pm.recallExplain as MemoryRecallExplainItem[])
        : [],
    };
  }
  return {
    lastRoutedIntent,
    generationPath,
    toolTrace: normalizedTrace,
    assistantHint,
    petMeta,
  };
}

function buildPersistedAgentState(
  routedRoute: string,
  agentResult: AgentPlanResult | null | undefined,
  petMeta?: PlanPetMeta | null,
): PlanSessionAgentState {
  if (
    agentResult
    && (agentResult.draft || agentResult.candidates?.length || agentResult.assistantMessage || agentResult.selectedRouteId != null)
  ) {
    return {
      lastRoutedIntent: agentResult.routedIntent || routedRoute,
      generationPath: 'agent',
      toolTrace: agentResult.toolTrace ?? [],
      assistantHint: agentResult.assistantHint,
      petMeta: petMeta ?? null,
    };
  }
  return {
    lastRoutedIntent: routedRoute,
    generationPath: 'pipeline',
    toolTrace: [],
    petMeta: petMeta ?? null,
  };
}

async function applyPlanVariantToSession(
  sessionId: number,
  userId: number,
  routeId: number,
): Promise<void> {
  const db = getDb();
  await db
    .update(planSessionCandidates)
    .set({ isSelected: 0 })
    .where(eq(planSessionCandidates.sessionId, sessionId));
  await db
    .update(planSessionCandidates)
    .set({ isSelected: 1 })
    .where(
      and(
        eq(planSessionCandidates.sessionId, sessionId),
        eq(planSessionCandidates.routeId, routeId),
      ),
    );
  await db
    .update(planSessions)
    .set({ routeId, updatedAt: new Date() })
    .where(eq(planSessions.id, sessionId));
}

function truncateTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SESSION_TITLE_MAX) return trimmed;
  return `${trimmed.slice(0, SESSION_TITLE_MAX)}…`;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

function buildRouteSnapshot(payload: {
  name: string;
  description: string;
  budgetRange: string;
  days: number;
  interestTags: string[];
  matchedCity: string;
  routeDetail: Record<string, unknown>;
}): PlanRouteSnapshot {
  return {
    name: payload.name,
    description: payload.description,
    budgetRange: payload.budgetRange,
    days: payload.days,
    interestTags: payload.interestTags,
    matchedCity: payload.matchedCity,
    routeDetail: payload.routeDetail,
  };
}

function buildHistoryForLlm(messages: PlanSessionMessageInfo[]): PlanChatMessage[] {
  return messages.map((message) => {
    if (message.role === 'user') {
      return { role: 'user', content: message.content };
    }
    if (message.routeSnapshot) {
      return {
        role: 'assistant',
        content: `当前路线方案 JSON：${JSON.stringify(message.routeSnapshot)}`,
      };
    }
    return { role: 'assistant', content: message.content };
  });
}

function toMessageInfo(row: typeof planSessionMessages.$inferSelect): PlanSessionMessageInfo {
  return {
    id: row.id,
    role: row.role as PlanSessionMessageInfo['role'],
    content: row.content,
    routeSnapshot: row.routeSnapshot ?? null,
    createdAt: toIso(row.createdAt),
  };
}

async function loadSessionMessages(sessionId: number): Promise<PlanSessionMessageInfo[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(planSessionMessages)
    .where(eq(planSessionMessages.sessionId, sessionId))
    .orderBy(planSessionMessages.createdAt);
  return rows.map(toMessageInfo);
}

async function getOwnedSession(sessionId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(planSessions)
    .where(and(eq(planSessions.id, sessionId), eq(planSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

function readRagMatchedCount(route: { routeDetail?: Record<string, unknown> | null }): number {
  const value = route.routeDetail?.ragMatchedCount;
  return typeof value === 'number' ? value : 0;
}

function buildActionResult(
  sessionId: number,
  route: NonNullable<Awaited<ReturnType<typeof getRouteById>>>,
  assistantMessage: string,
  meta: {
    generationSource?: 'llm' | 'template';
    llmProvider?: string;
    intentSnapshot?: TravelIntentSnapshot | null;
    ragMatchedCount?: number;
    candidates?: PlanRouteCandidate[];
    memberPlanCandidateCount?: number;
    memberLevel?: number;
    memberLevelLabel?: string;
    agentState?: PlanSessionAgentState | null;
    petMeta?: PlanPetMeta | null;
  },
): PlanSessionActionResult {
  return {
    ...route,
    sessionId,
    assistantMessage,
    intentSnapshot: meta.intentSnapshot ?? null,
    ragMatchedCount: meta.ragMatchedCount ?? 0,
    candidates: meta.candidates,
    memberPlanCandidateCount: meta.memberPlanCandidateCount,
    memberLevel: meta.memberLevel,
    memberLevelLabel: meta.memberLevelLabel,
    generationSource: meta.generationSource,
    llmProvider: meta.llmProvider as PlanSessionActionResult['llmProvider'],
    agentState: meta.agentState ?? null,
    petMeta: meta.petMeta ?? meta.agentState?.petMeta ?? null,
  };
}

function routeToDraft(route: NonNullable<Awaited<ReturnType<typeof getRouteById>>>): GeneratedRouteDraft {
  const detail = (route.routeDetail ?? {}) as Record<string, unknown>;
  const days = (detail.days ?? []) as GeneratedRouteDraft['routeDetail']['days'];
  return {
    name: route.name,
    description: route.description ?? '',
    budgetRange: route.budgetRange ?? '',
    days: route.days,
    interestTags: route.interestTags ?? [],
    routeDetail: { days },
    unlockPrice: typeof detail.unlockPrice === 'number' ? detail.unlockPrice : 9.9,
    matchedCity: (detail.matchedCity as string) ?? '',
    isAiGenerated: true,
    ragMatchedCount: typeof detail.ragMatchedCount === 'number' ? detail.ragMatchedCount : undefined,
    ragCandidateCount: typeof detail.ragCandidateCount === 'number' ? detail.ragCandidateCount : undefined,
  };
}

function snapshotFromRoute(route: NonNullable<Awaited<ReturnType<typeof getRouteById>>>): PlanRouteSnapshot {
  const detail = (route.routeDetail ?? {}) as Record<string, unknown>;
  return buildRouteSnapshot({
    name: route.name,
    description: route.description ?? '',
    budgetRange: route.budgetRange ?? '',
    days: route.days,
    interestTags: route.interestTags ?? [],
    matchedCity: (detail.matchedCity as string) ?? '',
    routeDetail: { days: detail.days ?? [] },
  });
}

function resolveCandidateLabel(
  variantKey: string | null,
  storedLabel: string,
  locale: LocaleCode,
): string {
  const localized = formatPlanVariantLabel(variantKey, locale);
  return localized || storedLabel;
}

async function loadSessionCandidates(
  sessionId: number,
  userId: number,
  locale: LocaleCode = 'zh-CN',
): Promise<PlanRouteCandidate[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(planSessionCandidates)
    .where(eq(planSessionCandidates.sessionId, sessionId))
    .orderBy(planSessionCandidates.sortOrder);

  const candidates: PlanRouteCandidate[] = [];
  for (const row of rows) {
    const route = await getRouteById(row.routeId, userId);
    candidates.push({
      id: row.id,
      routeId: row.routeId,
      label: resolveCandidateLabel(row.variantKey, row.label, locale),
      variantKey: row.variantKey,
      sortOrder: row.sortOrder,
      isSelected: row.isSelected === 1,
      route,
    });
  }
  return candidates;
}

interface GeneratedCandidateRow {
  route: NonNullable<Awaited<ReturnType<typeof getRouteById>>>;
  generationSource: 'llm' | 'template';
  llmProvider?: string;
  label: string;
  variantKey: string;
  sortOrder: number;
}

async function generateSessionCandidates(
  userId: number,
  baseInput: GenerateRouteInput,
  intent: TravelIntentSnapshot,
  locale: LocaleCode = 'zh-CN',
): Promise<{ rows: GeneratedCandidateRow[]; candidateCount: number; memberLevel: number }> {
  const memberLevel = await getUserMemberLevel(userId);
  const candidateCount = await getPlanCandidateCountForUser(userId);
  const variants = buildPlanRouteVariants(intent, candidateCount);
  const results: GeneratedCandidateRow[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i]!;
    try {
      const { route, generationSource, llmProvider } = await createRouteFromPrompt(userId, {
        ...baseInput,
        locale,
        variantKey: variant.key,
        variantHint: formatPlanVariantHint(variant.key, locale),
        ragVariantIndex: i,
      });
      results.push({
        route,
        generationSource,
        llmProvider,
        label: formatPlanVariantLabel(variant.key, locale),
        variantKey: variant.key,
        sortOrder: i,
      });
    } catch (err) {
      console.warn(
        `[plan-session] 候选方案 ${variant.key} 生成失败:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { rows: results, candidateCount, memberLevel };
}

async function persistAgentResultAsSessionCandidates(
  userId: number,
  baseInput: GenerateRouteInput,
  locale: LocaleCode,
  agentResult: AgentPlanResult,
): Promise<{ rows: GeneratedCandidateRow[]; candidateCount: number; memberLevel: number } | null> {
  const memberLevel = await getUserMemberLevel(userId);
  const candidateCount = await getPlanCandidateCountForUser(userId);

  const candidateDrafts = agentResult.candidates?.length
    ? agentResult.candidates
    : agentResult.draft
      ? [{
          draft: agentResult.draft,
          variantKey: 'classic',
          label: formatPlanVariantLabel('classic', locale),
          sortOrder: 0,
        }]
      : [];

  if (candidateDrafts.length === 0) return null;

  const results: GeneratedCandidateRow[] = [];
  for (const item of candidateDrafts) {
    try {
      const { route, generationSource, llmProvider } = await createRouteFromAgentDraft(
        userId,
        item.draft as GeneratedRouteDraft & {
          generationSource?: 'llm' | 'template';
          llmProvider?: string;
          intent?: TravelIntentSnapshot;
        },
        {
          sourcePrompt: baseInput.prompt.trim(),
          provider: baseInput.provider,
        },
      );
      results.push({
        route,
        generationSource,
        llmProvider,
        label: item.label,
        variantKey: item.variantKey,
        sortOrder: item.sortOrder,
      });
    } catch (err) {
      console.warn(
        `[plan-session] Agent 候选 ${item.variantKey} 入库失败:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (results.length === 0) return null;
  return { rows: results, candidateCount, memberLevel };
}

async function tryGenerateSessionCandidatesViaAgent(
  userId: number,
  baseInput: GenerateRouteInput,
  intent: TravelIntentSnapshot,
  locale: LocaleCode,
): Promise<{
  pack: { rows: GeneratedCandidateRow[]; candidateCount: number; memberLevel: number };
  agentState: PlanSessionAgentState;
  agentResult: AgentPlanResult;
} | null> {
  if (!isAgentPlanEnabled()) return null;

  try {
    const agentResult = await runAgentPlan({
      prompt: baseInput.prompt,
      userId,
      days: baseInput.days,
      budget: baseInput.budget,
      provider: baseInput.provider ?? 'auto',
      locale,
      intent,
    });
    if (!agentResult) return null;

    const pack = await persistAgentResultAsSessionCandidates(
      userId,
      baseInput,
      locale,
      agentResult,
    );
    if (!pack) return null;

    const petMeta = await buildPlanPetMeta(userId, locale, agentResult);
    return {
      pack,
      agentState: buildPersistedAgentState(agentResult.routedIntent || 'plan_new', agentResult, petMeta),
      agentResult,
    };
  } catch (err) {
    console.warn(
      '[plan-session] Agent 首句失败，降级管道:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function persistSessionCandidates(
  sessionId: number,
  rows: GeneratedCandidateRow[],
  selectedRouteId: number,
) {
  const db = getDb();
  if (rows.length === 0) return;

  await db.insert(planSessionCandidates).values(
    rows.map((row) => ({
      sessionId,
      routeId: row.route.id,
      label: row.label,
      variantKey: row.variantKey,
      sortOrder: row.sortOrder,
      isSelected: row.route.id === selectedRouteId ? 1 : 0,
    })),
  );
}

export async function listPlanSessions(
  userId: number,
  limit = 20,
): Promise<PlanSessionSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: planSessions.id,
      routeId: planSessions.routeId,
      provider: planSessions.provider,
      status: planSessions.status,
      title: planSessions.title,
      intentSnapshot: planSessions.intentSnapshot,
      createdAt: planSessions.createdAt,
      updatedAt: planSessions.updatedAt,
      messageCount: sql<number>`count(${planSessionMessages.id})`.mapWith(Number),
    })
    .from(planSessions)
    .leftJoin(planSessionMessages, eq(planSessionMessages.sessionId, planSessions.id))
    .where(eq(planSessions.userId, userId))
    .groupBy(planSessions.id)
    .orderBy(desc(planSessions.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    routeId: row.routeId,
    provider: (row.provider as PlanSessionSummary['provider']) ?? null,
    status: row.status,
    title: row.title,
    messageCount: row.messageCount,
    intentSnapshot: (row.intentSnapshot as TravelIntentSnapshot | null) ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }));
}

export async function getPlanSessionDetail(
  sessionId: number,
  userId: number,
  locale: LocaleCode = 'zh-CN',
): Promise<PlanSessionInfo | null> {
  const session = await getOwnedSession(sessionId, userId);
  if (!session) return null;

  const messages = await loadSessionMessages(sessionId);
  const route = session.routeId ? await getRouteById(session.routeId, userId) : null;
  const candidates = await loadSessionCandidates(sessionId, userId, locale);

  return {
    id: session.id,
    routeId: session.routeId,
    provider: (session.provider as PlanSessionInfo['provider']) ?? null,
    status: session.status,
    title: session.title,
    messageCount: messages.length,
    intentSnapshot: (session.intentSnapshot as TravelIntentSnapshot | null) ?? null,
    agentState: parsePlanSessionAgentState(session.agentState),
    createdAt: toIso(session.createdAt),
    updatedAt: toIso(session.updatedAt),
    messages,
    route,
    candidates,
  };
}

export async function createPlanSession(
  userId: number,
  input: CreatePlanSessionRequest,
  locale: LocaleCode = 'zh-CN',
): Promise<PlanSessionActionResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new ApiError(ApiMessageKey.PLAN_PROMPT_REQUIRED);
  }

  const intent = await buildIntentFromHistoryAsync(undefined, prompt, {
    days: input.days,
    budget: input.budget,
  });
  const userContext = await loadPlanUserContext(userId);
  const resolvedIntent = finalizePlanningIntent(
    mergeIntentWithUserContext(intent, userContext),
  );

  const generateInput: GenerateRouteInput = {
    prompt,
    days: input.days,
    budget: input.budget,
    provider: input.provider,
    intent: resolvedIntent,
    locale,
    userId,
    excludePoiNames: userContext.excludePoiNames,
    boostPoiNames: userContext.boostPoiNames,
  };

  const agentGenerated = await tryGenerateSessionCandidatesViaAgent(
    userId,
    generateInput,
    resolvedIntent,
    locale,
  );
  const generatedPack = agentGenerated?.pack
    ?? await generateSessionCandidates(userId, generateInput, resolvedIntent, locale);
  const generated = generatedPack.rows;
  if (generated.length === 0) {
    throw new ApiError(ApiMessageKey.PLAN_GENERATE_EMPTY);
  }

  const primary = generated[0]!;
  const memberLevel = generatedPack.memberLevel;
  const memberPlanCandidateCount = generatedPack.candidateCount;
  const memberLevelLabel = getMemberLevelLabel(memberLevel);
  const baseReply = appendPlanAssistantWarnings(
    generated.length > 1
      ? buildMultiCandidateAssistantReply(
          generated.length,
          primary.route.name,
          resolvedIntent,
          locale,
        )
      : buildPlanAssistantReply(primary.route, resolvedIntent, locale),
    primary.route,
    locale,
  );
  const { message: assistantMessage, petMeta } = await finalizePlanAssistantMessage(
    baseReply,
    userId,
    locale,
    agentGenerated?.agentResult ?? null,
  );
  const persistedAgentState = agentGenerated?.agentState
    ? mergePetMetaIntoAgentState(agentGenerated.agentState, petMeta)
    : buildPersistedAgentState('plan_new', null, petMeta);
  const snapshot = snapshotFromRoute(primary.route);

  const db = getDb();
  const [sessionResult] = await db.insert(planSessions).values({
    userId,
    routeId: primary.route.id,
    provider: input.provider ?? 'auto',
    status: PlanSessionStatus.ACTIVE,
    title: truncateTitle(prompt),
    intentSnapshot: resolvedIntent as unknown as Record<string, unknown>,
    agentState: persistedAgentState,
  });
  const sessionId = Number(sessionResult.insertId);

  if (generated.length > 1) {
    await persistSessionCandidates(sessionId, generated, primary.route.id);
  }

  await db.insert(planSessionMessages).values([
    { sessionId, role: 'user', content: prompt },
    {
      sessionId,
      role: 'assistant',
      content: assistantMessage,
      routeSnapshot: snapshot,
    },
  ]);

  void writeTripMemory({
    userId,
    memoryType: PetMemoryType.TRIP_SUMMARY,
    content: `${resolvedIntent.city ?? primary.route.name} · ${primary.route.days}天 · ${resolvedIntent.themes.join('、')}`,
    metadata: { routeId: primary.route.id, sessionId },
  });

  const candidates =
    generated.length > 1 ? await loadSessionCandidates(sessionId, userId, locale) : undefined;

  return buildActionResult(sessionId, primary.route, assistantMessage, {
    generationSource: primary.generationSource,
    llmProvider: primary.llmProvider,
    intentSnapshot: resolvedIntent,
    ragMatchedCount: readRagMatchedCount(primary.route),
    candidates,
    memberPlanCandidateCount,
    memberLevel,
    memberLevelLabel,
    agentState: persistedAgentState,
    petMeta,
  });
}

export async function selectPlanSessionCandidate(
  sessionId: number,
  userId: number,
  routeId: number,
  locale: LocaleCode = 'zh-CN',
): Promise<PlanSessionActionResult | null> {
  const session = await getOwnedSession(sessionId, userId);
  if (!session) return null;
  if (session.status !== PlanSessionStatus.ACTIVE) {
    throw new ApiError(ApiMessageKey.PLAN_SESSION_ENDED);
  }

  const candidates = await loadSessionCandidates(sessionId, userId, locale);
  const picked = candidates.find((c) => c.routeId === routeId);
  if (!picked) {
    throw new ApiError(ApiMessageKey.PLAN_INVALID_CANDIDATE);
  }

  await applyPlanVariantToSession(sessionId, userId, routeId);

  const route = await getRouteById(routeId, userId);
  if (!route) return null;

  const refreshedCandidates = await loadSessionCandidates(sessionId, userId, locale);
  const baseSwitchReply = appendPlanAssistantWarnings(
    buildPlanCandidateSwitchedReply(picked.variantKey, route.name, locale),
    route,
    locale,
  );
  const { message: assistantMessage, petMeta } = await finalizePlanAssistantMessage(
    baseSwitchReply,
    userId,
    locale,
    null,
  );

  return buildActionResult(sessionId, route, assistantMessage, {
    intentSnapshot: (session.intentSnapshot as TravelIntentSnapshot | null) ?? null,
    ragMatchedCount: readRagMatchedCount(route),
    candidates: refreshedCandidates,
    petMeta,
  });
}

export async function appendPlanSessionMessage(
  sessionId: number,
  userId: number,
  content: string,
  locale: LocaleCode = 'zh-CN',
): Promise<PlanSessionActionResult | null> {
  const text = content.trim();
  if (!text) {
    throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
  }

  const memberLevel = await getUserMemberLevel(userId);
  if (!canAppendPlanByMemberLevel(memberLevel)) {
    throw new ApiError(ApiMessageKey.PLAN_SESSION_APPEND_NOT_ALLOWED);
  }

  const session = await getOwnedSession(sessionId, userId);
  if (!session) return null;
  if (session.status !== PlanSessionStatus.ACTIVE) {
    throw new ApiError(ApiMessageKey.PLAN_SESSION_ENDED);
  }
  if (!session.routeId) {
    throw new ApiError(ApiMessageKey.PLAN_SESSION_NO_ROUTE);
  }

  const routeId = session.routeId;

  const currentRoute = await getRouteById(routeId, userId);
  if (!currentRoute) return null;

  const previousMessages = await loadSessionMessages(sessionId);
  const history = buildHistoryForLlm(previousMessages);
  const userHistory: PlanChatMessage[] = previousMessages
    .filter((m) => m.role === 'user')
    .map((m) => ({ role: 'user', content: m.content }));

  beginPlanSessionGeneration(sessionId);
  const agentStreamHooks: AgentPlanStreamHooks = {
    onToolStart: (tool) => emitPlanSessionToolCall(sessionId, { tool, status: 'running' }),
    onToolEnd: (tool, ok, ms) =>
      emitPlanSessionToolCall(sessionId, { tool, status: ok ? 'done' : 'failed', ms }),
  };

  try {
    emitPlanSessionToolCall(sessionId, { tool: 'thinking', status: 'running' });

    const sessionIntent = (session.intentSnapshot as TravelIntentSnapshot | null) ?? null;

    const intent = await runPlanSessionTrackedTool(sessionId, 'parse_intent', () =>
      buildIntentFromHistoryAsync(userHistory, text, undefined, sessionIntent),
    );
    emitPlanSessionToolCall(sessionId, { tool: 'thinking', status: 'done', ms: 0 });

    const userContext = await loadPlanUserContext(userId);
    const resolvedIntent = finalizePlanningIntent(
      mergeIntentWithUserContext(intent, userContext),
    );

    let routeContentUpdated = false;
    let result: Awaited<ReturnType<typeof regenerateRouteFromPrompt>> = null;
    const routed = routeAgentIntent(text);
    let agentResult: AgentPlanResult | null = null;
    let assistantMessageOverride: string | undefined;

    const agentDraftUpdateRoutes = new Set([
      'tweak_day',
      'tweak_poi',
      'budget_tune',
      'lodging_tune',
    ]);

    if (isAgentPlanEnabled()) {
      agentResult = await runAgentPlan(
        {
          prompt: text,
          userId,
          sessionId,
          history,
          provider: session.provider ?? 'auto',
          locale,
          currentDraft: routeToDraft(currentRoute),
          intent: resolvedIntent,
        },
        agentStreamHooks,
      );

      if (agentResult?.selectedRouteId != null) {
        await applyPlanVariantToSession(sessionId, userId, agentResult.selectedRouteId);
        const switchedRoute = await getRouteById(agentResult.selectedRouteId, userId);
        if (switchedRoute) {
          routeContentUpdated = true;
          result = {
            route: switchedRoute,
            generationSource: 'llm',
            llmProvider: undefined,
            intent: resolvedIntent,
          };
          assistantMessageOverride = agentResult.assistantMessage;
        }
      } else if (agentResult?.assistantMessage && !agentResult.draft) {
        result = {
          route: currentRoute,
          generationSource: 'llm',
          llmProvider: undefined,
          intent: resolvedIntent,
        };
        assistantMessageOverride = agentResult.assistantMessage;
      } else if (agentResult?.draft && agentDraftUpdateRoutes.has(routed.route)) {
        const updated = await updateRouteFromAgentDraft(routeId, userId, agentResult.draft, {
          sourcePrompt: text,
          provider: (session.provider as GenerateRouteInput['provider']) ?? 'auto',
          intent: agentResult.draft.intent ?? resolvedIntent,
        });
        if (updated) {
          routeContentUpdated = true;
          result = {
            ...updated,
            llmProvider: undefined,
            intent: updated.intent ?? resolvedIntent,
          };
        }
      } else if (
        agentResult?.draft
        && routed.route !== 'qa_food'
        && routed.route !== 'select_variant'
      ) {
        const generateInput: GenerateRouteInput = {
          prompt: text,
          provider: (session.provider as GenerateRouteInput['provider']) ?? 'auto',
          history,
          intent: resolvedIntent,
          locale,
          userId,
          sessionId,
          excludePoiNames: userContext.excludePoiNames,
          boostPoiNames: userContext.boostPoiNames,
        };
        result = await runPlanSessionTrackedTool(sessionId, 'generate_route_draft', () =>
          regenerateRouteFromPrompt(routeId, userId, generateInput),
        );
        if (result) routeContentUpdated = true;
      }
    }

    if (!result) {
      if (routed.route === 'qa_food') {
        assistantMessageOverride = await runPlanSessionTrackedTool(sessionId, 'answer_food_qa', () =>
          answerFoodQa({
            intent: resolvedIntent,
            prompt: text,
            locale,
            userId,
          }),
        );
        result = {
          route: currentRoute,
          generationSource: 'llm',
          llmProvider: undefined,
          intent: resolvedIntent,
        };
      } else if (routed.route === 'select_variant') {
        const selected = await runPlanSessionTrackedTool(sessionId, 'select_plan_variant', () =>
          resolvePlanVariantSelection(sessionId, userId, text, locale),
        );
        if (selected) {
          await applyPlanVariantToSession(sessionId, userId, selected.routeId);
          const switchedRoute = await getRouteById(selected.routeId, userId);
          if (switchedRoute) {
            routeContentUpdated = true;
            result = {
              route: switchedRoute,
              generationSource: 'llm',
              llmProvider: undefined,
              intent: resolvedIntent,
            };
            assistantMessageOverride = selected.assistantMessage;
          }
        }
      } else {
        const generateInput: GenerateRouteInput = {
          prompt: text,
          provider: (session.provider as GenerateRouteInput['provider']) ?? 'auto',
          history,
          intent: resolvedIntent,
          locale,
          userId,
          sessionId,
          excludePoiNames: userContext.excludePoiNames,
          boostPoiNames: userContext.boostPoiNames,
        };
        result = await runPlanSessionTrackedTool(sessionId, 'generate_route_draft', () =>
          regenerateRouteFromPrompt(routeId, userId, generateInput),
        );
        if (result) routeContentUpdated = true;
      }
    }
    if (!result) {
      failPlanSessionStream(sessionId, ApiMessageKey.PLAN_SESSION_UPDATE_FAILED);
      return null;
    }

    const { route, generationSource, llmProvider, intent: resultIntent } = result;
    let baseAssistant =
      assistantMessageOverride
      ?? buildPlanAssistantReply(route, resultIntent ?? resolvedIntent, locale);
    if (routeContentUpdated) {
      baseAssistant = appendPlanAssistantWarnings(baseAssistant, route, locale);
    }
    const { message: assistantMessage, petMeta } = await finalizePlanAssistantMessage(
      baseAssistant,
      userId,
      locale,
      agentResult,
    );
    const snapshot =
      routed.route === 'qa_food' ? null : snapshotFromRoute(route);
    const refreshedCandidates = await loadSessionCandidates(sessionId, userId, locale);
    const persistedAgentState = mergePetMetaIntoAgentState(
      buildPersistedAgentState(routed.route, agentResult),
      petMeta,
    );

    const db = getDb();
    await db.insert(planSessionMessages).values([
      { sessionId, role: 'user', content: text },
      {
        sessionId,
        role: 'assistant',
        content: assistantMessage,
        routeSnapshot: snapshot,
      },
    ]);
    await db
      .update(planSessions)
      .set({
        updatedAt: new Date(),
        intentSnapshot: resolvedIntent as unknown as Record<string, unknown>,
        agentState: persistedAgentState,
      })
      .where(eq(planSessions.id, sessionId));

    const actionResult = buildActionResult(sessionId, route, assistantMessage, {
      generationSource,
      llmProvider,
      intentSnapshot: resultIntent ?? resolvedIntent,
      ragMatchedCount: readRagMatchedCount(route),
      candidates: refreshedCandidates.length > 1 ? refreshedCandidates : undefined,
      agentState: persistedAgentState,
      petMeta,
    });

    emitPlanSessionAssistantFinal(sessionId, assistantMessage);
    completePlanSessionStream(
      sessionId,
      actionResult as unknown as Record<string, unknown>,
    );
    return actionResult;
  } catch (err) {
    const messageKey = isApiError(err)
      ? err.messageKey
      : ApiMessageKey.PLAN_SESSION_UPDATE_FAILED;
    failPlanSessionStream(
      sessionId,
      messageKey,
      isApiError(err) ? err.params : undefined,
    );
    throw err;
  }
}
