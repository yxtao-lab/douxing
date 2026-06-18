import type { AgentToolTraceEntry } from '../types.js';
import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';

/** Agent Tool 名称（与 server `AGENT_TOOL_NAMES` 及 graph tool_trace 对齐） */
export const AGENT_TOOL_STATUS_KEYS = [
  'thinking',
  'pending',
  'done',
  'failed',
  'unknown',
  'parse_intent',
  'retrieve_attractions',
  'retrieve_playbooks',
  'generate_route_draft',
  'enrich_route',
  'validate_route',
  'build_route_variants',
  'patch_route_day',
  'tune_route_budget',
  'lodging_tune',
  'answer_food_qa',
  'select_plan_variant',
  'recall_user_memory',
  'write_trip_memory',
] as const;

export type AgentToolStatusKey = (typeof AGENT_TOOL_STATUS_KEYS)[number];

const AGENT_STATUS_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'agent.status.thinking': '正在理解您的需求…',
    'agent.status.pending': '等待中…',
    'agent.status.done': '已完成',
    'agent.status.failed': '失败',
    'agent.status.unknown': '处理中…',
    'agent.status.progressTitle': 'Agent 执行进度',
    'agent.status.parse_intent': '解析旅行意图',
    'agent.status.retrieve_attractions': '检索景点库',
    'agent.status.retrieve_playbooks': '匹配玩法动线',
    'agent.status.generate_route_draft': '生成路线草案',
    'agent.status.enrich_route': '补全住宿与交通',
    'agent.status.validate_route': '校验行程合理性',
    'agent.status.build_route_variants': '生成候选方案变体',
    'agent.status.patch_route_day': '调整指定天数',
    'agent.status.tune_route_budget': '调整预算方案',
    'agent.status.lodging_tune': '更新住宿安排',
    'agent.status.answer_food_qa': '查询美食推荐',
    'agent.status.select_plan_variant': '切换候选方案',
    'agent.status.recall_user_memory': '回忆旅行偏好',
    'agent.status.write_trip_memory': '记录旅行记忆',
  },
  'en-US': {
    'agent.status.thinking': 'Understanding your request…',
    'agent.status.pending': 'Pending…',
    'agent.status.done': 'Done',
    'agent.status.failed': 'Failed',
    'agent.status.unknown': 'Working…',
    'agent.status.progressTitle': 'Agent progress',
    'agent.status.parse_intent': 'Parsing travel intent',
    'agent.status.retrieve_attractions': 'Searching attractions',
    'agent.status.retrieve_playbooks': 'Matching route playbooks',
    'agent.status.generate_route_draft': 'Drafting itinerary',
    'agent.status.enrich_route': 'Enriching stays & transit',
    'agent.status.validate_route': 'Validating plan',
    'agent.status.build_route_variants': 'Building plan variants',
    'agent.status.patch_route_day': 'Adjusting day plan',
    'agent.status.tune_route_budget': 'Tuning budget',
    'agent.status.lodging_tune': 'Updating lodging',
    'agent.status.answer_food_qa': 'Looking up food picks',
    'agent.status.select_plan_variant': 'Switching plan variant',
    'agent.status.recall_user_memory': 'Recalling preferences',
    'agent.status.write_trip_memory': 'Saving trip memory',
  },
};

function agentStatusMsg(
  key: string,
  locale: LocaleCode,
  params?: Record<string, string | number>,
): string {
  const table = AGENT_STATUS_MESSAGES[locale] ?? AGENT_STATUS_MESSAGES[DEFAULT_LOCALE];
  const fallback = AGENT_STATUS_MESSAGES[DEFAULT_LOCALE];
  return formatMessage(table[key] ?? fallback[key] ?? key, params);
}

/** 将 `agent.status.*` 扁平键转为 vue-i18n 嵌套 `agent.status` 块 */
export function buildAgentStatusLocaleBlock(locale: LocaleCode): Record<string, string> {
  const table = AGENT_STATUS_MESSAGES[locale] ?? AGENT_STATUS_MESSAGES[DEFAULT_LOCALE];
  const block: Record<string, string> = {};
  for (const [key, value] of Object.entries(table)) {
    if (key.startsWith('agent.status.')) {
      block[key.slice('agent.status.'.length)] = value;
    }
  }
  return block;
}

export function resolveAgentStatusI18nKey(tool: string): string {
  const normalized = tool.trim();
  if (!normalized) return 'agent.status.unknown';
  if (AGENT_TOOL_STATUS_KEYS.includes(normalized as AgentToolStatusKey)) {
    return `agent.status.${normalized}`;
  }
  return 'agent.status.unknown';
}

export function isKnownAgentToolStatusKey(tool: string): tool is AgentToolStatusKey {
  return AGENT_TOOL_STATUS_KEYS.includes(tool as AgentToolStatusKey);
}

/** 格式化 Tool 进度文案（服务端 SSE / 前端遮罩共用） */
export function formatAgentStatusLabel(tool: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  return agentStatusMsg(resolveAgentStatusI18nKey(tool), locale);
}

export type AgentToolStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface AgentToolStepView {
  tool: string;
  status: AgentToolStepStatus;
  ms?: number;
}

/** 将持久化 toolTrace 转为 UI 步骤列表 */
export function mapAgentToolTraceToSteps(trace: AgentToolTraceEntry[]): AgentToolStepView[] {
  return trace.map((entry) => ({
    tool: entry.tool,
    status: entry.ok ? 'done' : 'failed',
    ms: entry.ms,
  }));
}
