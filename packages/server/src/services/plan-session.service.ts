import { eq, desc, and, sql } from 'drizzle-orm';
import type {
  PlanChatMessage,
  PlanSessionActionResult,
  PlanSessionInfo,
  PlanSessionMessageInfo,
  PlanSessionSummary,
  CreatePlanSessionRequest,
  TravelIntentSnapshot,
} from '@douxing/shared';
import { PlanSessionStatus } from '@douxing/shared';
import { getDb } from '../db/client.js';
import {
  planSessions,
  planSessionMessages,
  type PlanRouteSnapshot,
} from '../db/schema/plan-sessions.js';
import {
  createRouteFromPrompt,
  regenerateRouteFromPrompt,
  getRouteById,
} from './route.service.js';
import type { GenerateRouteInput } from './route-generator.service.js';
import {
  buildIntentFromHistory,
  formatIntentSummary,
} from './travel-intent.service.js';

const SESSION_TITLE_MAX = 40;

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

function buildAssistantReply(
  route: {
    name: string;
    description: string | null;
    days: number;
    budgetRange: string | null;
    routeDetail?: Record<string, unknown> | null;
  },
  intent?: TravelIntentSnapshot,
): string {
  const budget = route.budgetRange ? `，预算 ${route.budgetRange}` : '';
  const intentHint = intent ? `\n已理解需求：${formatIntentSummary(intent)}` : '';
  const detail = route.routeDetail ?? {};
  const ragMatched = typeof detail.ragMatchedCount === 'number' ? detail.ragMatchedCount : 0;
  const ragHint =
    ragMatched > 0 ? `\n已引用内容库景点 ${ragMatched} 处` : '';
  return `已为您生成「${route.name}」：${route.description ?? ''}（${route.days} 天${budget}）${intentHint}${ragHint}`;
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
  },
): PlanSessionActionResult {
  return {
    ...route,
    sessionId,
    assistantMessage,
    intentSnapshot: meta.intentSnapshot ?? null,
    ragMatchedCount: meta.ragMatchedCount ?? 0,
    generationSource: meta.generationSource,
    llmProvider: meta.llmProvider as PlanSessionActionResult['llmProvider'],
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
): Promise<PlanSessionInfo | null> {
  const session = await getOwnedSession(sessionId, userId);
  if (!session) return null;

  const messages = await loadSessionMessages(sessionId);
  const route = session.routeId ? await getRouteById(session.routeId, userId) : null;

  return {
    id: session.id,
    routeId: session.routeId,
    provider: (session.provider as PlanSessionInfo['provider']) ?? null,
    status: session.status,
    title: session.title,
    messageCount: messages.length,
    intentSnapshot: (session.intentSnapshot as TravelIntentSnapshot | null) ?? null,
    createdAt: toIso(session.createdAt),
    updatedAt: toIso(session.updatedAt),
    messages,
    route,
  };
}

export async function createPlanSession(
  userId: number,
  input: CreatePlanSessionRequest,
): Promise<PlanSessionActionResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error('请描述您的旅行需求');
  }

  const intent = buildIntentFromHistory(undefined, prompt, {
    days: input.days,
    budget: input.budget,
  });

  const generateInput: GenerateRouteInput = {
    prompt,
    days: input.days,
    budget: input.budget,
    provider: input.provider,
    intent,
  };

  const { route, generationSource, llmProvider, intent: resolvedIntent } =
    await createRouteFromPrompt(userId, generateInput);
  const assistantMessage = buildAssistantReply(route, resolvedIntent);
  const snapshot = snapshotFromRoute(route);

  const db = getDb();
  const [sessionResult] = await db.insert(planSessions).values({
    userId,
    routeId: route.id,
    provider: input.provider ?? 'auto',
    status: PlanSessionStatus.ACTIVE,
    title: truncateTitle(prompt),
    intentSnapshot: resolvedIntent as unknown as Record<string, unknown>,
  });
  const sessionId = Number(sessionResult.insertId);

  await db.insert(planSessionMessages).values([
    { sessionId, role: 'user', content: prompt },
    {
      sessionId,
      role: 'assistant',
      content: assistantMessage,
      routeSnapshot: snapshot,
    },
  ]);

  return buildActionResult(sessionId, route, assistantMessage, {
    generationSource,
    llmProvider,
    intentSnapshot: resolvedIntent,
    ragMatchedCount: readRagMatchedCount(route),
  });
}

export async function appendPlanSessionMessage(
  sessionId: number,
  userId: number,
  content: string,
): Promise<PlanSessionActionResult | null> {
  const text = content.trim();
  if (!text) {
    throw new Error('请输入追问或修改意见');
  }

  const session = await getOwnedSession(sessionId, userId);
  if (!session) return null;
  if (session.status !== PlanSessionStatus.ACTIVE) {
    throw new Error('该会话已结束，请新建规划');
  }
  if (!session.routeId) {
    throw new Error('会话尚未关联路线，请重新发起规划');
  }

  const previousMessages = await loadSessionMessages(sessionId);
  const history = buildHistoryForLlm(previousMessages);
  const userHistory: PlanChatMessage[] = previousMessages
    .filter((m) => m.role === 'user')
    .map((m) => ({ role: 'user', content: m.content }));

  const intent = buildIntentFromHistory(userHistory, text);

  const generateInput: GenerateRouteInput = {
    prompt: text,
    provider: (session.provider as GenerateRouteInput['provider']) ?? 'auto',
    history,
    intent,
  };

  const result = await regenerateRouteFromPrompt(session.routeId, userId, generateInput);
  if (!result) return null;

  const { route, generationSource, llmProvider, intent: resolvedIntent } = result;
  const assistantMessage = buildAssistantReply(route, resolvedIntent);
  const snapshot = snapshotFromRoute(route);

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
    .set({ updatedAt: new Date(), intentSnapshot: resolvedIntent as unknown as Record<string, unknown> })
    .where(eq(planSessions.id, sessionId));

  return buildActionResult(sessionId, route, assistantMessage, {
    generationSource,
    llmProvider,
    intentSnapshot: resolvedIntent,
    ragMatchedCount: readRagMatchedCount(route),
  });
}
