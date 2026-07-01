/**
 * 将 IPv4 映射的 IPv6 地址（如 ::ffff:127.0.0.1）规范为 IPv4 字符串。
 */
export function normalizeIpv4Address(ip: string | null | undefined): string {
  if (ip == null) return '';
  const trimmed = ip.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const ipv4 = trimmed.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ipv4)) return ipv4;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return trimmed;

  const tailMatch = trimmed.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (tailMatch) return tailMatch[1]!;

  return trimmed;
}
