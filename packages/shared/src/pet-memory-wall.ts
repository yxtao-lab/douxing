import type { LocaleCode } from './i18n/types.js';
import { formatDisplayDateTime } from './display-datetime.js';
import {
  formatPetAnalyzeSceneLabel,
  formatPetMemoryTypeLabel,
  formatPetMemoryWallAnalyze,
  formatPetMemoryWallAnalyzePrePlan,
  formatPetMemoryWallAnalyzing,
  formatPetMemoryWallCachedHint,
  formatPetMemoryWallConfirmSave,
  formatPetMemoryWallDelete,
  formatPetMemoryWallDeleteConfirm,
  formatPetMemoryWallEmpty,
  formatPetMemoryWallInsightTitle,
  formatPetMemoryWallPetReplyTitle,
  formatPetMemoryWallPin,
  formatPetMemoryWallSuggestedMemories,
  formatPetMemoryWallTitle,
  formatPetMemoryWallUnpin,
} from './i18n/pet-messages.js';

/** H3-c：宠物分析场景；H3-d 扩展 in_plan / in_trip */
export const PET_ANALYZE_SCENES = ['pre_plan', 'post_trip', 'on_demand', 'in_plan', 'in_trip'] as const;
export type PetAnalyzeScene = (typeof PET_ANALYZE_SCENES)[number];

export function isPetAnalyzeScene(value: string): value is PetAnalyzeScene {
  return (PET_ANALYZE_SCENES as readonly string[]).includes(value);
}

/** 记忆墙单条记录 */
export interface PetMemoryWallItem {
  id: number;
  memoryType: string;
  content: string;
  importance: number;
  pinned: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PetSuggestedAction {
  kind: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface PetSuggestedMemory {
  memoryType: string;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface PetAnalyzeRequest {
  scene: PetAnalyzeScene;
  routeId?: number;
  sessionId?: number;
}

/** analyze API 响应 */
export interface PetAnalyzeResult {
  scene: PetAnalyzeScene;
  insight: string;
  petReply: string;
  suggestedActions: PetSuggestedAction[];
  memoriesToSave: PetSuggestedMemory[];
  cached: boolean;
  analyzedAt: string;
}

export interface ConfirmPetMemoriesRequest {
  items: PetSuggestedMemory[];
}

export interface PetMemoryWallListItemViewModel {
  id: number;
  typeLabel: string;
  content: string;
  importance: number;
  pinned: boolean;
  dateLabel: string;
}

export interface PetAnalyzeCardViewModel {
  sceneLabel: string;
  insight: string;
  petReply: string;
  suggestedActions: PetSuggestedAction[];
  memoriesToSave: Array<PetSuggestedMemory & { selected: boolean }>;
  analyzedAtLabel: string;
  cached: boolean;
}

/** 格式化记忆墙日期（客户端传入 locale，展示统一为 yy-mm-dd HH:mm:ss） */
export function formatPetMemoryDateLabel(iso: string, _locale: LocaleCode): string {
  return formatDisplayDateTime(iso) || iso;
}

export function buildPetMemoryWallListItemViewModel(
  item: PetMemoryWallItem,
  locale: LocaleCode,
): PetMemoryWallListItemViewModel {
  return {
    id: item.id,
    typeLabel: formatPetMemoryTypeLabel(item.memoryType, locale),
    content: item.content,
    importance: item.importance,
    pinned: item.pinned,
    dateLabel: formatPetMemoryDateLabel(item.updatedAt || item.createdAt, locale),
  };
}

export interface PetMemoryWallPageCopy {
  title: string;
  empty: string;
  analyze: string;
  analyzePrePlan: string;
  analyzing: string;
  insightTitle: string;
  petReplyTitle: string;
  suggestedMemories: string;
  confirmSave: string;
  deleteLabel: string;
  pinLabel: string;
  unpinLabel: string;
  deleteConfirm: string;
  cachedHint: string;
}

export function resolvePetMemoryWallPageCopy(locale: LocaleCode): PetMemoryWallPageCopy {
  return {
    title: formatPetMemoryWallTitle(locale),
    empty: formatPetMemoryWallEmpty(locale),
    analyze: formatPetMemoryWallAnalyze(locale),
    analyzePrePlan: formatPetMemoryWallAnalyzePrePlan(locale),
    analyzing: formatPetMemoryWallAnalyzing(locale),
    insightTitle: formatPetMemoryWallInsightTitle(locale),
    petReplyTitle: formatPetMemoryWallPetReplyTitle(locale),
    suggestedMemories: formatPetMemoryWallSuggestedMemories(locale),
    confirmSave: formatPetMemoryWallConfirmSave(locale),
    deleteLabel: formatPetMemoryWallDelete(locale),
    pinLabel: formatPetMemoryWallPin(locale),
    unpinLabel: formatPetMemoryWallUnpin(locale),
    deleteConfirm: formatPetMemoryWallDeleteConfirm(locale),
    cachedHint: formatPetMemoryWallCachedHint(locale),
  };
}

export function buildPetAnalyzeCardViewModel(
  result: PetAnalyzeResult,
  locale: LocaleCode,
): PetAnalyzeCardViewModel {
  return {
    sceneLabel: formatPetAnalyzeSceneLabel(result.scene, locale),
    insight: result.insight,
    petReply: result.petReply,
    suggestedActions: result.suggestedActions,
    memoriesToSave: result.memoriesToSave.map((m) => ({ ...m, selected: true })),
    analyzedAtLabel: formatPetMemoryDateLabel(result.analyzedAt, locale),
    cached: result.cached,
  };
}
