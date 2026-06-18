/**
 * H3-c：宠物 AI 分析（pre_plan / post_trip）
 * 规则模板兜底；LLM 可用时短 prompt 增强；Redis 缓存 15 分钟
 */
import { z } from 'zod';
import {
  ApiError,
  ApiMessageKey,
  TRAVEL_PET_DEFAULT_NICKNAME,
  type LocaleCode,
  type PetAnalyzeRequest,
  type PetAnalyzeResult,
  type PetAnalyzeScene,
  type PetSuggestedAction,
  type PetSuggestedMemory,
} from '@douxing/shared';
import { chatCompletionForJson } from './llm-client.service.js';
import { loadPlanUserContext } from './plan-user-context.service.js';
import {
  PetMemoryType,
  buildMemoryRecallPackage,
  recallUserMemory,
} from './pet-memory.service.js';
import { getTravelPetByUserId } from './travel-pet.service.js';
import { getRouteById } from './route.service.js';
import { getCachedPetAnalyze, setCachedPetAnalyze } from './pet-analyze-cache.service.js';

const analyzeOutputSchema = z.object({
  insight: z.string(),
  petReply: z.string(),
  suggestedActions: z
    .array(
      z.object({
        kind: z.string(),
        label: z.string(),
        payload: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
  memoriesToSave: z
    .array(
      z.object({
        memoryType: z.string(),
        content: z.string(),
        importance: z.number().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
});

function buildRuleBasedPrePlan(
  locale: LocaleCode,
  nickname: string,
  interestTags: string[],
  memorySummary: string,
  themes: string[],
): PetAnalyzeResult {
  const isEn = locale === 'en-US';
  const tagHint = interestTags.slice(0, 3).join(isEn ? ', ' : '、');
  const themeHint = themes.slice(0, 3).join(isEn ? ', ' : '、');

  let insight: string;
  let petReply: string;
  const suggestedActions: PetSuggestedAction[] = [
    {
      kind: 'go_plan',
      label: isEn ? 'Start planning' : '去规划',
    },
  ];
  const memoriesToSave: PetSuggestedMemory[] = [];

  if (themes.length > 0 || memorySummary.includes('召回') || memorySummary.includes('Recalled')) {
    insight = isEn
      ? `Based on past memories, you tend to prefer: ${themeHint || tagHint || 'exploring at your own pace'}.`
      : `根据历史记忆，你更偏好：${themeHint || tagHint || '按自己节奏探索'}。`;
    petReply = isEn
      ? `${nickname}: I remember your style—want me to weave that into the next plan?`
      : `「${nickname}」：我记得你的偏好，下次规划要不要继续这个方向？`;
  } else if (tagHint) {
    insight = isEn
      ? `Your interest tags suggest focusing on: ${tagHint}.`
      : `你的兴趣标签显示可关注：${tagHint}。`;
    petReply = isEn
      ? `${nickname}: Your tags are a great starting point—shall we plan around them?`
      : `「${nickname}」：你的兴趣标签很适合作为规划起点，要试试吗？`;
    memoriesToSave.push({
      memoryType: PetMemoryType.PREFERENCE,
      content: isEn ? `Interested in ${tagHint}` : `关注${tagHint}`,
      importance: 6,
    });
  } else {
    insight = isEn
      ? 'No long-term memories yet—your first few trips will help me learn your style.'
      : '暂无长期记忆，多规划几次我会更了解你的旅行风格。';
    petReply = isEn
      ? `${nickname}: Tell me where you want to go—I will learn as we plan together!`
      : `「${nickname}」：告诉我你想去哪，我会边规划边记住你的喜好！`;
  }

  return {
    scene: 'pre_plan',
    insight,
    petReply,
    suggestedActions,
    memoriesToSave,
    cached: false,
    analyzedAt: new Date().toISOString(),
  };
}

function buildRuleBasedPostTrip(
  locale: LocaleCode,
  nickname: string,
  routeName: string,
  days: number,
): PetAnalyzeResult {
  const isEn = locale === 'en-US';
  const insight = isEn
    ? `Trip recap for 「${routeName}」 (${days} day(s)): note highlights and what to improve next time.`
    : `「${routeName}」${days} 日行程复盘：记录亮点与下次可改进之处。`;
  const petReply = isEn
    ? `${nickname}: That was a great trip! Want to save a summary to my memory wall?`
    : `「${nickname}」：这趟旅程很棒！要不要把摘要写进记忆墙？`;
  const summaryContent = isEn
    ? `Completed ${days}-day trip: ${routeName}`
    : `完成 ${days} 日行程：${routeName}`;

  return {
    scene: 'post_trip',
    insight,
    petReply,
    suggestedActions: [
      {
        kind: 'save_memory',
        label: isEn ? 'Save trip summary' : '保存行程摘要',
      },
    ],
    memoriesToSave: [
      {
        memoryType: PetMemoryType.TRIP_SUMMARY,
        content: summaryContent,
        importance: 7,
        metadata: { routeName, days },
      },
    ],
    cached: false,
    analyzedAt: new Date().toISOString(),
  };
}

function buildRuleBasedOnDemand(
  locale: LocaleCode,
  nickname: string,
  memorySummary: string,
): PetAnalyzeResult {
  const isEn = locale === 'en-US';
  return {
    scene: 'on_demand',
    insight: memorySummary,
    petReply: isEn
      ? `${nickname}: Here is what I know about you so far—ask me anytime on the memory wall.`
      : `「${nickname}」：这是我目前记得的事，随时可以在记忆墙里让我再分析。`,
    suggestedActions: [],
    memoriesToSave: [],
    cached: false,
    analyzedAt: new Date().toISOString(),
  };
}

async function tryLlmAnalyze(
  locale: LocaleCode,
  scene: PetAnalyzeScene,
  contextBlock: string,
): Promise<PetAnalyzeResult | null> {
  const isEn = locale === 'en-US';
  const systemPrompt = isEn
    ? `You are a travel companion pet. Analyze the user's travel context. Return JSON only with keys: insight, petReply, suggestedActions (array of {kind,label}), memoriesToSave (array of {memoryType,content,importance}). Do not invent facts not in the context. Scene: ${scene}.`
    : `你是旅行伙伴宠物。分析用户旅行上下文，仅返回 JSON：insight、petReply、suggestedActions（{kind,label} 数组）、memoriesToSave（{memoryType,content,importance} 数组）。勿编造上下文中不存在的事实。场景：${scene}。`;

  try {
    const { data } = await chatCompletionForJson(systemPrompt, contextBlock, analyzeOutputSchema, {
      temperature: 0.3,
      maxTokens: 800,
    });
    return {
      scene,
      insight: data.insight.trim(),
      petReply: data.petReply.trim(),
      suggestedActions: data.suggestedActions ?? [],
      memoriesToSave: data.memoriesToSave ?? [],
      cached: false,
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[pet-analyze] LLM 降级规则:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function analyzeTravelPet(
  userId: number,
  input: PetAnalyzeRequest,
  locale: LocaleCode,
  options?: { skipCache?: boolean },
): Promise<PetAnalyzeResult> {
  const scene = input.scene;
  const routeId = input.routeId;

  if (!options?.skipCache) {
    const cached = await getCachedPetAnalyze(userId, scene, routeId);
    if (cached) return cached;
  }

  const pet = await getTravelPetByUserId(userId);
  const nickname = pet?.nickname?.trim() || TRAVEL_PET_DEFAULT_NICKNAME;
  const userContext = await loadPlanUserContext(userId);
  const memories = await recallUserMemory(userId, { limit: 8 });
  const pack = buildMemoryRecallPackage(memories, locale);

  let result: PetAnalyzeResult;

  if (scene === 'pre_plan') {
    const contextBlock = [
      `nickname: ${nickname}`,
      `personality: ${pet?.personality ?? 'guide'}`,
      `interestTags: ${userContext.interestTags.join(', ')}`,
      `memorySummary: ${pack.memorySummary}`,
      `themes: ${pack.context.memoryThemes.join(', ')}`,
    ].join('\n');
    result =
      (await tryLlmAnalyze(locale, scene, contextBlock)) ??
      buildRuleBasedPrePlan(
        locale,
        nickname,
        userContext.interestTags,
        pack.memorySummary,
        pack.context.memoryThemes,
      );
  } else if (scene === 'post_trip') {
    if (!routeId) {
      throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
    }
    const route = await getRouteById(routeId, userId);
    if (!route) {
      throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
    }
    const days = route.days ?? 1;
    const contextBlock = [
      `nickname: ${nickname}`,
      `routeName: ${route.name}`,
      `days: ${days}`,
      `description: ${route.description ?? ''}`,
      `memorySummary: ${pack.memorySummary}`,
    ].join('\n');
    result =
      (await tryLlmAnalyze(locale, scene, contextBlock)) ??
      buildRuleBasedPostTrip(locale, nickname, route.name, days);
  } else {
    result =
      (await tryLlmAnalyze(locale, scene, `memorySummary: ${pack.memorySummary}`)) ??
      buildRuleBasedOnDemand(locale, nickname, pack.memorySummary);
  }

  await setCachedPetAnalyze(userId, scene, result, routeId);
  return result;
}

/** 读取 pre_plan 缓存供悬浮气泡使用（不触发新分析） */
export async function getPrePlanAnalyzeForFloating(
  userId: number,
): Promise<PetAnalyzeResult | null> {
  return getCachedPetAnalyze(userId, 'pre_plan');
}
