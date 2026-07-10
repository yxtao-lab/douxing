import type { LocaleCode } from './i18n/types.js';
import {
  buildPlanPetFocusRecallItems,
  formatPetFloatingAmbientNoMemory,
  formatPetFloatingAmbientWithMemory,
  formatPetFloatingAnalyzePrePlan,
  formatPetFloatingGoPlan,
  formatPetFloatingHideCompanion,
  formatPetFloatingLevelLabel,
  formatPetFloatingMoodLabel,
  formatPetFloatingSheetTitle,
  formatPetFloatingViewMemoryWall,
  formatPetPersonalityLabel,
  formatPlanPetEmptyMemory,
  formatPlanPetMemoryTitle,
} from './i18n/pet-messages.js';
import type { PetAnalyzeResult } from './pet-memory-wall.js';
import type { PlanPetMeta } from './types.js';
import type { TravelPetInfo } from './travel-pet.js';

/** 简洁模式：关闭后全站不渲染浮层 */
export const PET_COMPANION_VISIBLE_STORAGE_KEY = 'dx.petCompanionVisible';

/** 浮球位置持久化（相对视口 px） */
export const PET_COMPANION_BALL_POSITION_STORAGE_KEY = 'dx.petCompanionBallPosition';

export interface PetCompanionBallPosition {
  x: number;
  y: number;
}

export interface TravelPetFloatingSheetViewModel {
  nickname: string;
  speciesEmoji: string;
  personalityLabel: string;
  moodLabel: string;
  levelLabel: string;
  sheetTitle: string;
  memoryTitle: string;
  memorySummary: string;
  emptyMemoryText: string;
  recallItems: Array<{ content: string; reason: string }>;
  hasMemories: boolean;
  goPlanLabel: string;
  viewMemoryWallLabel: string;
  analyzePrePlanLabel: string;
  hideCompanionLabel: string;
}

const SPECIES_EMOJI: Record<string, string> = {
  fox: '🦊',
  cat: '🐱',
  panda: '🐼',
};

export function resolveTravelPetSpeciesEmoji(species: string): string {
  return SPECIES_EMOJI[species] ?? '🦊';
}

export function isPetCompanionVisibleEnabled(stored: string | null | undefined): boolean {
  if (stored === '0' || stored === 'false') return false;
  return true;
}

/** L1 待机气泡：优先读 pre_plan analyze 缓存，否则规则模板 */
export function resolveTravelPetAmbientBubble(
  pet: Pick<TravelPetInfo, 'nickname' | 'personality' | 'mood'>,
  petMeta: PlanPetMeta | null | undefined,
  locale: LocaleCode,
  prePlanAnalyze?: PetAnalyzeResult | null,
): string {
  const cachedReply = prePlanAnalyze?.petReply?.trim();
  if (cachedReply) return cachedReply;

  const hint = petMeta?.recallExplain?.[0]?.content?.trim();
  if (hint) {
    return formatPetFloatingAmbientWithMemory(locale, { nickname: pet.nickname, hint });
  }
  return formatPetFloatingAmbientNoMemory(locale, { nickname: pet.nickname });
}

export function resolveTravelPetFloatingSheetViewModel(
  pet: TravelPetInfo,
  petMeta: PlanPetMeta | null | undefined,
  locale: LocaleCode,
): TravelPetFloatingSheetViewModel {
  const recallItems = buildPlanPetFocusRecallItems(petMeta?.recallExplain);
  const hasMemories = recallItems.length > 0 || Boolean(petMeta?.memorySummary?.trim());
  return {
    nickname: pet.nickname,
    speciesEmoji: resolveTravelPetSpeciesEmoji(pet.species),
    personalityLabel: formatPetPersonalityLabel(pet.personality, locale),
    moodLabel: formatPetFloatingMoodLabel(pet.mood, locale),
    levelLabel: formatPetFloatingLevelLabel(locale, { level: pet.level }),
    sheetTitle: formatPetFloatingSheetTitle(locale),
    memoryTitle: formatPlanPetMemoryTitle(locale),
    memorySummary: petMeta?.memorySummary?.trim() ?? '',
    emptyMemoryText: formatPlanPetEmptyMemory(locale),
    recallItems,
    hasMemories,
    goPlanLabel: formatPetFloatingGoPlan(locale),
    viewMemoryWallLabel: formatPetFloatingViewMemoryWall(locale),
    analyzePrePlanLabel: formatPetFloatingAnalyzePrePlan(locale),
    hideCompanionLabel: formatPetFloatingHideCompanion(locale),
  };
}
