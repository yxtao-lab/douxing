import { DEFAULT_LOCALE } from './constants.js';
import type { LocaleCode } from './types.js';

function normalizeLocaleTag(tag: string | undefined | null): LocaleCode {
  if (!tag) return DEFAULT_LOCALE;
  const lower = tag.toLowerCase().replace('_', '-');
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

/** 从 Accept-Language 请求头解析语言（服务端 / 网关使用） */
export function getLocaleFromAcceptLanguage(header: string | undefined | null): LocaleCode {
  if (!header?.trim()) return DEFAULT_LOCALE;

  const parts = header.split(',').map((part) => {
    const [tag, qPart] = part.trim().split(';');
    const q = qPart?.startsWith('q=') ? Number.parseFloat(qPart.slice(2)) : 1;
    return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
  });

  parts.sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    return normalizeLocaleTag(tag);
  }

  return DEFAULT_LOCALE;
}
