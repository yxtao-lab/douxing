import type { ScenePlanUserProfileInput } from '@douxing/shared';
import { buildSceneCustomPlanPrompt } from '@douxing/shared';

/** 规划 Tab 启动意图（switchTab 无法带 query，用本地存储中转） */
const PLAN_LAUNCH_INTENT_KEY = 'douxing_plan_launch_intent';

export interface PlanLaunchIntent {
  /** 预填并可选自动发送的用户消息 */
  prompt: string;
  /** 是否自动发送 */
  autoSend?: boolean;
  /** 是否清空当前会话视图后再规划 */
  fresh?: boolean;
  /** 显式场景标签（写入规划 API，决定路线专题归属） */
  sceneTags?: string[];
  /** 来源标记，便于埋点 */
  source?: string;
}

/**
 * 写入规划页启动意图，供 switchTab 后 onShow 消费。
 *
 * @param intent - 启动参数
 * @returns void
 */
export function setPlanLaunchIntent(intent: PlanLaunchIntent): void {
  try {
    uni.setStorageSync(PLAN_LAUNCH_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* 忽略存储失败 */
  }
}

/**
 * 是否存在尚未消费的规划启动意图（不清除）。
 *
 * @returns 有意图时为 true
 */
export function hasPlanLaunchIntent(): boolean {
  try {
    const raw = uni.getStorageSync(PLAN_LAUNCH_INTENT_KEY);
    return Boolean(raw);
  } catch {
    return false;
  }
}

/**
 * 读取并清除规划页启动意图（一次性消费）。
 *
 * @returns 意图对象；无记录时 `null`
 */
export function consumePlanLaunchIntent(): PlanLaunchIntent | null {
  try {
    const raw = uni.getStorageSync(PLAN_LAUNCH_INTENT_KEY);
    uni.removeStorageSync(PLAN_LAUNCH_INTENT_KEY);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as PlanLaunchIntent) : (raw as PlanLaunchIntent);
    if (!parsed?.prompt || typeof parsed.prompt !== 'string') return null;
    return {
      prompt: parsed.prompt.trim(),
      autoSend: Boolean(parsed.autoSend),
      fresh: Boolean(parsed.fresh),
      sceneTags: Array.isArray(parsed.sceneTags)
        ? parsed.sceneTags.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : undefined,
      source: typeof parsed.source === 'string' ? parsed.source : undefined,
    };
  } catch {
    try {
      uni.removeStorageSync(PLAN_LAUNCH_INTENT_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * 从场景专题跳转规划 Tab：写入意图后 switchTab。
 *
 * @param sceneSlug - 场景 slug
 * @param profile - 用户画像
 * @param locale - 语言
 * @returns void
 */
export function launchSceneCustomPlan(
  sceneSlug: string,
  profile: ScenePlanUserProfileInput | null | undefined,
  locale: 'zh-CN' | 'en-US',
): void {
  const prompt = buildSceneCustomPlanPrompt(sceneSlug, profile, locale);
  setPlanLaunchIntent({
    prompt,
    autoSend: true,
    fresh: true,
    sceneTags: [sceneSlug],
    source: `scene:${sceneSlug}`,
  });
  uni.switchTab({ url: '/pages/plan/plan' });
}
