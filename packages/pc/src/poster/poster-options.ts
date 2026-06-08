import type { PosterPoiItem, PosterRenderOptions } from './types';
import { POSTER_OPTIONS_STORAGE_KEY } from './share-url';

export type PosterThemePresetId = PosterRenderOptions['themePresetId'];
export type PosterPoisPerDay = PosterRenderOptions['poisPerDay'];
export type PosterStickerId = PosterRenderOptions['stickerId'];

export const POSTER_THEME_PRESETS: Record<
  PosterThemePresetId,
  { colors: string[] }
> = {
  forest: {
    colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#1b4332', '#40916c'],
  },
  ocean: {
    colors: ['#1d3557', '#457b9d', '#5a8fba', '#7eb8da', '#0d1b2a', '#1d3557'],
  },
  sunset: {
    colors: ['#9d0208', '#d00000', '#e85d04', '#f48c06', '#6a040f', '#dc2f02'],
  },
  classic: {
    colors: ['#2c2416', '#6b5c48', '#8b7355', '#a69076', '#4a4035', '#6b5c48'],
  },
};

export const POSTER_STICKER_EMOJI: Record<Exclude<PosterStickerId, 'none'>, string> = {
  travel: '✈️',
  food: '🍜',
  family: '👨‍👩‍👧',
};

export const DEFAULT_POSTER_RENDER_OPTIONS: PosterRenderOptions = {
  themePresetId: 'forest',
  poisPerDay: 4,
  showTime: true,
  stickerId: 'none',
};

export function mergePosterRenderOptions(
  partial?: Partial<PosterRenderOptions>,
): PosterRenderOptions {
  if (!partial) return { ...DEFAULT_POSTER_RENDER_OPTIONS };
  const merged: PosterRenderOptions = { ...DEFAULT_POSTER_RENDER_OPTIONS, ...partial };
  if ('subtitleOverride' in partial && partial.subtitleOverride === undefined) {
    delete merged.subtitleOverride;
  }
  return merged;
}

export function loadStoredPosterRenderOptions(): PosterRenderOptions {
  try {
    const raw = localStorage.getItem(POSTER_OPTIONS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POSTER_RENDER_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<PosterRenderOptions>;
    return mergePosterRenderOptions(parsed);
  } catch {
    return { ...DEFAULT_POSTER_RENDER_OPTIONS };
  }
}

export function savePosterRenderOptions(options: PosterRenderOptions): void {
  try {
    localStorage.setItem(POSTER_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // 存储失败可忽略
  }
}

/** 按 play 节点数量截断当天行程（保留截断点前的交通/住宿） */
export function limitDayItemsByPlayCount(
  items: PosterPoiItem[],
  maxPlay: number,
): { items: PosterPoiItem[]; hiddenItemCount: number } {
  if (maxPlay <= 0 || items.length === 0) {
    return { items: [], hiddenItemCount: items.length };
  }

  let playCount = 0;
  let cutIndex = items.length;

  for (let i = 0; i < items.length; i += 1) {
    if (items[i]?.kind === 'play') {
      playCount += 1;
      if (playCount > maxPlay) {
        cutIndex = i;
        break;
      }
    }
  }

  const visible = items.slice(0, cutIndex);
  return {
    items: visible,
    hiddenItemCount: items.length - visible.length,
  };
}

export function themeColorForDay(presetId: PosterThemePresetId, dayIndex: number): string {
  const palette = POSTER_THEME_PRESETS[presetId]?.colors ?? POSTER_THEME_PRESETS.forest.colors;
  return palette[dayIndex % palette.length]!;
}

export function applyShowTimeToItems(
  items: PosterPoiItem[],
  showTime: boolean,
): PosterPoiItem[] {
  if (showTime) return items;
  return items.map((item) => ({ ...item, time: undefined }));
}
