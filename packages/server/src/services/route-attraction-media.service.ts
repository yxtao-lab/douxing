import { enrichRouteDetailWithPoiTrust } from './route-poi-trust.service.js';

/**
 * 为路线详情 POI 注入景点封面（只读展示，不写回 DB）。
 * H10-a 起委托 `enrichRouteDetailWithPoiTrust`，保留旧导出名兼容调用方。
 *
 * @param routeDetail - 路线 `route_detail` JSON
 * @returns 富化后的详情
 */
export async function enrichRouteDetailWithAttractionCovers(
  routeDetail: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  return enrichRouteDetailWithPoiTrust(routeDetail);
}
