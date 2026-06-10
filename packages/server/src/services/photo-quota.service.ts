import { sql, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  getPhotoQuotaByMemberLevel,
  type UserPhotoStorageInfo,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { travelPhotos } from '../db/schema/index.js';
import { getUserMemberLevel } from './membership.service.js';

function isPhotoQuotaEnforced(): boolean {
  const raw = process.env.PHOTO_QUOTA_ENFORCE?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

function formatBytesForMessage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export async function getUserPhotoUsage(userId: number): Promise<{ usedBytes: number; usedCount: number }> {
  const db = getDb();
  const rows = await db
    .select({
      usedBytes: sql<number>`COALESCE(SUM(${travelPhotos.byteSize}), 0)`,
      usedCount: sql<number>`COUNT(*)`,
    })
    .from(travelPhotos)
    .where(eq(travelPhotos.userId, userId));

  return {
    usedBytes: Number(rows[0]?.usedBytes ?? 0),
    usedCount: Number(rows[0]?.usedCount ?? 0),
  };
}

export async function getUserPhotoStorageInfo(userId: number): Promise<UserPhotoStorageInfo> {
  const level = await getUserMemberLevel(userId);
  const quota = getPhotoQuotaByMemberLevel(level);
  const usage = await getUserPhotoUsage(userId);

  return {
    level,
    usedBytes: usage.usedBytes,
    maxBytes: quota.maxBytes,
    usedCount: usage.usedCount,
    maxCount: quota.maxCount,
    maxFileBytes: quota.maxFileBytes,
  };
}

export async function assertCanUploadTravelPhoto(
  userId: number,
  byteSize: number,
  options?: { additionalCount?: number; additionalBytes?: number },
): Promise<void> {
  if (!isPhotoQuotaEnforced()) return;

  const level = await getUserMemberLevel(userId);
  const quota = getPhotoQuotaByMemberLevel(level);

  if (byteSize > quota.maxFileBytes) {
    throw new ApiError(ApiMessageKey.TRAVEL_PHOTO_FILE_TOO_LARGE);
  }

  const usage = await getUserPhotoUsage(userId);
  const extraCount = options?.additionalCount ?? 0;
  const extraBytes = options?.additionalBytes ?? 0;
  const nextCount = usage.usedCount + 1 + extraCount;
  const nextBytes = usage.usedBytes + byteSize + extraBytes;

  if (nextCount > quota.maxCount || nextBytes > quota.maxBytes) {
    throw new ApiError(ApiMessageKey.PHOTO_QUOTA_EXCEEDED, {
      usedCount: String(usage.usedCount),
      maxCount: String(quota.maxCount),
      usedBytes: formatBytesForMessage(usage.usedBytes),
      maxBytes: formatBytesForMessage(quota.maxBytes),
    });
  }
}

export async function getMaxFileBytesForUser(userId: number): Promise<number> {
  const level = await getUserMemberLevel(userId);
  return getPhotoQuotaByMemberLevel(level).maxFileBytes;
}
