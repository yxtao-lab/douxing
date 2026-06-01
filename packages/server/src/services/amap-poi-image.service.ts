import {
  getAmapWebKey,
  getAmapGeocodeTimeoutMs,
  isAmapImageEnrichEnabled,
} from '../config/amap.js';

const AMAP_PLACE_TEXT_URL = 'https://restapi.amap.com/v3/place/text';
const AMAP_PLACE_DETAIL_URL = 'https://restapi.amap.com/v3/place/detail';

export interface AmapPoiPhoto {
  title?: string;
  url: string;
}

export interface AmapPoiImageResult {
  poiId: string;
  poiName: string;
  photo: AmapPoiPhoto;
}

interface AmapPoiRow {
  id?: string;
  name?: string;
  photos?: unknown;
}

interface AmapPlaceResponse {
  status?: string;
  info?: string;
  pois?: AmapPoiRow[];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 高德 photos 字段可能是数组或字符串，统一解析 */
function normalizeAmapPhotos(raw: unknown): AmapPoiPhoto[] {
  if (raw == null || raw === '') return [];

  const rows = Array.isArray(raw) ? raw : [raw];
  const photos: AmapPoiPhoto[] = [];

  for (const item of rows) {
    if (typeof item === 'string') {
      const url = item.trim();
      if (/^https?:\/\//i.test(url)) photos.push({ url });
      continue;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const url = typeof record.url === 'string' ? record.url.trim() : '';
      if (/^https?:\/\//i.test(url)) {
        photos.push({
          url,
          title: typeof record.title === 'string' ? record.title : undefined,
        });
      }
    }
  }

  return photos;
}

function pickFirstPhoto(pois: AmapPoiRow[] | undefined): AmapPoiImageResult | null {
  if (!pois?.length) return null;

  for (const poi of pois) {
    const photos = normalizeAmapPhotos(poi.photos);
    const photo = photos[0];
    if (photo && poi.id) {
      return {
        poiId: poi.id,
        poiName: poi.name?.trim() || '',
        photo,
      };
    }
  }

  return null;
}

async function fetchPlaceTextWithPhotos(
  name: string,
  city: string,
): Promise<AmapPoiImageResult | null> {
  const key = getAmapWebKey();
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    keywords: name.trim(),
    city: city.trim(),
    citylimit: 'true',
    offset: '3',
    page: '1',
    extensions: 'all',
  });

  const timeoutMs = getAmapGeocodeTimeoutMs();
  const res = await fetchWithTimeout(`${AMAP_PLACE_TEXT_URL}?${params}`, timeoutMs);
  const data = (await res.json()) as AmapPlaceResponse;

  if (data.status !== '1') {
    console.warn('[amap-poi-image] place/text 无结果:', name, city, data.info ?? res.status);
    return null;
  }

  return pickFirstPhoto(data.pois);
}

async function fetchPlaceDetailPhotos(poiId: string): Promise<AmapPoiPhoto | null> {
  const key = getAmapWebKey();
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    id: poiId,
    extensions: 'all',
  });

  const timeoutMs = getAmapGeocodeTimeoutMs();
  const res = await fetchWithTimeout(`${AMAP_PLACE_DETAIL_URL}?${params}`, timeoutMs);
  const data = (await res.json()) as AmapPlaceResponse;

  if (data.status !== '1') {
    console.warn('[amap-poi-image] place/detail 无结果:', poiId, data.info ?? res.status);
    return null;
  }

  const picked = pickFirstPhoto(data.pois);
  return picked?.photo ?? null;
}

/**
 * 按景点名 + 城市从高德 POI 拉取封面图 URL。
 * 优先 place/text（extensions=all），若无图则尝试 place/detail。
 */
export async function fetchAmapPoiCoverImage(
  name: string,
  city: string,
): Promise<AmapPoiImageResult | null> {
  if (!isAmapImageEnrichEnabled()) return null;

  const trimmedName = name.trim();
  const trimmedCity = city.trim();
  if (!trimmedName || !trimmedCity) return null;

  try {
    const fromText = await fetchPlaceTextWithPhotos(trimmedName, trimmedCity);
    if (fromText) return fromText;

    // place/text 命中 POI 但无 photos 时，用 poiId 走 detail
    const key = getAmapWebKey();
    if (!key) return null;

    const params = new URLSearchParams({
      key,
      keywords: trimmedName,
      city: trimmedCity,
      citylimit: 'true',
      offset: '1',
      page: '1',
      extensions: 'base',
    });
    const timeoutMs = getAmapGeocodeTimeoutMs();
    const res = await fetchWithTimeout(`${AMAP_PLACE_TEXT_URL}?${params}`, timeoutMs);
    const data = (await res.json()) as AmapPlaceResponse;
    const poiId = data.pois?.[0]?.id;
    if (poiId) {
      return fetchAmapPoiCoverImageById(poiId, data.pois?.[0]?.name?.trim() || trimmedName);
    }

    return null;
  } catch (err) {
    console.warn(
      '[amap-poi-image] 拉取失败:',
      trimmedName,
      trimmedCity,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** 已知高德 POI ID 时直接查详情图 */
export async function fetchAmapPoiCoverImageById(
  poiId: string,
  poiName = '',
): Promise<AmapPoiImageResult | null> {
  if (!isAmapImageEnrichEnabled() || !poiId.trim()) return null;

  try {
    const photo = await fetchPlaceDetailPhotos(poiId.trim());
    if (!photo) return null;
    return { poiId: poiId.trim(), poiName, photo };
  } catch (err) {
    console.warn(
      '[amap-poi-image] detail 拉取失败:',
      poiId,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
