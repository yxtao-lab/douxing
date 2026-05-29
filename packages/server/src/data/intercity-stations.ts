/** H9-3：城市 → 主要铁路/航空枢纽（用于班次库与订票链接） */

export interface IntercityHubInfo {
  trainStation: string;
  airport?: string;
}

export const INTERCITY_HUB_BY_CITY: Record<string, IntercityHubInfo> = {
  杭州: { trainStation: '杭州东', airport: '杭州萧山' },
  上海: { trainStation: '上海虹桥', airport: '上海虹桥' },
  北京: { trainStation: '北京南', airport: '北京首都' },
  西安: { trainStation: '西安北', airport: '西安咸阳' },
  广州: { trainStation: '广州南', airport: '广州白云' },
  深圳: { trainStation: '深圳北', airport: '深圳宝安' },
  成都: { trainStation: '成都东', airport: '成都双流' },
  重庆: { trainStation: '重庆北', airport: '重庆江北' },
  南京: { trainStation: '南京南', airport: '南京禄口' },
  苏州: { trainStation: '苏州北', airport: '苏南硕放' },
  武汉: { trainStation: '武汉', airport: '武汉天河' },
  厦门: { trainStation: '厦门北', airport: '厦门高崎' },
};

export function resolveTrainStation(city: string): string {
  const hub = INTERCITY_HUB_BY_CITY[city.trim()];
  if (hub) return hub.trainStation;
  return `${city.trim()}站`;
}

export function resolveAirportLabel(city: string): string {
  const hub = INTERCITY_HUB_BY_CITY[city.trim()];
  if (hub?.airport) return hub.airport;
  return `${city.trim()}机场`;
}
