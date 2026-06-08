import type {
  AchievementCatalogItem,
  BadgeCatalogItem,
  LocaleCode,
  UserInfo,
} from '@douxing/shared';
import type {
  GamificationPosterKind,
  GamificationPosterLabels,
  GamificationPosterPayload,
} from './types-gamification';
import type { PosterThemePresetId } from './types';
import { loadStoredPosterRenderOptions } from './poster-options';

const MAX_ITEMS = 12;

function isCatalogUnlocked(item: { unlocked: boolean; progress?: { current: number; target: number } | null }) {
  if (item.unlocked) return true;
  const progress = item.progress;
  if (!progress) return false;
  return progress.current >= progress.target;
}

function buildShareUrl(kind: GamificationPosterKind): string | null {
  const base = import.meta.env.VITE_H5_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  const path =
    kind === 'achievements' ? '/#/pages/achievements/index' : '/#/pages/badges/index';
  return `${base}${path}`;
}

function buildLabels(
  kind: GamificationPosterKind,
  locale: LocaleCode,
  unlockedCount: number,
): GamificationPosterLabels {
  if (locale === 'en-US') {
    const sectionTitle = kind === 'achievements' ? 'My Achievements' : 'My Badges';
    return {
      sectionTitle,
      unlockedCount: `${unlockedCount} unlocked`,
      unlockedAt: 'Unlocked',
    };
  }
  return {
    sectionTitle: kind === 'achievements' ? '我的成就' : '我的徽章',
    unlockedCount: `已解锁 ${unlockedCount} 项`,
    unlockedAt: '解锁于',
  };
}

function mapAchievementItems(items: AchievementCatalogItem[]) {
  return items
    .filter(isCatalogUnlocked)
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      id: item.id,
      icon: item.iconUrl?.trim() || '🏅',
      name: item.name,
      description: item.description,
      unlockedAt: item.unlockTime ?? null,
    }));
}

function mapBadgeItems(items: BadgeCatalogItem[]) {
  return items
    .filter(isCatalogUnlocked)
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      id: item.id,
      icon: item.iconUrl?.trim() || '🎖️',
      name: item.name,
      description: item.description,
      unlockedAt: item.unlockTime ?? null,
    }));
}

export interface BuildGamificationPosterPayloadInput {
  kind: GamificationPosterKind;
  catalog: AchievementCatalogItem[] | BadgeCatalogItem[];
  user: Pick<UserInfo, 'id' | 'nickname' | 'avatar'>;
  locale: LocaleCode;
  brandName: string;
  brandTagline: string;
  scanHint: string;
  themePresetId?: PosterThemePresetId;
}

export function buildGamificationPosterPayload(
  input: BuildGamificationPosterPayloadInput,
): GamificationPosterPayload | null {
  const { kind, catalog, user, locale, brandName, brandTagline, scanHint } = input;

  const items =
    kind === 'achievements'
      ? mapAchievementItems(catalog as AchievementCatalogItem[])
      : mapBadgeItems(catalog as BadgeCatalogItem[]);

  if (items.length === 0) return null;

  const unlockedCount =
    kind === 'achievements'
      ? (catalog as AchievementCatalogItem[]).filter(isCatalogUnlocked).length
      : (catalog as BadgeCatalogItem[]).filter(isCatalogUnlocked).length;

  return {
    kind,
    userId: user.id,
    nickname: user.nickname || '—',
    avatarUrl: user.avatar || null,
    unlockedCount,
    items,
    brand: {
      name: brandName,
      tagline: brandTagline,
      scanHint,
    },
    qrUrl: buildShareUrl(kind),
    locale,
    labels: buildLabels(kind, locale, unlockedCount),
    themePresetId: input.themePresetId ?? loadStoredPosterRenderOptions().themePresetId,
  };
}
