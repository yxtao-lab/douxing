/**
 * Phase 2：轻量文本向量（TF-IDF 风格）用于语义增强，无需外部 embedding 服务
 */
import type { RagAttractionCandidate } from '@douxing/shared';
import { keywordJaccardSimilarity } from '../utils/mmr-rank.util.js';

function buildDocumentText(candidate: RagAttractionCandidate): string {
  return [
    candidate.name,
    candidate.description ?? '',
    candidate.tags.join(' '),
    ...(candidate.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,，。；;、]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** 查询与候选的语义相关度 [0, 1] */
export function computeSemanticRelevance(
  query: string,
  candidate: RagAttractionCandidate,
): number {
  const doc = buildDocumentText(candidate);
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const jaccard = keywordJaccardSimilarity(q, doc);
  const qTokens = tokenize(q);
  let hitBoost = 0;
  for (const token of qTokens) {
    if (doc.includes(token)) hitBoost += 0.08;
  }
  return Math.min(1, jaccard * 0.6 + Math.min(hitBoost, 0.4));
}

/** 两候选文本相似度 */
export function computeCandidateSimilarity(
  a: RagAttractionCandidate,
  b: RagAttractionCandidate,
): number {
  const docA = buildDocumentText(a);
  const docB = buildDocumentText(b);
  const textSim = keywordJaccardSimilarity(docA, docB);
  const tagSim =
    a.tags.length > 0 && b.tags.length > 0
      ? a.tags.filter((t) => b.tags.includes(t)).length /
        new Set([...a.tags, ...b.tags]).size
      : 0;
  return Math.min(1, textSim * 0.65 + tagSim * 0.35);
}
