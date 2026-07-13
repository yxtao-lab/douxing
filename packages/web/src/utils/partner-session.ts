/**
 * 判断重定向路径是否指向商户工作台。
 *
 * @param path - 登录后重定向路径
 * @returns 为 `/partner` 前缀时为 true
 */
export function isPartnerPortalPath(path: string): boolean {
  return path.startsWith('/partner');
}
