/**
 * Phase 0：高德 POI 批量同步到 attractions 表（status=PENDING，运营审核后 ACTIVE）
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import {
  AttractionCategory,
  AttractionPriceSource,
  AttractionSource,
  AttractionStatus,
} from '@douxing/shared';
import { resolveCityCode } from '../data/city-codes.js';
import { searchPoisByKeyword, type AmapPoiResult } from './amap-geocode.service.js';
import { inferPoiCategory, mapPoiCategoryToDbCategory } from '../utils/poi-classifier.js';

const CORE_CITIES = ['杭州', '上海', '北京', '成都', '广州', '深圳'] as const;

/** 按类别的高德检索关键词 */
const CATEGORY_SEARCH_KEYWORDS: Record<
  typeof AttractionCategory.ATTRACTION | typeof AttractionCategory.RESTAURANT | typeof AttractionCategory.HOTEL,
  string[]
> = {
  [AttractionCategory.ATTRACTION]: ['风景名胜', '公园', '博物馆', '古迹', '旅游景点'],
  [AttractionCategory.RESTAURANT]: ['特色餐厅', '美食', '小吃'],
  [AttractionCategory.HOTEL]: ['酒店', '宾馆', '民宿'],
};

export interface SyncAmapPoisOptions {
  cities?: string[];
  categories?: Array<
    typeof AttractionCategory.ATTRACTION | typeof AttractionCategory.RESTAURANT | typeof AttractionCategory.HOTEL
  >;
  maxPerKeyword?: number;
  dryRun?: boolean;
  delayMs?: number;
}

export interface SyncAmapPoisResult {
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferTags(poi: AmapPoiResult, category: string): string[] {
  const tags = new Set<string>();
  if (poi.type) {
    for (const part of poi.type.split(';')) {
      const t = part.trim();
      if (t) tags.add(t);
    }
  }
  if (category === AttractionCategory.HOTEL) tags.add('住宿');
  if (category === AttractionCategory.RESTAURANT) tags.add('美食');
  return [...tags].slice(0, 8);
}

function estimatePrice(category: string): number {
  if (category === AttractionCategory.HOTEL) return 380;
  if (category === AttractionCategory.RESTAURANT) return 80;
  return 0;
}

async function existsByCityAndName(
  cityCode: string,
  name: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: attractions.id })
    .from(attractions)
    .where(and(eq(attractions.cityCode, cityCode), eq(attractions.name, name)))
    .limit(1);
  return rows.length > 0;
}

async function insertPoi(
  city: string,
  cityCode: string,
  category: string,
  poi: AmapPoiResult,
  dryRun: boolean,
): Promise<'inserted' | 'skipped'> {
  const name = poi.name.trim();
  if (!name) return 'skipped';

  if (await existsByCityAndName(cityCode, name)) {
    return 'skipped';
  }

  if (dryRun) return 'inserted';

  const db = getDb();
  await db.insert(attractions).values({
    name,
    category,
    city,
    cityCode,
    latitude: poi.latitude != null ? String(poi.latitude) : null,
    longitude: poi.longitude != null ? String(poi.longitude) : null,
    tags: inferTags(poi, category),
    description: poi.address?.trim() || `${city}${name}`,
    ticketPrice: estimatePrice(category),
    aliases: poi.amapPoiId ? [`amap:${poi.amapPoiId}`] : [],
    status: AttractionStatus.PENDING,
    source: AttractionSource.AMAP,
    priceSource: AttractionPriceSource.EXTERNAL,
  });

  return 'inserted';
}

/**
 * 从高德批量同步 POI 到内容库（待审核）
 */
export async function syncAmapPois(
  options: SyncAmapPoisOptions = {},
): Promise<SyncAmapPoisResult> {
  const cities = options.cities?.length ? options.cities : [...CORE_CITIES];
  const categories = options.categories?.length
    ? options.categories
    : [
        AttractionCategory.ATTRACTION,
        AttractionCategory.RESTAURANT,
        AttractionCategory.HOTEL,
      ];
  const maxPerKeyword = Math.min(Math.max(options.maxPerKeyword ?? 20, 1), 50);
  const delayMs = options.delayMs ?? 350;
  const dryRun = options.dryRun ?? false;

  const result: SyncAmapPoisResult = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
  };

  for (const city of cities) {
    const cityCode = resolveCityCode(city);
    for (const category of categories) {
      const keywords = CATEGORY_SEARCH_KEYWORDS[category];
      for (const keyword of keywords) {
        try {
          const pois = await searchPoisByKeyword(keyword, city, {
            limit: maxPerKeyword,
          });
          for (const poi of pois) {
            result.scanned += 1;
            const resolvedCategory = mapPoiCategoryToDbCategory(
              inferPoiCategory(poi.name, poi.type),
            );
            if (
              category !== AttractionCategory.ATTRACTION &&
              resolvedCategory !== category
            ) {
              result.skipped += 1;
              continue;
            }
            const outcome = await insertPoi(
              city,
              cityCode,
              resolvedCategory,
              poi,
              dryRun,
            );
            if (outcome === 'inserted') result.inserted += 1;
            else result.skipped += 1;
          }
        } catch (err) {
          result.errors += 1;
          console.warn(
            '[amap-poi-sync] 同步失败:',
            city,
            keyword,
            err instanceof Error ? err.message : err,
          );
        }
        if (delayMs > 0) await sleep(delayMs);
      }
    }
  }

  return result;
}
