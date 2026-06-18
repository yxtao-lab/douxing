/**
 * H9+-1：Playbook 经典动线 / 段间端点名与 C3 景点库 alias 对齐校验
 */
import type { AttractionSeed } from '../data/attraction-seeds.js';
import { ATTRACTION_SEEDS } from '../data/attraction-seeds.js';
import type { RoutePlaybook } from '../data/route-playbooks.js';
import { ROUTE_PLAYBOOKS } from '../data/route-playbooks.js';

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export interface CityAttractionNameIndex {
  /** 规范化后的名称集合（含 alias） */
  names: Set<string>;
  /** 原始展示名（用于报告） */
  displayNames: string[];
}

/** 按城市构建 C3 景点名 + alias 索引 */
export function buildAttractionNameIndex(
  seeds: AttractionSeed[] = ATTRACTION_SEEDS,
): Map<string, CityAttractionNameIndex> {
  const byCity = new Map<string, CityAttractionNameIndex>();

  for (const seed of seeds) {
    const entry = byCity.get(seed.city) ?? { names: new Set<string>(), displayNames: [] };
    entry.names.add(normalizeName(seed.name));
    entry.displayNames.push(seed.name);
    for (const alias of seed.aliases ?? []) {
      entry.names.add(normalizeName(alias));
    }
    byCity.set(seed.city, entry);
  }

  return byCity;
}

export function isNameResolvableInCity(
  city: string,
  token: string,
  extraAliases: string[] = [],
  index: Map<string, CityAttractionNameIndex> = buildAttractionNameIndex(),
): boolean {
  const entry = index.get(city);
  if (!entry) return false;

  const candidates = [token, ...extraAliases];
  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    if ([...entry.names].some((known) => namesMatch(known, normalized))) {
      return true;
    }
  }
  return false;
}

export interface PlaybookAliasCoverageReport {
  playbookId: string;
  city: string;
  totalTokens: number;
  resolvedTokens: number;
  coverage: number;
  unresolved: string[];
}

/** 统计单条 playbook 的 classicOrder + segments 端点与 C3 对齐率 */
export function computePlaybookAliasCoverage(
  playbook: RoutePlaybook,
  index: Map<string, CityAttractionNameIndex> = buildAttractionNameIndex(),
): PlaybookAliasCoverageReport {
  const tokens: Array<{ label: string; aliases: string[] }> = [];

  for (const name of playbook.classicOrder) {
    tokens.push({ label: name, aliases: [] });
  }
  for (const seg of playbook.segments) {
    tokens.push({ label: seg.from, aliases: seg.fromAliases ?? [] });
    tokens.push({ label: seg.to, aliases: seg.toAliases ?? [] });
  }

  const seen = new Set<string>();
  const unique: Array<{ label: string; aliases: string[] }> = [];
  for (const item of tokens) {
    const key = `${item.label}::${item.aliases.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const unresolved: string[] = [];
  let resolved = 0;

  for (const { label, aliases } of unique) {
    if (isNameResolvableInCity(playbook.city, label, aliases, index)) {
      resolved += 1;
    } else {
      unresolved.push(label);
    }
  }

  const total = unique.length;
  return {
    playbookId: playbook.id,
    city: playbook.city,
    totalTokens: total,
    resolvedTokens: resolved,
    coverage: total === 0 ? 1 : resolved / total,
    unresolved,
  };
}

/** 全库 playbook alias 覆盖率汇总 */
export function computeAllPlaybookAliasCoverage(
  playbooks: RoutePlaybook[] = ROUTE_PLAYBOOKS,
): {
  overallCoverage: number;
  perPlaybook: PlaybookAliasCoverageReport[];
} {
  const index = buildAttractionNameIndex();
  const perPlaybook = playbooks.map((pb) => computePlaybookAliasCoverage(pb, index));
  const totalTokens = perPlaybook.reduce((sum, item) => sum + item.totalTokens, 0);
  const resolvedTokens = perPlaybook.reduce((sum, item) => sum + item.resolvedTokens, 0);

  return {
    overallCoverage: totalTokens === 0 ? 1 : resolvedTokens / totalTokens,
    perPlaybook,
  };
}

/** TOP 10 城市是否各有 ≥1 条 playbook */
export function countPlaybooksByCity(
  playbooks: RoutePlaybook[] = ROUTE_PLAYBOOKS,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pb of playbooks) {
    counts.set(pb.city, (counts.get(pb.city) ?? 0) + 1);
  }
  return counts;
}
