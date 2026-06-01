import path from 'node:path';
import { and, inArray, isNull, eq } from 'drizzle-orm';
import {
  AttractionImageSource,
  AttractionStatus,
  type AttractionInfo,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import { getAmapImageFetchDelayMs, isAmapImageEnrichEnabled } from '../config/amap.js';
import { fetchAmapPoiCoverImage } from './amap-poi-image.service.js';
import { getAttractionForCoverEnrich, updateAttractionCoverImage } from './attraction.service.js';
import { attractionCoversDir } from '../routes/attractions.js';
import { downloadImageToFile } from '../utils/download-asset.util.js';
import {
  tryDeleteAmapCoverVariants,
  tryDeleteAttractionCoverFile,
} from '../utils/local-upload.util.js';

const AMAP_ATTRIBUTION = '高德地图 POI';
const AMAP_LICENSE = 'amap_poi';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSkipEnrichment(
  attraction: AttractionInfo,
  options?: { force?: boolean },
): boolean {
  if (options?.force) return false;
  if (!attraction.coverImageUrl) return false;
  // 已有手动上传封面时不覆盖
  return attraction.imageSource === AttractionImageSource.MANUAL;
}

async function persistAmapCoverImage(
  attractionId: number,
  remoteUrl: string,
  meta: { title?: string; poiId?: string; poiName?: string },
  dryRun: boolean,
): Promise<string | null> {
  if (dryRun) return remoteUrl;

  // 固定文件名：每个景点最多保留 1 张 amap 封面，重复拉取覆盖而非堆叠
  tryDeleteAmapCoverVariants(attractionId);

  const baseName = `${attractionId}-amap`;
  const destWithoutExt = path.join(attractionCoversDir, baseName);

  const downloaded = await downloadImageToFile(remoteUrl, destWithoutExt);
  const filename = path.basename(downloaded.filePath);
  const relativePath = `/uploads/attractions/${filename}`;

  const attributionParts = [AMAP_ATTRIBUTION];
  if (meta.poiName) attributionParts.push(meta.poiName);
  if (meta.poiId) attributionParts.push(`POI:${meta.poiId}`);

  await updateAttractionCoverImage(attractionId, {
    coverImageUrl: relativePath,
    imageSource: AttractionImageSource.AMAP,
    imageLicense: AMAP_LICENSE,
    imageAttribution: attributionParts.join(' · '),
  });

  void meta.title;
  return relativePath;
}

/**
 * 为单个景点从高德 POI 拉取封面并持久化到 uploads。
 */
export async function enrichAttractionCoverFromExternalSources(
  attraction: AttractionInfo,
  options?: { dryRun?: boolean; force?: boolean },
): Promise<AttractionInfo | null> {
  if (!isAmapImageEnrichEnabled()) return null;
  if (shouldSkipEnrichment(attraction, options)) return null;
  if (attraction.coverImageUrl && !options?.force) return null;

  const poiResult = await fetchAmapPoiCoverImage(attraction.name, attraction.city);
  if (!poiResult?.photo.url) return null;

  const stored = await persistAmapCoverImage(
    attraction.id,
    poiResult.photo.url,
    {
      title: poiResult.photo.title,
      poiId: poiResult.poiId,
      poiName: poiResult.poiName,
    },
    options?.dryRun ?? false,
  );

  if (!stored) return null;
  if (options?.dryRun) {
    return { ...attraction, coverImageUrl: poiResult.photo.url, imageSource: AttractionImageSource.AMAP };
  }

  return getAttractionForCoverEnrich(attraction.id);
}

/** 按 ID 补全封面（供异步队列 / CLI 单条调用） */
export async function enrichAttractionCoverById(
  id: number,
  options?: { dryRun?: boolean; force?: boolean },
): Promise<AttractionInfo | null> {
  const attraction = await getAttractionForCoverEnrich(id);
  if (!attraction) return null;
  return enrichAttractionCoverFromExternalSources(attraction, options);
}

export interface EnrichMissingCoversResult {
  scanned: number;
  updated: number;
  failed: number;
  skipped: number;
}

/** 批量补全无封面景点（供脚本或定时任务调用） */
export async function enrichMissingAttractionCovers(options?: {
  limit?: number;
  dryRun?: boolean;
  delayMs?: number;
}): Promise<EnrichMissingCoversResult> {
  if (!isAmapImageEnrichEnabled()) {
    console.warn('[attraction-image] 高德封面补全未启用（检查 AMAP_WEB_KEY / AMAP_ENABLED）');
    return { scanned: 0, updated: 0, failed: 0, skipped: 0 };
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const dryRun = options?.dryRun ?? false;
  const delayMs = options?.delayMs ?? getAmapImageFetchDelayMs();

  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        isNull(attractions.coverImageUrl),
        inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]),
      ),
    )
    .orderBy(attractions.updatedAt)
    .limit(limit);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const info: AttractionInfo = {
      id: row.id,
      name: row.name,
      category: row.category,
      city: row.city,
      cityCode: row.cityCode,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      tags: row.tags,
      description: row.description,
      ticketPrice: row.ticketPrice,
      aliases: row.aliases ?? null,
      openHours: row.openHours ?? null,
      status: row.status,
      source: row.source,
      priceSource: row.priceSource,
      matchConfidence: row.matchConfidence != null ? Number(row.matchConfidence) : null,
      priceUpdatedAt: row.priceUpdatedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      coverImageUrl: null,
      imageSource: row.imageSource ?? null,
      imageLicense: row.imageLicense ?? null,
      imageAttribution: row.imageAttribution ?? null,
      imageFetchedAt: row.imageFetchedAt?.toISOString() ?? null,
    };

    try {
      const result = await enrichAttractionCoverFromExternalSources(info, { dryRun });
      if (result) {
        updated += 1;
        console.log(
          `[attraction-image] ${dryRun ? 'would update' : 'updated'} #${row.id} ${row.name} (${row.city})`,
        );
      } else {
        skipped += 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(
        `[attraction-image] failed #${row.id} ${row.name}:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { scanned: rows.length, updated, failed, skipped };
}

/** 按 ID 批量补封面（路线同步 / 详情读取时 await） */
export async function enrichAttractionCoversForIds(
  ids: number[],
  options?: { delayMs?: number; maxCount?: number },
): Promise<{ updated: number; skipped: number }> {
  if (!isAmapImageEnrichEnabled()) {
    return { updated: 0, skipped: ids.length };
  }

  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const maxCount = Math.min(Math.max(options?.maxCount ?? 16, 1), 32);
  const targets = unique.slice(0, maxCount);
  const delayMs = options?.delayMs ?? getAmapImageFetchDelayMs();

  let updated = 0;
  let skipped = 0;

  for (const id of targets) {
    try {
      const result = await enrichAttractionCoverById(id);
      if (result?.coverImageUrl) {
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      skipped += 1;
      console.warn(
        '[attraction-image] batch enrich failed',
        id,
        err instanceof Error ? err.message : err,
      );
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { updated, skipped };
}

/** 异步队列：路线同步后补封面（fire-and-forget 兜底） */
let enrichQueue: Promise<void> = Promise.resolve();

async function enqueueCoverEnrichment(attractionId: number): Promise<void> {
  const delayMs = getAmapImageFetchDelayMs();
  if (delayMs > 0) {
    await sleep(delayMs);
  }
  await enrichAttractionCoverById(attractionId);
}

/** 路线同步后触发（串行限流；同步链路应优先 await enrichAttractionCoversForIds） */
export function scheduleAttractionCoverEnrichment(attractionId: number): void {
  if (!isAmapImageEnrichEnabled() || !Number.isFinite(attractionId) || attractionId <= 0) {
    return;
  }
  enrichQueue = enrichQueue
    .then(() => enqueueCoverEnrichment(attractionId))
    .catch((err) => {
      console.warn(
        '[attraction-image] async enrich failed',
        attractionId,
        err instanceof Error ? err.message : err,
      );
    });
}

/** 管理端强制对单个景点重新拉取（覆盖非 manual 封面） */
export async function refreshAttractionCoverFromAmap(
  id: number,
  options?: { dryRun?: boolean },
): Promise<AttractionInfo | null> {
  const db = getDb();
  const rows = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.imageSource === AttractionImageSource.MANUAL) return null;

  const attraction = await getAttractionForCoverEnrich(id);
  if (!attraction) return null;

  return enrichAttractionCoverFromExternalSources(attraction, {
    dryRun: options?.dryRun,
    force: true,
  });
}
