import type { LocaleCode, RouteTransitMode } from '@douxing/shared';
import {
  ROUTE_PLAYBOOKS,
  type PlaybookSegmentEdge,
  type PlaybookTransitReasonKey,
  type RoutePlaybook,
} from '../data/route-playbooks.js';

export interface PlaybookRetrievalInput {
  city?: string | null;
  themes?: string[];
  prompt?: string;
  dayTitle?: string;
  limit?: number;
}

export interface MatchedRoutePlaybook {
  playbook: RoutePlaybook;
  score: number;
}

export interface PlaybookSegmentHint {
  mode: RouteTransitMode;
  reasonKey: PlaybookTransitReasonKey;
  scope: string;
  playbookId: string;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase();
}

function extractKeywords(text: string): string[] {
  return text
    .split(/[，,。；;、\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function nameInPlaybook(name: string, token: string, aliases?: string[]): boolean {
  if (namesMatch(name, token)) return true;
  return (aliases ?? []).some((alias) => namesMatch(name, alias));
}

function scorePlaybook(
  playbook: RoutePlaybook,
  city: string | null | undefined,
  themes: string[],
  keywords: string[],
): number {
  let score = 0;
  if (city && playbook.city === city.trim()) score += 8;

  for (const theme of themes) {
    if (playbook.themes.includes(theme)) score += 4;
    for (const kw of playbook.keywords) {
      if (kw.includes(theme) || theme.includes(kw)) score += 2;
    }
  }

  const haystack = [
    playbook.scope,
    playbook.summaryZh,
    ...playbook.keywords,
    ...playbook.classicOrder,
  ]
    .join(' ')
    .toLowerCase();

  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (k.length < 2) continue;
    if (haystack.includes(k)) score += 3;
    for (const classic of playbook.classicOrder) {
      if (classic.includes(kw) || kw.includes(classic)) score += 4;
    }
  }

  return score;
}

/** H9-4b：检索玩法动线 */
export function retrievePlaybooksForPlanning(
  input: PlaybookRetrievalInput,
): MatchedRoutePlaybook[] {
  const themes = input.themes ?? [];
  const promptKeywords = extractKeywords(input.prompt ?? '');
  const titleKeywords = extractKeywords(input.dayTitle ?? '');
  const keywords = [...new Set([...promptKeywords, ...titleKeywords])];
  const limit = input.limit ?? 3;

  const scored = ROUTE_PLAYBOOKS.map((playbook) => ({
    playbook,
    score: scorePlaybook(playbook, input.city, themes, keywords),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

function findEdge(
  playbooks: MatchedRoutePlaybook[],
  fromLabel: string,
  toLabel: string,
): PlaybookSegmentEdge | null {
  for (const { playbook } of playbooks) {
    for (const edge of playbook.segments) {
      const fromOk = nameInPlaybook(fromLabel, edge.from, edge.fromAliases);
      const toOk = nameInPlaybook(toLabel, edge.to, edge.toAliases);
      if (fromOk && toOk) return edge;
    }
  }
  return null;
}

/** H9-4d：段间 mode 与理由 */
export function findPlaybookSegmentHint(
  playbooks: MatchedRoutePlaybook[],
  fromLabel: string,
  toLabel: string,
): PlaybookSegmentHint | null {
  const edge = findEdge(playbooks, fromLabel, toLabel);
  if (!edge) return null;

  const owner = playbooks.find((item) =>
    item.playbook.segments.some(
      (seg) => seg.from === edge.from && seg.to === edge.to && seg.mode === edge.mode,
    ),
  );
  if (!owner) return null;

  return {
    mode: edge.mode,
    reasonKey: edge.reasonKey,
    scope: owner.playbook.scope,
    playbookId: owner.playbook.id,
  };
}

/** 当日 POI 是否落在景区 playbook 簇内（≥2 个命中） */
export function isScenicClusterDay(
  playbooks: MatchedRoutePlaybook[],
  spotNames: string[],
  dayTitle?: string,
): boolean {
  if (playbooks.length === 0) return false;

  for (const { playbook } of playbooks) {
    let hits = 0;
    for (const spot of spotNames) {
      const matched = playbook.classicOrder.some((token) => namesMatch(spot, token));
      if (matched) hits += 1;
    }
    if (dayTitle && (dayTitle.includes(playbook.scope) || playbook.keywords.some((k) => dayTitle.includes(k)))) {
      hits += 1;
    }
    if (hits >= 2) return true;
  }
  return false;
}

/** H9-4c：注入 LLM 的玩法动线摘要 */
export function formatPlaybookContextForLlm(
  matches: MatchedRoutePlaybook[],
  locale: LocaleCode = 'zh-CN',
): string {
  if (matches.length === 0) return '';

  const lines =
    locale === 'en-US'
      ? [
          '【Playbook reference — align attractions order; do NOT invent transit/lodging】',
          '- Keep poiType=attraction names from the POI catalog when possible',
          '- Follow the classic visit order below when selecting and ordering spots',
        ]
      : [
          '【玩法动线参考 — 排列 attractions 顺序；禁止编造 transit/lodging】',
          '- poiType=attraction 仍须优先使用内容库 POI 名称',
          '- 下列经典顺序仅作游玩顺序参考，可在库内 POI 中微调',
        ];

  for (const { playbook } of matches) {
    const summary = locale === 'en-US' ? playbook.summaryEn : playbook.summaryZh;
    const order = playbook.classicOrder.join(locale === 'en-US' ? ' → ' : ' → ');
    lines.push(`- ${playbook.scope}（${playbook.city}）：${summary}`);
    lines.push(`  顺序：${order}`);

    const segHints = playbook.segments
      .slice(0, 6)
      .map((seg) => `${seg.from}→${seg.to}(${seg.mode})`)
      .join(locale === 'en-US' ? '; ' : '；');
    if (segHints) {
      lines.push(`  段间：${segHints}`);
    }
  }

  return lines.join('\n');
}
