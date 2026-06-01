import type { LocaleCode } from '@douxing/shared';

/** H2-a MVP 手帐海报模板 ID */
export type PosterTemplateId = 'timeline-columns' | 'diary-page';

export interface PosterPoiItem {
  time?: string;
  name: string;
  desc: string;
  poiType?: string;
  imageUrl?: string;
}

export interface PosterDayBlock {
  label: string;
  themeColor: string;
  items: PosterPoiItem[];
}

export interface PosterBrandInfo {
  name: string;
  tagline: string;
  scanHint: string;
}

export interface PosterLabels {
  dayCount: string;
  moreDays: string;
  dayPrefix: string;
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
