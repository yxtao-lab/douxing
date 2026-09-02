/** 规划页「上次会话」本地持久化（按用户隔离） */
const PLAN_LAST_SESSION_STORAGE_KEY = 'douxing_plan_last_session_id';

/**
 * 生成上次规划会话 ID 的本地存储键。
 *
 * @param userId - 当前用户 ID；无效时回退为全局键
 * @returns 存储键字符串
 */
export function getPlanLastSessionStorageKey(userId?: number | null): string {
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    return `${PLAN_LAST_SESSION_STORAGE_KEY}:${userId}`;
  }
  return PLAN_LAST_SESSION_STORAGE_KEY;
}

/**
 * 读取本地记录的上次规划会话 ID。
 *
 * @param userId - 当前用户 ID；可选
 * @returns 有效会话 ID；无记录或解析失败时返回 `null`
 */
export function loadPlanLastSessionId(userId?: number | null): number | null {
  try {
    const raw = uni.getStorageSync(getPlanLastSessionStorageKey(userId));
    if (raw == null || raw === '') return null;
    const id = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(id) || id <= 0) return null;
    return Math.floor(id);
  } catch {
    return null;
  }
}

/**
 * 将规划会话 ID 写入本地，供下次进入规划页恢复。
 *
 * @param sessionId - 要记住的会话 ID
 * @param userId - 当前用户 ID；可选
 * @returns void
 */
export function savePlanLastSessionId(sessionId: number, userId?: number | null): void {
  if (!Number.isFinite(sessionId) || sessionId <= 0) return;
  try {
    uni.setStorageSync(getPlanLastSessionStorageKey(userId), Math.floor(sessionId));
  } catch {
    /* 忽略存储失败 */
  }
}

/**
 * 清除本地记录的上次规划会话 ID。
 *
 * @param userId - 当前用户 ID；可选
 * @returns void
 */
export function clearPlanLastSessionId(userId?: number | null): void {
  try {
    uni.removeStorageSync(getPlanLastSessionStorageKey(userId));
  } catch {
    /* 忽略清除失败 */
  }
}
