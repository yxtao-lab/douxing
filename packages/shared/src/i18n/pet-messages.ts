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
    'pet.floating.viewMemoryWall': '记忆墙',
    'pet.floating.analyzePrePlan': '分析一下偏好',
    'pet.memoryWall.title': '记忆墙',
    'pet.memoryWall.empty': '还没有长期记忆，完成旅行或规划后我会帮你记住',
    'pet.memoryWall.analyze': 'AI 分析',
    'pet.memoryWall.analyzePrePlan': '规划前分析',
    'pet.memoryWall.analyzePostTrip': '行后复盘',
    'pet.memoryWall.analyzing': '分析中…',
    'pet.memoryWall.insightTitle': '洞察',
    'pet.memoryWall.petReplyTitle': '伙伴说',
    'pet.memoryWall.suggestedMemories': '建议写入的记忆',
    'pet.memoryWall.confirmSave': '保存选中记忆',
    'pet.memoryWall.delete': '删除',
    'pet.memoryWall.pin': '置顶',
    'pet.memoryWall.unpin': '取消置顶',
    'pet.memoryWall.deleteConfirm': '确定删除这条记忆吗？',
    'pet.memoryWall.saved': '记忆已保存',
    'pet.memoryWall.deleted': '记忆已删除',
    'pet.memoryWall.cachedHint': '（缓存结果）',
    'pet.memoryType.preference': '偏好',
    'pet.memoryType.regret': '遗憾',
    'pet.memoryType.visited': '已到访',
    'pet.memoryType.trip_summary': '行程摘要',
    'pet.memoryType.milestone': '里程碑',
    'pet.analyze.scene.pre_plan': '规划前',
    'pet.analyze.scene.post_trip': '行后复盘',
    'pet.analyze.scene.on_demand': '综合分析',
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
    'pet.floating.viewMemoryWall': 'Memory wall',
    'pet.floating.analyzePrePlan': 'Analyze preferences',
    'pet.memoryWall.title': 'Memory wall',
    'pet.memoryWall.empty': 'No long-term memories yet—plan or finish a trip and I will remember for you',
    'pet.memoryWall.analyze': 'AI analysis',
    'pet.memoryWall.analyzePrePlan': 'Pre-plan analysis',
    'pet.memoryWall.analyzePostTrip': 'Post-trip recap',
    'pet.memoryWall.analyzing': 'Analyzing…',
    'pet.memoryWall.insightTitle': 'Insight',
    'pet.memoryWall.petReplyTitle': 'Companion says',
    'pet.memoryWall.suggestedMemories': 'Suggested memories to save',
    'pet.memoryWall.confirmSave': 'Save selected',
    'pet.memoryWall.delete': 'Delete',
    'pet.memoryWall.pin': 'Pin',
    'pet.memoryWall.unpin': 'Unpin',
    'pet.memoryWall.deleteConfirm': 'Delete this memory?',
    'pet.memoryWall.saved': 'Memories saved',
    'pet.memoryWall.deleted': 'Memory deleted',
    'pet.memoryWall.cachedHint': '(cached)',
    'pet.memoryType.preference': 'Preference',
    'pet.memoryType.regret': 'Regret',
    'pet.memoryType.visited': 'Visited',
    'pet.memoryType.trip_summary': 'Trip summary',
    'pet.memoryType.milestone': 'Milestone',
    'pet.analyze.scene.pre_plan': 'Pre-plan',
    'pet.analyze.scene.post_trip': 'Post-trip',
    'pet.analyze.scene.on_demand': 'On demand',
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

export function formatPetMemoryTypeLabel(memoryType: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  const key = `pet.memoryType.${memoryType}`;
  return petMsg(key, locale);
}

export function formatPetAnalyzeSceneLabel(scene: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  const key = `pet.analyze.scene.${scene}`;
  return petMsg(key, locale);
}

export function formatPetMemoryWallTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.title', locale);
}

export function formatPetMemoryWallEmpty(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.empty', locale);
}

export function formatPetFloatingViewMemoryWall(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.floating.viewMemoryWall', locale);
}

export function formatPetFloatingAnalyzePrePlan(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.floating.analyzePrePlan', locale);
}

export function formatPetMemoryWallAnalyze(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.analyze', locale);
}

export function formatPetMemoryWallAnalyzePrePlan(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.analyzePrePlan', locale);
}

export function formatPetMemoryWallAnalyzePostTrip(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.analyzePostTrip', locale);
}

export function formatPetMemoryWallAnalyzing(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.analyzing', locale);
}

export function formatPetMemoryWallInsightTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.insightTitle', locale);
}

export function formatPetMemoryWallPetReplyTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.petReplyTitle', locale);
}

export function formatPetMemoryWallSuggestedMemories(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.suggestedMemories', locale);
}

export function formatPetMemoryWallConfirmSave(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.confirmSave', locale);
}

export function formatPetMemoryWallDelete(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.delete', locale);
}

export function formatPetMemoryWallPin(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.pin', locale);
}

export function formatPetMemoryWallUnpin(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.unpin', locale);
}

export function formatPetMemoryWallDeleteConfirm(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.deleteConfirm', locale);
}

export function formatPetMemoryWallCachedHint(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.cachedHint', locale);
}
