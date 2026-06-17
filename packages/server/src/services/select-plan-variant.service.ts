/**
 * C7-b Step 4：从追问文案解析方案字母并匹配会话候选
 */
import { and, eq } from 'drizzle-orm';
import {
  buildPlanCandidateSwitchedReply,
  type LocaleCode,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { planSessionCandidates } from '../db/schema/plan-sessions.js';

/** 「就方案B」→ 1（0-based，对应 sortOrder） */
export function parseVariantIndexFromPrompt(text: string): number | null {
  const match = text.match(/方案\s*([A-Ea-e])/);
  if (!match?.[1]) return null;
  const index = match[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  return index >= 0 ? index : null;
}

export interface SelectPlanVariantResult {
  routeId: number;
  variantKey: string | null;
  assistantMessage: string;
}

export async function resolvePlanVariantSelection(
  sessionId: number,
  userId: number,
  prompt: string,
  locale: LocaleCode = 'zh-CN',
): Promise<SelectPlanVariantResult | null> {
  const variantIndex = parseVariantIndexFromPrompt(prompt);
  if (variantIndex == null) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(planSessionCandidates)
    .where(eq(planSessionCandidates.sessionId, sessionId))
    .orderBy(planSessionCandidates.sortOrder);

  const picked = rows[variantIndex];
  if (!picked) return null;

  const { getRouteById } = await import('./route.service.js');
  const route = await getRouteById(picked.routeId, userId);
  if (!route) return null;

  return {
    routeId: picked.routeId,
    variantKey: picked.variantKey,
    assistantMessage: buildPlanCandidateSwitchedReply(picked.variantKey, route.name, locale),
  };
}
