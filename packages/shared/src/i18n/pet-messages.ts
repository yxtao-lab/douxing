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
    'pet.analyze.scene.in_plan': '规划中',
    'pet.analyze.scene.in_trip': '行中',
    'pet.memoryWall.analyzeInTrip': '行中分析',
    'pet.checkInCelebration.title': '打卡成功！',
    'pet.checkInCelebration.exp': '+{exp} EXP',
    'pet.checkInCelebration.levelUp': '升级啦！Lv.{prev} → Lv.{next}',
    'pet.checkInCelebration.reply.guide': '「{nickname}」：又解锁一处精彩，继续加油！',
    'pet.checkInCelebration.reply.foodie': '美食达人「{nickname}」：这站不错，下一顿更精彩！',
    'pet.checkInCelebration.reply.photo': '摄影向导「{nickname}」：记得多拍几张留念～',
    'pet.checkInCelebration.reply.family': '亲子伙伴「{nickname}」：小朋友也玩得很开心吧！',
    'pet.checkInCelebration.levelUpReply': '「{nickname}」：我变强啦，接下来陪你去更多地方！',
    'pet.checkInCelebration.ok': '知道了',
    'pet.inTrip.insight.progress': '今日已打卡 {checked} 处，计划还有 {remaining} 处待完成。',
    'pet.inTrip.insight.missed': '有 {count} 处「应到未到」，可考虑替补或记入遗憾。',
    'pet.inTrip.insight.onTrack': '行程节奏不错，按计划继续探索吧。',
    'pet.inTrip.reply.guide': '「{nickname}」：我在帮你盯着行程，需要的话可以刷新剩余安排。',
    'pet.inTrip.action.viewMissed': '查看遗漏',
    'pet.inTrip.action.refreshPlan': '刷新剩余行程',
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
    'pet.analyze.scene.in_plan': 'In planning',
    'pet.analyze.scene.in_trip': 'On trip',
    'pet.memoryWall.analyzeInTrip': 'In-trip analysis',
    'pet.checkInCelebration.title': 'Check-in success!',
    'pet.checkInCelebration.exp': '+{exp} EXP',
    'pet.checkInCelebration.levelUp': 'Level up! Lv.{prev} → Lv.{next}',
    'pet.checkInCelebration.reply.guide': '「{nickname}」: Another great stop—keep going!',
    'pet.checkInCelebration.reply.foodie': 'Food buddy 「{nickname}」: Nice spot—the next meal awaits!',
    'pet.checkInCelebration.reply.photo': 'Photo guide 「{nickname}」: Capture a few more shots!',
    'pet.checkInCelebration.reply.family': 'Family pal 「{nickname}」: Hope the kids had fun too!',
    'pet.checkInCelebration.levelUpReply': '「{nickname}」: I leveled up—let us explore more together!',
    'pet.checkInCelebration.ok': 'Got it',
    'pet.inTrip.insight.progress': 'Checked in {checked} today; {remaining} planned stops left.',
    'pet.inTrip.insight.missed': '{count} planned stop(s) missed—try alternatives or save as regret.',
    'pet.inTrip.insight.onTrack': 'You are on track—keep exploring as planned.',
    'pet.inTrip.reply.guide': '「{nickname}」: I am watching your itinerary—refresh remaining stops if needed.',
    'pet.inTrip.action.viewMissed': 'View missed stops',
    'pet.inTrip.action.refreshPlan': 'Refresh remaining plan',
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

export function formatPetMemoryWallAnalyzeInTrip(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.memoryWall.analyzeInTrip', locale);
}

export function formatPetCheckInCelebrationTitle(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.checkInCelebration.title', locale);
}

export function formatPetCheckInCelebrationOk(locale: LocaleCode = DEFAULT_LOCALE): string {
  return petMsg('pet.checkInCelebration.ok', locale);
}

export function formatPetCheckInCelebrationExp(
  locale: LocaleCode,
  params: { exp: number },
): string {
  return petMsg('pet.checkInCelebration.exp', locale, params);
}

export function formatPetCheckInCelebrationLevelUp(
  locale: LocaleCode,
  params: { prev: number; next: number },
): string {
  return petMsg('pet.checkInCelebration.levelUp', locale, params);
}

export function formatPetCheckInCelebrationReply(
  locale: LocaleCode,
  personality: string,
  params: { nickname: string },
): string {
  const key = `pet.checkInCelebration.reply.${personality}`;
  const table = PET_MESSAGES[locale] ?? PET_MESSAGES[DEFAULT_LOCALE];
  if (table[key]) return petMsg(key, locale, params);
  return petMsg('pet.checkInCelebration.reply.guide', locale, params);
}

export function formatPetCheckInCelebrationLevelUpReply(
  locale: LocaleCode,
  params: { nickname: string },
): string {
  return petMsg('pet.checkInCelebration.levelUpReply', locale, params);
}

export function formatPetInTripInsight(
  locale: LocaleCode,
  key: 'progress' | 'missed' | 'onTrack',
  params?: Record<string, string | number>,
): string {
  return petMsg(`pet.inTrip.insight.${key}`, locale, params);
}

export function formatPetInTripReply(
  locale: LocaleCode,
  params: { nickname: string },
): string {
  return petMsg('pet.inTrip.reply.guide', locale, params);
}

export function formatPetInTripAction(
  locale: LocaleCode,
  kind: 'viewMissed' | 'refreshPlan',
): string {
  return petMsg(`pet.inTrip.action.${kind}`, locale);
}
