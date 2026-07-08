import { isAmapGeocodeEnabled, getAmapWebKey, getAmapGeocodeTimeoutMs } from '../config/amap.js';
import { recordExternalApiCall } from '../observability/external-api-counter.service.js';
import { getCachedGeocode, setCachedGeocode } from './geocode-cache.service.js';

const AMAP_PLACE_TEXT_URL = 'https://restapi.amap.com/v3/place/text';
const AMAP_GEO_URL = 'https://restapi.amap.com/v3/geocode/geo';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** place_text | geocode_geo */
  method: 'place_text' | 'geocode_geo';
  /** 高德 POI ID（仅 place 接口可能有） */
  amapPoiId?: string;
}

/** Phase 5：高德 POI 搜索结果 */
export interface AmapPoiResult {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  type?: string;
  amapPoiId?: string;
}

interface AmapPlaceResponse {
  status?: string;
  info?: string;
  pois?: Array<{
    location?: string;
    id?: string;
    name?: string;
    address?: string;
    type?: string;
  }>;
}

interface AmapGeoResponse {
  status?: string;
  info?: string;
  geocodes?: Array<{ location?: string }>;
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

/** 解析高德 location 字符串（格式：经度,纬度） */
function parseAmapLocation(location: string): { latitude: number; longitude: number } | null {
  const parts = location.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude };
}

/**
 * 高德 POI 关键词搜索（适合景点名、饭店名、酒店名）
 * @see https://lbs.amap.com/api/webservice/guide/api/search
 */
export async function geocodeByPlaceText(
  name: string,
  city: string,
): Promise<GeocodeResult | null> {
  const key = getAmapWebKey();
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    keywords: name.trim(),
    city: city.trim(),
    citylimit: 'true',
    offset: '1',
    page: '1',
    extensions: 'base',
  });

  const timeoutMs = getAmapGeocodeTimeoutMs();
  recordExternalApiCall();
  const res = await fetchWithTimeout(`${AMAP_PLACE_TEXT_URL}?${params}`, timeoutMs);
  const data = (await res.json()) as AmapPlaceResponse;

  if (data.status !== '1' || !data.pois?.[0]?.location) {
    console.warn('[amap] place/text 无结果:', name, city, data.info ?? res.status);
    return null;
  }

  const parsed = parseAmapLocation(data.pois[0].location);
  if (!parsed) return null;

  return {
    ...parsed,
    method: 'place_text',
    amapPoiId: data.pois[0].id,
  };
}

/**
 * 高德地理编码（地址 → 坐标，作为 place 失败时的回退）
 * @see https://lbs.amap.com/api/webservice/guide/api/georegeo
 */
export async function geocodeByAddress(
  name: string,
  city: string,
): Promise<GeocodeResult | null> {
  const key = getAmapWebKey();
  if (!key) return null;

  const address = `${city.trim()}${name.trim()}`;
  const params = new URLSearchParams({
    key,
    address,
    city: city.trim(),
  });

  const timeoutMs = getAmapGeocodeTimeoutMs();
  recordExternalApiCall();
  const res = await fetchWithTimeout(`${AMAP_GEO_URL}?${params}`, timeoutMs);
  const data = (await res.json()) as AmapGeoResponse;

  if (data.status !== '1' || !data.geocodes?.[0]?.location) {
    console.warn('[amap] geocode/geo 无结果:', address, data.info ?? res.status);
    return null;
  }

  const parsed = parseAmapLocation(data.geocodes[0].location);
  if (!parsed) return null;

  return { ...parsed, method: 'geocode_geo' };
}

/**
 * Phase 5：高德 POI 关键词搜索（多结果，用于酒店真实化与批量同步）
 */
export async function searchPoisByKeyword(
  keywords: string,
  city: string,
  options?: { limit?: number; types?: string },
): Promise<AmapPoiResult[]> {
  const key = getAmapWebKey();
  if (!key) return [];

  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 50);
  const params = new URLSearchParams({
    key,
    keywords: keywords.trim(),
    city: city.trim(),
    citylimit: 'true',
    offset: String(limit),
    page: '1',
    extensions: 'base',
  });
  if (options?.types?.trim()) {
    params.set('types', options.types.trim());
  }

  const timeoutMs = getAmapGeocodeTimeoutMs();
  try {
    recordExternalApiCall();
    const res = await fetchWithTimeout(`${AMAP_PLACE_TEXT_URL}?${params}`, timeoutMs);
    const data = (await res.json()) as AmapPlaceResponse;

    if (data.status !== '1' || !data.pois?.length) {
      return [];
    }

    const results: AmapPoiResult[] = [];
    for (const poi of data.pois) {
      if (!poi.location || !poi.name) continue;
      const parsed = parseAmapLocation(poi.location);
      if (!parsed) continue;
      results.push({
        name: poi.name.trim(),
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        address: poi.address,
        type: poi.type,
        amapPoiId: poi.id,
      });
    }
    return results;
  } catch (err) {
    console.warn(
      '[amap] searchPoisByKeyword 失败:',
      keywords,
      city,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Phase 5：按区域 + 档次搜索真实酒店 POI
 */
export async function searchHotelsByArea(
  city: string,
  options?: { area?: string; tierKeyword?: string; limit?: number },
): Promise<AmapPoiResult[]> {
  const area = options?.area?.trim();
  const tierKeyword = options?.tierKeyword?.trim() ?? '酒店';
  const query = area ? `${area}${tierKeyword}` : `${city}${tierKeyword}`;
  return searchPoisByKeyword(query, city, {
    limit: options?.limit ?? 8,
    types: '100000',
  });
}

/**
 * 为 POI 解析坐标：优先 place/text，失败再 geocode/geo
 */
export async function resolveCoordinatesFromAmap(
  name: string,
  city: string,
): Promise<GeocodeResult | null> {
  if (!isAmapGeocodeEnabled()) return null;

  const cached = await getCachedGeocode(city, name);
  if (cached) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[amap] 缓存命中: ${city} · ${name}`);
    }
    return cached;
  }

  try {
    const fromPlace = await geocodeByPlaceText(name, city);
    if (fromPlace) {
      await setCachedGeocode(city, name, fromPlace);
      return fromPlace;
    }
    const fromGeo = await geocodeByAddress(name, city);
    if (fromGeo) {
      await setCachedGeocode(city, name, fromGeo);
    }
    return fromGeo;
  } catch (err) {
    console.warn(
      '[amap] 地理编码失败:',
      name,
      city,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
