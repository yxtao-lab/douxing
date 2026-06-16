import {
  getPlanRecentPromptsStorageKey,
  parsePlanRecentPrompts,
  pushPlanRecentPrompt,
} from '@douxing/shared';

export function loadPlanRecentPrompts(userId?: number | null): string[] {
  try {
    const raw = uni.getStorageSync(getPlanRecentPromptsStorageKey(userId));
    if (!raw) return [];
    if (typeof raw === 'string') {
      return parsePlanRecentPrompts(JSON.parse(raw));
    }
    return parsePlanRecentPrompts(raw);
  } catch {
    return [];
  }
}

export function savePlanRecentPrompt(prompt: string, userId?: number | null): string[] {
  const next = pushPlanRecentPrompt(loadPlanRecentPrompts(userId), prompt);
  try {
    uni.setStorageSync(getPlanRecentPromptsStorageKey(userId), JSON.stringify(next));
  } catch {
    /* 忽略存储失败 */
  }
  return next;
}
