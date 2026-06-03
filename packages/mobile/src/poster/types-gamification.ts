import type { LocaleCode } from '@douxing/shared';

export type GamificationPosterKind = 'achievements' | 'badges';

/** 成就/徽章海报展示项（仅已解锁） */
export interface GamificationPosterItem {
  id: number;
  icon: string;
  name: string;
  description: string | null;
  unlockedAt: string | null;
}

export interface GamificationPosterLabels {
  sectionTitle: string;
  unlockedCount: string;
  unlockedAt: string;
}

/** 成就/徽章炫耀海报数据层 */
export interface GamificationPosterPayload {
  kind: GamificationPosterKind;
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  unlockedCount: number;
  items: GamificationPosterItem[];
  brand: {
    name: string;
    tagline: string;
    scanHint: string;
  };
  qrUrl: string | null;
  locale: LocaleCode;
  labels: GamificationPosterLabels;
}
