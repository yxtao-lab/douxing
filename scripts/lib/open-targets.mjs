/**
 * 是否允许为当前端打开浏览器 / 开发者工具。
 * - DOUXING_NO_OPEN=1：全部禁用
 * - DOUXING_OPEN_TARGETS=web,pc,mp-weixin：仅列出的端
 * - LABHUB_SKIP_OPEN_TAGS=web：跳过 LabHub 已负责打开的端
 * - 未设置 targets 时：各端自行打开
 *
 * @param {string} tag
 * @returns {boolean}
 */
export function shouldOpenBrowserForTag(tag) {
  if (process.env.DOUXING_NO_OPEN === '1') return false;
  const normalized = String(tag).trim().toLowerCase();
  const skipRaw = process.env.LABHUB_SKIP_OPEN_TAGS?.trim();
  if (skipRaw) {
    const skipped = new Set(
      skipRaw
        .split(/[,;\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    if (skipped.has(normalized) || (normalized === 'mp' && skipped.has('mp-weixin'))) {
      return false;
    }
  }
  const raw = process.env.DOUXING_OPEN_TARGETS?.trim();
  if (!raw) return true;
  const allowed = new Set(
    raw
      .split(/[,;\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowed.has('all') || allowed.has('*')) return true;
  if (allowed.has(normalized)) return true;
  if (normalized === 'mp' && allowed.has('mp-weixin')) return true;
  if (normalized === 'mp-weixin' && allowed.has('mp')) return true;
  return false;
}
