/** 空状态插画变体（H1-b） */
export type DouxingEmptyVariant =
  | 'generic'
  | 'routes'
  | 'plaza'
  | 'favorites'
  | 'plan'
  | 'achievements'
  | 'badges'
  | 'checkins'
  | 'map'
  | 'orders'
  | 'leaderboard'
  | 'error';

const VARIANT_ICONS: Record<DouxingEmptyVariant, string> = {
  generic: '🧳',
  routes: '🗺️',
  plaza: '🌆',
  favorites: '⭐',
  plan: '✨',
  achievements: '🏅',
  badges: '🎖️',
  checkins: '📍',
  map: '🧭',
  orders: '🧾',
  leaderboard: '🏆',
  error: '⚠️',
};

export function getEmptyStateIcon(variant: DouxingEmptyVariant, override?: string): string {
  if (override) return override;
  return VARIANT_ICONS[variant] ?? VARIANT_ICONS.generic;
}
