/** 城市中文名 → city_code */
export const CITY_CODE_MAP: Record<string, string> = {
  杭州: 'hangzhou',
  上海: 'shanghai',
  北京: 'beijing',
  成都: 'chengdu',
  西安: 'xian',
  广州: 'guangzhou',
  深圳: 'shenzhen',
  厦门: 'xiamen',
  南京: 'nanjing',
  苏州: 'suzhou',
  重庆: 'chongqing',
  武汉: 'wuhan',
  长沙: 'changsha',
  青岛: 'qingdao',
  大连: 'dalian',
  三亚: 'sanya',
  丽江: 'lijiang',
  桂林: 'guilin',
  昆明: 'kunming',
};

export function resolveCityCode(city: string): string {
  const trimmed = city.trim();
  if (CITY_CODE_MAP[trimmed]) return CITY_CODE_MAP[trimmed];
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/市$/, '')
    .slice(0, 32) || 'unknown';
}
