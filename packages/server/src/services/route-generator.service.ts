import { ROUTE_TEMPLATES, type RouteTemplate } from '../data/route-templates.js';
import type { LlmProviderChoice } from '../config/llm.js';
import type { PlanChatMessage } from '@douxing/shared';
import { canUseLlm, generateRouteFromLlm } from './llm-route-generator.service.js';

export interface GenerateRouteInput {
  prompt: string;
  days?: number;
  budget?: string;
  /** 模型提供商：auto | deepseek | lmstudio */
  provider?: LlmProviderChoice;
  /** 多轮对话历史（不含当前 prompt） */
  history?: PlanChatMessage[];
}

export interface GeneratedRouteDraft {
  name: string;
  description: string;
  budgetRange: string;
  days: number;
  interestTags: string[];
  routeDetail: RouteTemplate['routeDetail'];
  unlockPrice: number;
  matchedCity: string;
  isAiGenerated: boolean;
}

function detectCity(prompt: string): string | null {
  const cities = ['杭州', '上海', '北京', '成都', '西安', '广州', '深圳', '厦门'];
  return cities.find((c) => prompt.includes(c)) ?? null;
}

function detectDays(prompt: string, fallback?: number): number {
  const match = prompt.match(/(\d+)\s*天/);
  if (match) return Math.min(Math.max(parseInt(match[1], 10), 1), 7);
  if (fallback) return fallback;
  return 3;
}

function detectTags(prompt: string): string[] {
  const tagMap: Record<string, string> = {
    亲子: '亲子',
    情侣: '浪漫',
    美食: '美食',
    文化: '文化',
    户外: '户外',
    摄影: '摄影',
    穷游: '经济',
    豪华: '奢华',
  };
  const tags: string[] = [];
  for (const [key, tag] of Object.entries(tagMap)) {
    if (prompt.includes(key)) tags.push(tag);
  }
  return tags.length > 0 ? tags : ['休闲'];
}

function scoreTemplate(template: RouteTemplate, city: string | null, days: number, tags: string[]): number {
  let score = 0;
  if (city && template.city === city) score += 10;
  if (Math.abs(template.days - days) <= 1) score += 5;
  for (const tag of tags) {
    if (template.interestTags.includes(tag)) score += 3;
    if (template.keywords.some((k) => k.includes(tag) || tag.includes(k))) score += 2;
  }
  return score;
}

export type GenerationSource = 'llm' | 'template';

/** 优先 LLM（可选 DeepSeek / LM Studio），失败则回退模板 */
export async function generateRoute(
  input: GenerateRouteInput,
): Promise<
  GeneratedRouteDraft & { generationSource: GenerationSource; llmProvider?: string }
> {
  if (canUseLlm()) {
    try {
      const draft = await generateRouteFromLlm(input);
      return {
        ...draft,
        generationSource: 'llm',
        llmProvider: draft.llmProvider,
      };
    } catch (err) {
      console.warn(
        '[route-generator] LLM 生成失败，回退模板:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { ...generateRouteFromTemplate(input), generationSource: 'template' };
}

/** 基于模板匹配（LLM 不可用时的降级方案） */
export function generateRouteFromTemplate(input: GenerateRouteInput): GeneratedRouteDraft {
  const historyUserText = (input.history ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('；');
  const prompt = [historyUserText, input.prompt.trim()].filter(Boolean).join('；');
  const city = detectCity(prompt);
  const days = input.days ?? detectDays(prompt);
  const tags = detectTags(prompt);
  const budget = input.budget ?? '';

  let best = ROUTE_TEMPLATES[0];
  let bestScore = -1;
  for (const template of ROUTE_TEMPLATES) {
    const score = scoreTemplate(template, city, days, tags);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  const budgetRange = budget || best.budgetRange;
  const name = city
    ? `${city}${tags[0] ?? '精选'}${days}日游`
    : best.name;

  const routeDetail = {
    days: best.routeDetail.days.map((day) => ({
      date: day.date,
      title: day.title,
      attractions: day.attractions.map((spot) => ({ ...spot })),
    })),
  };

  return {
    name,
    description: `${best.description}（根据「${prompt.slice(0, 50)}${prompt.length > 50 ? '…' : ''}」智能匹配）`,
    budgetRange,
    days: best.days,
    interestTags: [...new Set([...best.interestTags, ...tags])],
    routeDetail,
    unlockPrice: best.unlockPrice,
    matchedCity: city ?? best.city,
    isAiGenerated: true,
  };
}
