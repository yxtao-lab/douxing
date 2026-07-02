import type { LocaleCode } from './i18n/types.js';
import type { PlanPetMeta } from './types.js';
import {
  formatPlanPetEmptyMemory,
  formatPlanPetFocusTitle,
  formatPlanPetMemoryAppliedHint,
  formatPlanPetMemoryTitle,
  formatPetPersonalityLabel,
} from './i18n/pet-messages.js';

export interface PlanPetFocusViewModel {
  nickname: string;
  personalityLabel: string;
  title: string;
  /** @deprecated 规划页不再展开记忆列表，保留供浮层/测试兼容 */
  memoryTitle: string;
  /** @deprecated 规划页改用 memoryAppliedHint */
  memorySummary: string;
  /** 无记忆时的提示 */
  emptyMemoryText: string;
  /** 有记忆时在规划页展示的一行摘要（详情见旅行伙伴浮层） */
  memoryAppliedHint: string;
  /** @deprecated 规划页不再展示 recall 列表 */
  recallItems: Array<{ content: string; reason: string }>;
  showPanel: boolean;
  hasMemories: boolean;
}

/**
 * 构建规划页旅行伙伴紧凑卡片 ViewModel（不展开记忆墙内容）。
 *
 * @param petMeta - 会话宠物元数据
 * @param locale - 界面语言
 * @returns 紧凑卡片数据；无 petMeta 时为 `null`
 */
export function resolvePlanPetFocusViewModel(
  petMeta: PlanPetMeta | null | undefined,
  locale: LocaleCode,
): PlanPetFocusViewModel | null {
  if (!petMeta) return null;
  const hasMemories =
    (petMeta.recallExplain?.length ?? 0) > 0 || Boolean(petMeta.memorySummary?.trim());
  return {
    nickname: petMeta.nickname,
    personalityLabel: formatPetPersonalityLabel(petMeta.personality, locale),
    title: formatPlanPetFocusTitle(locale),
    memoryTitle: formatPlanPetMemoryTitle(locale),
    memorySummary: '',
    emptyMemoryText: formatPlanPetEmptyMemory(locale),
    memoryAppliedHint: hasMemories ? formatPlanPetMemoryAppliedHint(locale) : '',
    recallItems: [],
    showPanel: true,
    hasMemories,
  };
}
