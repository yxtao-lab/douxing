/**
 * Phase 2：MMR（Maximal Marginal Relevance）多样性重排
 */
export interface MmrItem<T> {
  item: T;
  /** 与查询的相关度 [0, 1] */
  relevance: number;
  /** 与已选集合的最大相似度 [0, 1] */
  maxSimilarityToSelected: (selected: T[]) => number;
}

export function mmrRerank<T>(
  items: MmrItem<T>[],
  limit: number,
  lambda = 0.7,
): T[] {
  if (items.length === 0 || limit <= 0) return [];
  const selected: T[] = [];
  const pool = [...items];

  while (selected.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const entry = pool[i]!;
      const diversityPenalty =
        selected.length === 0 ? 0 : entry.maxSimilarityToSelected(selected);
      const score = lambda * entry.relevance - (1 - lambda) * diversityPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    selected.push(pool[bestIdx]!.item);
    pool.splice(bestIdx, 1);
  }

  return selected;
}

/** 归一化关键词 Jaccard 相似度 */
export function keywordJaccardSimilarity(a: string, b: string): number {
  const tokenize = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/[\s,，。；;、]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 曼哈顿距离相似度（越近越高） */
export function geoSimilarity(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  maxDist = 0.15,
): number {
  const dist =
    Math.abs(a.latitude - b.latitude) + Math.abs(a.longitude - b.longitude);
  if (dist >= maxDist) return 0;
  return 1 - dist / maxDist;
}

/** tag 集合 Jaccard */
export function tagJaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA);
  const setB = new Set(tagsB);
  if (setA.size === 0 && setB.size === 0) return 0.3;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
