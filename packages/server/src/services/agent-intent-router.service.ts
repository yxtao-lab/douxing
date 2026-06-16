/**
 * Phase 3：追问意图路由（规则版，供 Agent / plan_sessions 共用）
 */
export type AgentIntentRoute =
  | 'plan_new'
  | 'tweak_day'
  | 'tweak_poi'
  | 'budget_tune'
  | 'lodging_tune'
  | 'qa_food'
  | 'select_variant'
  | 'unknown';

export interface RoutedAgentIntent {
  route: AgentIntentRoute;
  dayIndex?: number;
  excludePoiNames?: string[];
  relaxed?: boolean;
}

const DAY_PATTERN = /第\s*([一二三四五六七八九十\d]+)\s*天/;
const CN_NUM: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseDayIndex(text: string): number | undefined {
  const m = text.match(DAY_PATTERN);
  if (!m?.[1]) return undefined;
  const raw = m[1];
  if (/^\d+$/.test(raw)) return Math.max(1, parseInt(raw, 10)) - 1;
  return (CN_NUM[raw] ?? 1) - 1;
}

function extractExcludeNames(text: string): string[] {
  const names: string[] = [];
  const notPattern = /不要|别去|去掉|换成(?!小众)/g;
  if (!notPattern.test(text)) return names;
  const poiPattern = /不要\s*([^，,。；;\s]{2,12})|别去\s*([^，,。；;\s]{2,12})/g;
  let match: RegExpExecArray | null;
  while ((match = poiPattern.exec(text)) !== null) {
    const name = (match[1] ?? match[2])?.trim();
    if (name) names.push(name);
  }
  return names;
}

export function routeAgentIntent(message: string): RoutedAgentIntent {
  const text = message.trim();
  if (!text) return { route: 'unknown' };

  if (/方案\s*[A-Da-dB]|就方案|选方案/.test(text)) {
    return { route: 'select_variant' };
  }

  if (/轻松|悠闲|慢一点|少排|不要太累/.test(text) && DAY_PATTERN.test(text)) {
    return {
      route: 'tweak_day',
      dayIndex: parseDayIndex(text),
      relaxed: true,
    };
  }

  if (/预算|省钱|降到|不超过.*元/.test(text)) {
    return { route: 'budget_tune' };
  }

  if (/住|酒店|民宿|西湖边|附近住/.test(text)) {
    return { route: 'lodging_tune' };
  }

  if (/有什么吃|美食|好吃|餐厅/.test(text) && !/规划|路线|行程/.test(text)) {
    return { route: 'qa_food' };
  }

  const excludePoiNames = extractExcludeNames(text);
  if (excludePoiNames.length > 0 || /小众|换.*景点|不要.*塔/.test(text)) {
    const dayIndex = parseDayIndex(text);
    return {
      route: dayIndex != null ? 'tweak_day' : 'tweak_poi',
      dayIndex,
      excludePoiNames,
    };
  }

  if (DAY_PATTERN.test(text) && /改|调整|换/.test(text)) {
    return {
      route: 'tweak_day',
      dayIndex: parseDayIndex(text),
    };
  }

  if (/规划|行程|路线|去.*玩/.test(text)) {
    return { route: 'plan_new' };
  }

  return { route: 'unknown' };
}
