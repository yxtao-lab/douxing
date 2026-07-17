/**
 * 统一用户旅行画像（A-COGNITION-01）
 *
 * 聚合兴趣标签、宠物记忆、历史路线、打卡、相册等数据源，
 * 生成可解释的旅行人格快照。
 */

/** 旅行节奏 */
export type PersonaRhythm = 'relaxed' | 'balanced' | 'intensive';

/** 预算档次 */
export type PersonaBudgetTier = 'budget' | 'mid-range' | 'premium';

/** 预算弹性 */
export type PersonaBudgetFlexibility = 'fixed' | 'flexible';

/** 拍照热情 */
export type PersonaPhotoEnthusiasm = 'low' | 'medium' | 'high';

/** 旅行画像快照 */
export interface TravelPersonaSnapshot {
  /** 用户 ID */
  userId: number;
  /** 画像版本号 */
  personaVersion: number;
  /** 旅行风格标签，如「文化探索型」「亲子休闲型」 */
  travelStyle: string | null;
  /** 旅行节奏 */
  rhythm: PersonaRhythm;
  /** 预算档次 */
  budgetTier: PersonaBudgetTier;
  /** 预算弹性 */
  budgetFlexibility: PersonaBudgetFlexibility;
  /** 同伴结构标签：solo / couple / family / group */
  companionStructure: string[] | null;
  /** 偏好目的地 Top 列表（城市名） */
  topDestinations: string[] | null;
  /** 偏好景点类型 Top 列表 */
  topPoiTypes: string[] | null;
  /** 兴趣标签（来自用户资料） */
  interestTags: string[] | null;
  /** 记忆主题（来自宠物记忆 preference 类型） */
  memoryThemes: string[] | null;
  /** 忌讳/避开列表（来自 regret 记忆 + 去过 POI） */
  avoidList: string[] | null;
  /** 拍照热情 */
  photoEnthusiasm: PersonaPhotoEnthusiasm;
  /** 历史路线数量 */
  routeCount: number;
  /** 打卡总数 */
  checkinCount: number;
  /** 相册照片总数 */
  photoCount: number;
  /** 人类可读画像摘要，供 LLM 规划注入 */
  summary: string | null;
  /** 最后更新时间（ISO 8601） */
  updatedAt: string;
}

/** 节奏标签 i18n 键前缀 */
export const PERSONA_RHYTHM_LABEL_KEY: Record<PersonaRhythm, string> = {
  relaxed: 'persona.rhythmRelaxed',
  balanced: 'persona.rhythmBalanced',
  intensive: 'persona.rhythmIntensive',
};

/** 预算档次标签 i18n 键前缀 */
export const PERSONA_BUDGET_TIER_LABEL_KEY: Record<PersonaBudgetTier, string> = {
  budget: 'persona.budgetTierBudget',
  'mid-range': 'persona.budgetTierMidRange',
  premium: 'persona.budgetTierPremium',
};

/** 拍照热情标签 i18n 键前缀 */
export const PERSONA_PHOTO_LABEL_KEY: Record<PersonaPhotoEnthusiasm, string> = {
  low: 'persona.photoEnthusiasmLow',
  medium: 'persona.photoEnthusiasmMedium',
  high: 'persona.photoEnthusiasmHigh',
};
