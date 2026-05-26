/**
 * 在 vue-i18n 消息编译器不可用（如部分 UniApp 构建目标）时，
 * 对 `{key}` 占位符做兜底替换。
 */
export function formatMessage(
  template: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  if (!params) return template;
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    const replacement = value == null ? '' : String(value);
    result = result.split(`{${key}}`).join(replacement);
  }
  return result;
}
