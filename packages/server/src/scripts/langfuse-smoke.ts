/**
 * Langfuse 连通性冒烟（Step 11）
 *
 * 用法：配置 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY 后
 *   pnpm --filter @douxing/server langfuse:smoke
 */
import '../config/env.js';
import { getLangfuseClient } from '../observability/langfuse-client.service.js';
import { isLangfuseEnabled } from '../config/langfuse.js';

async function main() {
  if (!isLangfuseEnabled()) {
    console.log('[langfuse:smoke] 未配置 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY，跳过（no-op 模式正常）');
    process.exit(0);
  }

  const lf = getLangfuseClient();
  if (!lf) {
    console.error('[langfuse:smoke] 客户端初始化失败');
    process.exit(1);
  }

  const trace = lf.trace({
    name: 'langfuse-smoke',
    input: { source: '@douxing/server', step: 11 },
    tags: ['smoke', 'c7'],
  });

  trace.generation({
    name: 'smoke-generation',
    model: 'smoke',
    input: 'ping',
    output: 'pong',
    usage: { input: 1, output: 1 },
    metadata: { durationMs: 1 },
  });

  await lf.flushAsync();
  console.log('[langfuse:smoke] 已发送测试 trace，请在 Langfuse UI 查看 langfuse-smoke');
}

main().catch((err) => {
  console.error('[langfuse:smoke] 失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
