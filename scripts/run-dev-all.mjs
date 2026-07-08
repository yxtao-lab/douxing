#!/usr/bin/env node
/**
 * 并行启动全部开发服务（API + AI + Web + PC + H5 + 小程序 + Android App）
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { concurrently } from 'concurrently';
import killPort from 'kill-port';
import { pmRunCmd } from './pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 读取根目录 .env（仅用于 dev 端口）。
 */
function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

/**
 * 启动前释放常用 dev 端口，避免上次未 stop 导致 EADDRINUSE。
 *
 * @returns Promise<void>
 */
async function freeDevPortsBeforeStart() {
  loadEnv();
  const serverPort = Number(process.env.SERVER_PORT) || 3000;
  const ports = [serverPort, 5173, 5174, 5175, 5176, 8100];
  for (const port of ports) {
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

await freeDevPortsBeforeStart();

const { result } = concurrently(
  SERVICES.map(({ name, shell, color }) => ({
    command: shell,
    name,
    cwd: root,
    prefixColor: color,
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
