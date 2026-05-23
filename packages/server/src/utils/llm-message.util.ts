/** 路线生成来源文案（Web / 规划会话复用） */

export function buildRouteGenerationMessage(
  generationSource?: 'llm' | 'template',
  llmProvider?: string,
  isFollowUp = false,
): string {
  const prefix = isFollowUp ? '路线已更新' : '路线已生成';
  if (generationSource !== 'llm') {
    return `${prefix}（模板模式）`;
  }
  if (llmProvider === 'ai-service') return `${prefix}（Python AI 服务）`;
  if (llmProvider === 'deepseek') return `${prefix}（DeepSeek）`;
  if (llmProvider === 'lmstudio') return `${prefix}（本地模型）`;
  return `${prefix}（AI）`;
}
