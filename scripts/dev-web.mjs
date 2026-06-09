#!/usr/bin/env node
/**
 * Web 管理端 dev：使用 Vite server.open 自启动浏览器
 * 禁用：DOUXING_NO_OPEN=1
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pmFilterCmd } from './pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const child = spawn(pmFilterCmd('@douxing/web', 'dev'), {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
