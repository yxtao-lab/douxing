#!/usr/bin/env node
/**
 * 按平台选择性启动开发服务
 * 用法:
 *   pnpm dev:only server,web
 *   pnpm dev:only app-android
 *   node scripts/run-dev.mjs server mobile
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { concurrently } from 'concurrently';
import { PLATFORMS, resolvePlatformList, listPlatformHelp } from './platforms.mjs';
import { getRunHint } from './pm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PREFIX_COLORS = ['blue', 'green', 'magenta', 'yellow', 'cyan', 'red'];

function parseArgs(argv) {
  const platforms = [];
  let withServer = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--with-server') withServer = true;
    else platforms.push(arg);
  }
  return { platforms, withServer };
}

function main() {
  const { help, platforms: raw, withServer } = parseArgs(process.argv.slice(2));
  if (help || raw.length === 0) {
    console.log(`用法: ${getRunHint('dev:only')} <平台1>[,<平台2>...]`);
    console.log('      node scripts/run-dev.mjs server web mobile\n');
    console.log(listPlatformHelp());
    process.exit(help ? 0 : 1);
  }

  let ids = resolvePlatformList(raw);
  if (withServer && !ids.includes('server')) {
    ids = ['server', ...ids];
  }

  const needsApi = ids.some((id) => id !== 'server');
  if (needsApi && !ids.includes('server')) {
    ids = ['server', ...ids];
    console.log('[dev] 已自动加入 server（前端/原生依赖 API）');
  }

  const names = [];
  const commands = [];

  for (const id of ids) {
    const p = PLATFORMS[id];
    if (!p?.dev) continue;
    names.push(id);
    commands.push(p.dev.shell);
  }

  if (commands.length === 0) {
    console.error('没有可启动的开发服务');
    process.exit(1);
  }

  if (commands.length === 1) {
    const id = names[0];
    const platform = PLATFORMS[id];
    console.log(`[dev] 启动: ${platform.label}`);
    const child = spawn(platform.dev.shell, { cwd: root, stdio: 'inherit', shell: true });
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }

  console.log(`[dev] 并行启动: ${names.join(', ')}`);
  const { result } = concurrently(
    names.map((id) => ({
      command: PLATFORMS[id].dev.shell,
      name: id,
      cwd: root,
    })),
    {
      prefix: 'name',
      killOthersOn: ['success', 'failure'],
      prefixColors: names.map((_, i) => PREFIX_COLORS[i % PREFIX_COLORS.length]),
    },
  );

  result.then(
    () => process.exit(0),
    () => process.exit(1),
  );
}

main();
