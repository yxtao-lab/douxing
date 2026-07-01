/**
 * I3 · Step 37 百炼专属模型（DOUXING_LLM_*）接入验收
 *
 * 用法：
 *   pnpm --filter @douxing/server i3:douxing-llm-cases
 *   pnpm --filter @douxing/server i3:douxing-llm-cases -- --live
 *   pnpm --filter @douxing/server i3:douxing-llm-cases -- --live --provider douxing
 */

await import('../config/env.js');

const args = process.argv.slice(2);
const live = args.includes('--live');
function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}
const providerArg = argValue('--provider', 'auto');

let failed = 0;

function fail(msg: string): void {
  console.error(`[FAIL] ${msg}`);
  failed += 1;
}

function pass(msg: string): void {
  console.log(`[PASS] ${msg}`);
}

console.log('=== I3 · Step 37 百炼专属模型接入验收 ===\n');

const {
  isDouxingLlmEnabled,
  hasDouxingLlmCredentials,
  getDouxingLlmConfig,
  resolveProviderChain,
} = await import('../config/llm.js');

const { listProviderOptions, getAllProvidersStatus } = await import(
  '../services/llm-client.service.js'
);

if (hasDouxingLlmCredentials()) {
  pass('DOUXING_LLM_API_KEY + DOUXING_LLM_MODEL 已配置');
} else {
  fail('未配置 DOUXING_LLM_API_KEY 或 DOUXING_LLM_MODEL（见 deploy/env.production.example）');
}

if (isDouxingLlmEnabled()) {
  pass('DOUXING_LLM 已启用（auto 链将优先调用百炼微调）');
} else if (hasDouxingLlmCredentials()) {
  fail('凭证齐全但 DOUXING_LLM_ENABLED=false');
} else {
  console.log('[WARN] 未启用 DOUXING_LLM，将仅验收配置项与 provider 列表');
}

const cfg = getDouxingLlmConfig();
if (cfg.baseUrl.includes('dashscope.aliyuncs.com')) {
  pass(`Base URL 为百炼兼容模式: ${cfg.baseUrl}`);
} else {
  fail(`Base URL 异常: ${cfg.baseUrl}`);
}

const autoChain = resolveProviderChain('auto');
if (isDouxingLlmEnabled() && autoChain[0] === 'douxing') {
  pass(`auto 降级链: ${autoChain.join(' → ')}`);
} else if (!isDouxingLlmEnabled()) {
  console.log(`[INFO] auto 链（无 DOUXING）: ${autoChain.join(' → ') || '空'}`);
} else {
  fail(`auto 链未以 douxing 开头: ${autoChain.join(' → ')}`);
}

const options = listProviderOptions();
const douxingOpt = options.find((o) => o.id === 'douxing');
if (douxingOpt) {
  pass('listProviderOptions 含 douxing 选项');
  if (isDouxingLlmEnabled() && !douxingOpt.available) {
    fail('douxing 已启用但 options.available=false');
  }
} else {
  fail('listProviderOptions 缺少 douxing');
}

const status = await getAllProvidersStatus();
if (status.providers.some((p) => p.id === 'douxing')) {
  pass('getAllProvidersStatus 含 douxing 探测项');
} else {
  fail('getAllProvidersStatus 缺少 douxing');
}

if (live) {
  if (!isDouxingLlmEnabled() && providerArg === 'douxing') {
    fail('--live --provider douxing 需要 DOUXING_LLM 已启用');
  } else {
    console.log('\n[live] 调用 chatCompletionForRoute…');
    const { chatCompletionForRoute } = await import('../services/llm-client.service.js');
    try {
      const { payload, provider } = await chatCompletionForRoute(
        '上海3天城市漫步，主题摄影，预算2000',
        {
          provider: providerArg as 'auto' | 'douxing' | 'deepseek' | 'lmstudio',
          days: 3,
        },
      );
      pass(`live 生成成功 provider=${provider} name=${payload.name.slice(0, 24)}…`);
    } catch (err) {
      fail(`live 调用失败: ${err instanceof Error ? err.message : err}`);
    }
  }
} else {
  console.log('\n[INFO] 跳过 live 调用；加 --live 可实测百炼 API（消耗 Token）');
}

console.log('');
if (failed > 0) {
  console.error(`I3 验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== I3 验收通过 ===');
console.log('生产 .env 示例：');
console.log('  DOUXING_LLM_MODEL=qwen3-8b-ft-xxxxxxxx');
console.log('  DOUXING_LLM_API_KEY=sk-xxx');
console.log('  LLM_DEFAULT_PROVIDER=auto');
