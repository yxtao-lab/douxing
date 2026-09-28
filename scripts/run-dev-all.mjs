#!/usr/bin/env node
/**
 * 并行启动全部开发服务（API + AI + Web + PC + H5 + 小程序 + Android App）
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { concurrently } from 'concurrently';
import killPort from 'kill-port';
import { listDevPortsToFree } from './dev-ports.mjs';
import { pmRunCmd } from './pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 启动前释放常用 dev 端口，避免上次未 stop 导致 EADDRINUSE。
 *
 * @returns Promise<void>
 */
async function freeDevPortsBeforeStart() {
  for (const port of listDevPortsToFree()) {
    try {
      await killPort(port, 'tcp');
    } catch {
      /* 端口空闲时忽略 */
    }
  }
}

const SERVICES = [
  { name: 'api', shell: pmRunCmd('dev:server'), color: 'blue' },
  { name: 'ai', shell: pmRunCmd('dev:ai-service'), color: 'cyan' },
  { name: 'web', shell: pmRunCmd('dev:web'), color: 'green' },
  { name: 'pc', shell: pmRunCmd('dev:pc'), color: 'brightMagenta' },
  { name: 'mobile', shell: pmRunCmd('dev:mobile'), color: 'magenta' },
  { name: 'mp', shell: pmRunCmd('dev:mp-weixin'), color: 'yellow' },
  { name: 'app', shell: pmRunCmd('dev:app-android'), color: 'gray' },
];

console.log(`[dev] 并行启动: ${SERVICES.map((s) => s.name).join(', ')}`);
console.log('[dev] 全量模式将自动打开：Web 管理端 + PC + 微信开发者工具（可用 DOUXING_OPEN_TARGETS 覆盖）');

await freeDevPortsBeforeStart();

const { result } = concurrently(
  SERVICES.map(({ name, shell, color }) => ({
    command: shell,
    name,
    cwd: root,
    prefixColor: color,
    env: {
      ...process.env,
      DOUXING_DEV_ALL: '1',
      // 全量并行：管理端 + PC + 小程序；H5/App 不弹浏览器
      DOUXING_OPEN_TARGETS:
        process.env.DOUXING_OPEN_TARGETS?.trim() || 'web,pc,mp-weixin',
    },
  })),
  {
    prefix: 'name',
    killOthersOn: ['success', 'failure'],
  },
);

result.then(
  () => process.exit(0),
  () => process.exit(1),
);
