/** Phase 2：向量 RAG / MMR 多样性检索配置 */

export function isVectorRagEnabled(): boolean {
  return process.env.VECTOR_RAG_ENABLED === 'true';
}

export function getVectorRagBoostWeight(): number {
  const raw = parseFloat(process.env.VECTOR_RAG_BOOST_WEIGHT ?? '0.35');
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : 0.35;
}

export function getMmrLambda(): number {
  const raw = parseFloat(process.env.MMR_LAMBDA ?? '0.7');
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 0.1), 0.95) : 0.7;
}

export function getPoiHitRateFallbackThreshold(): number {
  const raw = parseFloat(process.env.POI_HIT_RATE_FALLBACK_THRESHOLD ?? '0.8');
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 0.5), 1) : 0.8;
}
