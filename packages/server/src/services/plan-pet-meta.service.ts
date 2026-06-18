/**
 * H3-a / C7-c：规划会话 petMeta 构建与助手口吻包装
 */
import {
  TRAVEL_PET_DEFAULT_NICKNAME,
  wrapPlanAssistantWithPetTone,
  type LocaleCode,
  type PlanPetMeta,
  type TravelPetPersonality,
} from '@douxing/shared';
import type { AgentPlanResult } from './agent-plan-client.service.js';
import {
  buildMemoryRecallPackage,
  recallUserMemory,
} from './pet-memory.service.js';
import { getTravelPetByUserId } from './travel-pet.service.js';

export async function buildPlanPetMeta(
  userId: number,
  locale: LocaleCode,
  agentResult?: AgentPlanResult | null,
): Promise<PlanPetMeta> {
  const pet = await getTravelPetByUserId(userId);
  const nickname = pet?.nickname?.trim() || TRAVEL_PET_DEFAULT_NICKNAME;
  const personality = (pet?.personality ?? 'guide') as TravelPetPersonality;
  const species = pet?.species ?? 'fox';

  if (agentResult?.memorySummary) {
    return {
      nickname,
      species,
      personality,
      memorySummary: agentResult.memorySummary,
      recallExplain: agentResult.recallExplain ?? [],
    };
  }

  const memories = await recallUserMemory(userId, { limit: 8 });
  const pack = buildMemoryRecallPackage(memories, locale);
  return {
    nickname,
    species,
    personality,
    memorySummary: pack.memorySummary,
    recallExplain: pack.recallExplain,
  };
}

export async function finalizePlanAssistantMessage(
  baseMessage: string,
  userId: number,
  locale: LocaleCode,
  agentResult?: AgentPlanResult | null,
): Promise<{ message: string; petMeta: PlanPetMeta }> {
  const petMeta = await buildPlanPetMeta(userId, locale, agentResult);
  const message = wrapPlanAssistantWithPetTone(baseMessage, petMeta, locale);
  return { message, petMeta };
}

export function mergePetMetaIntoAgentState(
  state: import('@douxing/shared').PlanSessionAgentState,
  petMeta: PlanPetMeta,
): import('@douxing/shared').PlanSessionAgentState {
  return { ...state, petMeta };
}
