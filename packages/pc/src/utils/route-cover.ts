import { resolveRouteListCoverImage, type TravelRouteInfo } from '@douxing/shared';

export function getRouteCardCoverUrl(route: TravelRouteInfo): string | null {
  return resolveRouteListCoverImage(route);
}
