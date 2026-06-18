import type { MemoryRecallExplainItem, PlanPetMeta } from '../types.js';
import type { LocaleCode } from './types.js';
import type { TravelPetMood, TravelPetPersonality } from '../travel-pet.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';

const PET_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'pet.personality.guide': '向导',
    'pet.personality.foodie': '美食达人',
    'pet.personality.photo': '摄影向导',
    'pet.personality.family': '亲子伙伴',
    'pet.planFocus.title': '旅行伙伴',
    'pet.planFocus.memoryTitle': '我记得的事',
    'pet.planFocus.emptyMemory': '还没有长期记忆，多规划几次我会更懂你',
    'pet.assistant.prefix.guide': '「{nickname}」：',
    'pet.assistant.prefix.foodie': '美食达人「{nickname}」：',
    'pet.assistant.prefix.photo': '摄影向导「{nickname}」：',
    'pet.assistant.prefix.family': '亲子伙伴「{nickname}」：',
    'pet.floating.sheetTitle': '旅行伙伴',
    'pet.floating.goPlan': '去规划',
    'pet.floating.level': 'Lv.{level}',
    'pet.floating.mood.happy': '心情不错',
    'pet.floating.mood.calm': '平静',
    'pet.floating.mood.excited': '超兴奋',
    'pet.floating.mood.sleepy': '有点困',
    'pet.floating.ambient.noMemory': '嗨，{nickname}！一起规划下一段旅程吧',
    'pet.floating.ambient.withMemory': '记得你提过「{hint}」，要不要再安排一次？',
  },
  'en-US': {
    'pet.personality.guide': 'Guide',
    'pet.personality.foodie': 'Food explorer',
    'pet.personality.photo': 'Photo guide',
    'pet.personality.family': 'Family buddy',
    'pet.planFocus.title': 'Travel companion',
    'pet.planFocus.memoryTitle': 'What I remember',
    'pet.planFocus.emptyMemory': 'No long-term memories yet—plan a few trips and I will learn your style',
    'pet.assistant.prefix.guide': '「{nickname}」: ',
    'pet.assistant.prefix.foodie': 'Food buddy 「{nickname}」: ',
    'pet.assistant.prefix.photo': 'Photo guide 「{nickname}」: ',
    'pet.assistant.prefix.family': 'Family pal 「{nickname}」: ',
    'pet.floating.sheetTitle': 'Travel companion',
    'pet.floating.goPlan': 'Start planning',
    'pet.floating.level': 'Lv.{level}',
    'pet.floating.mood.happy': 'Feeling good',
    'pet.floating.mood.calm': 'Calm',
    'pet.floating.mood.excited': 'Super excited',
    'pet.floating.mood.sleepy': 'A bit sleepy',
    'pet.floating.ambient.noMemory': 'Hey {nickname}! Ready to plan your next trip?',
    'pet.floating.ambient.withMemory': 'I remember you mentioned 「{hint}」—want to try again?',
  },
};

function petMsg(key: string, locale: LocaleCode, params?: Record<string, string | number>): string {
  const table = PET_MESSAGES[locale] ?? PET_MESSAGES[DEFAULT_LOCALE];
  const fallback = PET_MESSAGES[DEFAULT_LOCALE];
  return formatMessage(table[key] ?? fallback[key] ?? key, params);
}

export function formatPetPersonalityLabel(
  personality: TravelPetPersonality | string,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const key = `pet.personality.${personality}`;
  return petMsg(key, locale);
}

export function formatPlanPetFocusTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.planFocus.title', locale);
}

export function formatPlanPetMemoryTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.planFocus.memoryTitle', locale);
}

export function formatPlanPetEmptyMemory(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.planFocus.emptyMemory', locale);
}

function resolveAssistantPrefix(
  petMeta: Pick<PlanPetMeta, 'nickname' | 'personality'>,
  locale: LocaleCode,
): string {
  const personality = petMeta.personality || 'guide';
  const key = `pet.assistant.prefix.${personality}`;
  return petMsg(key, locale, { nickname: petMeta.nickname });
}

/** C7-c / H3-a：助手回复加宠物口吻前缀（已含前缀则跳过） */
export function wrapPlanAssistantWithPetTone(
  message: string,
  petMeta: Pick<PlanPetMeta, 'nickname' | 'personality'>,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  const nickname = petMeta.nickname.trim();
  if (nickname && trimmed.startsWith(`「${nickname}」`)) return trimmed;
  if (nickname && trimmed.includes(`「${nickname}」：`)) return trimmed;
  return `${resolveAssistantPrefix(petMeta, locale)}${trimmed}`;
}

export function buildPlanPetFocusRecallItems(
  recallExplain: MemoryRecallExplainItem[] | undefined,
  limit = 4,
): Array<{ content: string; reason: string }> {
  if (!recallExplain?.length) return [];
  return recallExplain.slice(0, limit).map((item) => ({
    content: item.content,
    reason: item.reason,
  }));
}

export function formatPetFloatingSheetTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.floating.sheetTitle', locale);
}

export function formatPetFloatingGoPlan(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.floating.goPlan', locale);
}

export function formatPetFloatingLevelLabel(
  locale: LocaleCode,
  params: { level: number },
): string {
  return petMsg('pet.floating.level', locale, params);
}

export function formatPetFloatingMoodLabel(mood: TravelPetMood | string, locale: LocaleCode): string {
  const key = `pet.floating.mood.${mood}`;
  return petMsg(key, locale);
}

export function formatPetFloatingAmbientNoMemory(
  locale: LocaleCode,
  params: { nickname: string },
): string {
  return petMsg('pet.floating.ambient.noMemory', locale, params);
}

export function formatPetFloatingAmbientWithMemory(
  locale: LocaleCode,
  params: { nickname: string; hint: string },
): string {
  return petMsg('pet.floating.ambient.withMemory', locale, params);
}
