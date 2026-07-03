import type { LocaleCode } from '@douxing/shared';

/** H2-a MVP 手帐海报模板 ID */
export type PosterTemplateId = 'timeline-columns' | 'diary-page';

export type PosterThemePresetId = 'forest' | 'ocean' | 'sunset' | 'classic';
export type PosterPoisPerDay = 2 | 3 | 4;
export type PosterStickerId = 'none' | 'travel' | 'food' | 'family';

/** H2-a+ 轻量自定义选项（仅影响海报渲染，不改路线 JSON） */
export interface PosterRenderOptions {
  /** 自定义副标题；空字符串表示使用路线 description */
  subtitleOverride?: string;
  themePresetId: PosterThemePresetId;
  poisPerDay: PosterPoisPerDay;
  showTime: boolean;
  stickerId: PosterStickerId;
}

export type PosterPoiKind = 'transit' | 'play' | 'lodging';

export interface PosterPoiItem {
  kind: PosterPoiKind;
  time?: string;
  name: string;
  desc: string;
  /** 交通耗时 / 参考费用等 */
  meta?: string;
  poiType?: string;
  imageUrl?: string;
  /** H10-c：该 POI 是否有已审核 UGC 短视频 */
  hasVideo?: boolean;
}

export interface PosterDayBlock {
  label: string;
  themeColor: string;
  items: PosterPoiItem[];
  /** 当天精选封面（最多 3 张，去重） */
  highlightImages: string[];
  /** 当天超出展示上限的节点数 */
  hiddenItemCount: number;
}

export interface PosterBrandInfo {
  name: string;
  tagline: string;
  scanHint: string;
}

export interface PosterLabels {
  dayCount: string;
  moreDays: string;
  moreItems: string;
  dayPrefix: string;
  sectionPlay: string;
  sectionTransit: string;
  sectionLodging: string;
  transitDuration: string;
}

/** 统一海报数据层（ROADMAP §5 H2-a） */
export interface PosterPayload {
  routeId: number;
  city: string;
  title: string;
  subtitle: string;
  dayCount: number;
  days: PosterDayBlock[];
  /** 超出展示上限的天数 */
  hiddenDayCount: number;
  brand: PosterBrandInfo;
  qrUrl: string | null;
  locale: LocaleCode;
  labels: PosterLabels;
  /** H2-a+ 渲染选项 */
  options: PosterRenderOptions;
}

export interface PosterTemplateMeta {
  id: PosterTemplateId;
  nameKey: string;
  descKey: string;
}

export interface PosterRenderSize {
  width: number;
  height: number;
}

export type PosterCanvasContext = CanvasRenderingContext2D;

export interface PosterRenderResult {
  width: number;
  height: number;
}
