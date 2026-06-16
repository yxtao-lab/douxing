import {
  getPlanRecentPromptsStorageKey,
  parsePlanRecentPrompts,
  pushPlanRecentPrompt,
} from '@douxing/shared';

export function loadPlanRecentPrompts(userId?: number | null): string[] {
  try {
    const raw = localStorage.getItem(getPlanRecentPromptsStorageKey(userId));
    if (!raw) return [];
    return parsePlanRecentPrompts(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePlanRecentPrompt(prompt: string, userId?: number | null): string[] {
  const next = pushPlanRecentPrompt(loadPlanRecentPrompts(userId), prompt);
  try {
    localStorage.setItem(getPlanRecentPromptsStorageKey(userId), JSON.stringify(next));
  } catch {
    /* 忽略配额或隐私模式 */
  }
  return next;
}
