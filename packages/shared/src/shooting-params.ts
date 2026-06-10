import type { TravelPhotoInfo, TravelPhotoShootingParams } from './types.js';

const F_NUMBER_TOLERANCE = 0.15;
const FOCAL_LENGTH_TOLERANCE_MM = 2;
const EXPOSURE_TIME_TOLERANCE_SEC = 0.002;

/** 是否含有可用于匹配的拍摄参数（至少 2 项核心参数） */
export function hasMatchableShootingParams(
  params: TravelPhotoShootingParams | null | undefined,
): boolean {
  if (!params) return false;
  let coreCount = 0;
  if (params.iso != null) coreCount += 1;
  if (params.fNumber != null) coreCount += 1;
  if (params.exposureTimeSec != null) coreCount += 1;
  if (params.focalLengthMm != null) coreCount += 1;
  return coreCount >= 2;
}

function normalizeModel(params: TravelPhotoShootingParams): string {
  const model = params.deviceModel?.trim();
  if (model) return model.toLowerCase();
  const make = params.deviceMake?.trim();
  return make ? make.toLowerCase() : '';
}

function numbersClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** 两张照片拍摄参数是否视为「同参数」（双方共有字段一致，且至少 2 项可比字段） */
export function shootingParamsMatch(
  a: TravelPhotoShootingParams | null | undefined,
  b: TravelPhotoShootingParams | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (!hasMatchableShootingParams(a)) return false;

  let comparedFields = 0;

  const modelA = normalizeModel(a);
  const modelB = normalizeModel(b);
  if (modelA && modelB) {
    if (modelA !== modelB) return false;
    comparedFields += 1;
  }

  if (a.iso != null && b.iso != null) {
    if (a.iso !== b.iso) return false;
    comparedFields += 1;
  }

  if (a.fNumber != null && b.fNumber != null) {
    if (!numbersClose(a.fNumber, b.fNumber, F_NUMBER_TOLERANCE)) return false;
    comparedFields += 1;
  }

  if (a.exposureTimeSec != null && b.exposureTimeSec != null) {
    if (!numbersClose(a.exposureTimeSec, b.exposureTimeSec, EXPOSURE_TIME_TOLERANCE_SEC)) {
      return false;
    }
    comparedFields += 1;
  }

  if (a.focalLengthMm != null && b.focalLengthMm != null) {
    if (!numbersClose(a.focalLengthMm, b.focalLengthMm, FOCAL_LENGTH_TOLERANCE_MM)) return false;
    comparedFields += 1;
  }

  return comparedFields >= 2;
}

/** 在列表中找出与参考图同参数的照片（含参考图自身） */
export function findPhotosWithSameShootingParams(
  photos: TravelPhotoInfo[],
  reference: TravelPhotoInfo,
): TravelPhotoInfo[] {
  if (!hasMatchableShootingParams(reference.shootingParams)) return [];
  return photos.filter((photo) => shootingParamsMatch(reference.shootingParams, photo.shootingParams));
}

export function formatExposureTimeLabel(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  if (sec >= 1) return `${sec.toFixed(1)}s`;
  const denom = Math.round(1 / sec);
  return denom > 0 ? `1/${denom}s` : null;
}

export function formatFNumberLabel(fNumber: number | null | undefined): string | null {
  if (fNumber == null || !Number.isFinite(fNumber) || fNumber <= 0) return null;
  const rounded = Math.round(fNumber * 10) / 10;
  return `f/${rounded}`;
}

export function formatFocalLengthLabel(mm: number | null | undefined): string | null {
  if (mm == null || !Number.isFinite(mm) || mm <= 0) return null;
  return `${Math.round(mm)}mm`;
}

/** 单行摘要，用于 UI / 海报页脚 */
export function formatShootingParamsSummary(
  params: TravelPhotoShootingParams | null | undefined,
): string {
  if (!params) return '';
  const parts: string[] = [];
  const device = params.deviceModel?.trim() || params.deviceMake?.trim();
  if (device) parts.push(device);
  if (params.iso != null) parts.push(`ISO ${params.iso}`);
  const f = formatFNumberLabel(params.fNumber);
  if (f) parts.push(f);
  const t = formatExposureTimeLabel(params.exposureTimeSec);
  if (t) parts.push(t);
  const fl = formatFocalLengthLabel(params.focalLengthMm);
  if (fl) parts.push(fl);
  if (params.lensModel?.trim()) parts.push(params.lensModel.trim());
  return parts.join(' · ');
}
