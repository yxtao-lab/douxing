import type { LocaleCode } from './i18n/types.js';
import type { PlanPetMeta } from './types.js';
import {
  buildPlanPetFocusRecallItems,
  formatPlanPetEmptyMemory,
  formatPlanPetFocusTitle,
  formatPlanPetMemoryTitle,
  formatPetPersonalityLabel,
} from './i18n/pet-messages.js';

export interface PlanPetFocusViewModel {
  nickname: string;
  personalityLabel: string;
  title: string;
  memoryTitle: string;
  memorySummary: string;
  emptyMemoryText: string;
  recallItems: Array<{ content: string; reason: string }>;
  showPanel: boolean;
  hasMemories: boolean;
}

export function resolvePlanPetFocusViewModel(
  petMeta: PlanPetMeta | null | undefined,
  locale: LocaleCode,
): PlanPetFocusViewModel | null {
  if (!petMeta) return null;
  const recallItems = buildPlanPetFocusRecallItems(petMeta.recallExplain);
  const hasMemories = recallItems.length > 0 || Boolean(petMeta.memorySummary?.trim());
  return {
    nickname: petMeta.nickname,
    personalityLabel: formatPetPersonalityLabel(petMeta.personality, locale),
    title: formatPlanPetFocusTitle(locale),
    memoryTitle: formatPlanPetMemoryTitle(locale),
    memorySummary: petMeta.memorySummary?.trim() ?? '',
    emptyMemoryText: formatPlanPetEmptyMemory(locale),
    recallItems,
    showPanel: true,
    hasMemories,
  };
}
