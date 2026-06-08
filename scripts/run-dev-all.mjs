#!/usr/bin/env node
/**
 * 并行启动全部开发服务（API + AI + Web + H5 + 小程序 + Android App）
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { concurrently } from 'concurrently';
import { pmRunCmd } from './pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  { name: 'api', shell: pmRunCmd('dev:server'), color: 'blue' },
  { name: 'ai', shell: pmRunCmd('dev:ai-service'), color: 'cyan' },
  { name: 'web', shell: pmRunCmd('dev:web'), color: 'green' },
  { name: 'mobile', shell: pmRunCmd('dev:mobile'), color: 'magenta' },
  { name: 'mp', shell: pmRunCmd('dev:mp-weixin'), color: 'yellow' },
  { name: 'app', shell: pmRunCmd('dev:app-android'), color: 'gray' },
];

console.log(`[dev] 并行启动: ${SERVICES.map((s) => s.name).join(', ')}`);

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
