/** 规划页近期发送内容（本地存储，跨端共用逻辑） */
export const PLAN_RECENT_PROMPTS_STORAGE_KEY = 'douxing_plan_recent_prompts';
export const PLAN_RECENT_PROMPTS_MAX = 8;
export const PLAN_RECENT_PROMPT_MAX_LENGTH = 200;
export const PLAN_RECENT_PROMPT_LABEL_MAX = 28;

export function getPlanRecentPromptsStorageKey(userId?: number | null): string {
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    return `${PLAN_RECENT_PROMPTS_STORAGE_KEY}:${userId}`;
  }
  return PLAN_RECENT_PROMPTS_STORAGE_KEY;
}

export function normalizePlanRecentPrompt(text: string): string | null {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length <= PLAN_RECENT_PROMPT_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, PLAN_RECENT_PROMPT_MAX_LENGTH);
}

export function parsePlanRecentPrompts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const normalized = normalizePlanRecentPrompt(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= PLAN_RECENT_PROMPTS_MAX) break;
  }
  return result;
}

export function pushPlanRecentPrompt(existing: string[], prompt: string): string[] {
  const normalized = normalizePlanRecentPrompt(prompt);
  if (!normalized) return existing;
  const filtered = existing.filter((item) => item !== normalized);
  return [normalized, ...filtered].slice(0, PLAN_RECENT_PROMPTS_MAX);
}

/** 芯片展示用截断文案 */
export function formatPlanRecentPromptLabel(
  prompt: string,
  maxLen: number = PLAN_RECENT_PROMPT_LABEL_MAX,
): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}
