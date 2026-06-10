import exifParser from 'exif-parser';
import type { TravelPhotoShootingParams } from '@douxing/shared';

export interface ParsedPhotoExif {
  takenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  shootingParams: TravelPhotoShootingParams | null;
}

function readStringTag(tags: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readNumberTag(tags: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = tags[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function parseShootingParams(tags: Record<string, unknown>): TravelPhotoShootingParams | null {
  const deviceMake = readStringTag(tags, ['Make']);
  const deviceModel = readStringTag(tags, ['Model']);
  const lensModel = readStringTag(tags, ['LensModel', 'LensInfo']);
  const iso = readNumberTag(tags, ['ISO', 'ISOSpeedRatings', 'PhotographicSensitivity']);
  const fNumber = readNumberTag(tags, ['FNumber', 'ApertureValue']);
  const exposureTimeSec = readNumberTag(tags, ['ExposureTime', 'ShutterSpeedValue']);
  const focalLengthMm = readNumberTag(tags, ['FocalLength']);
  const focalLength35mm = readNumberTag(tags, ['FocalLengthIn35mmFilm', 'FocalLengthIn35mmFormat']);
  const flashRaw = tags.Flash;
  const whiteBalance = readStringTag(tags, ['WhiteBalance']);

  let flash: boolean | null = null;
  if (typeof flashRaw === 'number' && Number.isFinite(flashRaw)) {
    flash = flashRaw > 0;
  }

  const params: TravelPhotoShootingParams = {
    deviceMake,
    deviceModel,
    lensModel,
    iso,
    fNumber,
    exposureTimeSec,
    focalLengthMm,
    focalLength35mm,
    flash,
    whiteBalance,
  };

  const hasAny =
    deviceMake ||
    deviceModel ||
    lensModel ||
    iso != null ||
    fNumber != null ||
    exposureTimeSec != null ||
    focalLengthMm != null ||
    focalLength35mm != null ||
    flash != null ||
    whiteBalance;

  return hasAny ? params : null;
}

/** 从图片 buffer 解析 EXIF 拍摄时间、GPS 与拍摄参数 */
export function parseImageExif(buffer: Buffer): ParsedPhotoExif {
  try {
    const parser = exifParser.create(buffer);
    const { tags } = parser.parse();
    const tagRecord = tags as Record<string, unknown>;

    let takenAt: Date | null = null;
    const rawTime = tagRecord.DateTimeOriginal ?? tagRecord.CreateDate;
    if (typeof rawTime === 'number' && Number.isFinite(rawTime)) {
      takenAt = new Date(rawTime * 1000);
    }

    const latitude = typeof tagRecord.GPSLatitude === 'number' ? tagRecord.GPSLatitude : null;
    const longitude = typeof tagRecord.GPSLongitude === 'number' ? tagRecord.GPSLongitude : null;
    const shootingParams = parseShootingParams(tagRecord);

    return { takenAt, latitude, longitude, shootingParams };
  } catch {
    return { takenAt: null, latitude: null, longitude: null, shootingParams: null };
  }
}
