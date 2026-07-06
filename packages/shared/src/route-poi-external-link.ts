/**
 * H10-d：POI 外链讨论 URL 校验与平台识别（shared 跨端复用）。
 */

/** 允许跳转的外链讨论平台域名后缀 */
export const ALLOWED_EXTERNAL_DISCUSSION_HOST_SUFFIXES = [
  'xiaohongshu.com',
  'xhslink.com',
  'douyin.com',
  'bilibili.com',
] as const;

export type ExternalDiscussionPlatform = 'xiaohongshu' | 'douyin' | 'bilibili' | 'other';

/**
 * 判断 URL 是否为允许的第三方讨论外链（须 https）。
 *
 * @param rawUrl - 用户提交的完整 URL
 * @returns 合法且域名在白名单内时为 true
 */
export function isAllowedExternalDiscussionUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_EXTERNAL_DISCUSSION_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/**
 * 识别外链所属平台，用于 UI 展示图标/文案。
 *
 * @param rawUrl - 完整 URL
 * @returns 平台标识；无法识别时为 `other`
 */
export function detectExternalDiscussionPlatform(rawUrl: string): ExternalDiscussionPlatform {
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    if (host.includes('xiaohongshu') || host.includes('xhslink')) return 'xiaohongshu';
    if (host.includes('douyin')) return 'douyin';
    if (host.includes('bilibili')) return 'bilibili';
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * 按 H10-d 热门规则对评论排序：精选优先，再按点赞数，再按时间。
 *
 * @param comments - 待排序评论（会复制后排序，不修改原数组）
 * @returns 排序后的新数组
 */
export function sortRouteCommentsByHot<
  T extends { isFeatured?: boolean; likeCount?: number; createdAt: string },
>(comments: T[]): T[] {
  return [...comments].sort((a, b) => {
    const featuredA = a.isFeatured ? 1 : 0;
    const featuredB = b.isFeatured ? 1 : 0;
    if (featuredB !== featuredA) return featuredB - featuredA;
    const likesA = a.likeCount ?? 0;
    const likesB = b.likeCount ?? 0;
    if (likesB !== likesA) return likesB - likesA;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
