import type { AttractionInfo } from '@douxing/shared';

/**
 * 景点封面异步补全（Phase 1+：高德 POI / Wikimedia / UGC 聚合）。
 * Phase 0 仅提供骨架，默认不自动写入。
 */
export async function enrichAttractionCoverFromExternalSources(
  _attraction: AttractionInfo,
): Promise<AttractionInfo | null> {
  return null;
}

/** 批量补全无封面景点（供脚本或定时任务调用） */
export async function enrichMissingAttractionCovers(options?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<{ scanned: number; updated: number }> {
  void options;
  return { scanned: 0, updated: 0 };
}
