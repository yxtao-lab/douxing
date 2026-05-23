#!/usr/bin/env node
/**
 * 启动 Python AI 微服务（自动优先使用 packages/ai-service/.venv）
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const aiServiceDir = join(root, 'packages', 'ai-service');
const isWin = process.platform === 'win32';
const venvPython = join(
  aiServiceDir,
  '.venv',
  isWin ? 'Scripts/python.exe' : 'bin/python',
);
const pythonBin = existsSync(venvPython) ? venvPython : isWin ? 'python' : 'python3';
const port = process.env.AI_SERVICE_PORT ?? '8100';

if (!existsSync(venvPython)) {
  console.warn(
    '[ai-service] 未找到 .venv，使用系统 Python。建议先执行：\n' +
      `  cd packages/ai-service && ${isWin ? 'py -m venv .venv' : 'python3 -m venv .venv'} && ` +
      `${isWin ? '.venv\\Scripts\\pip' : '.venv/bin/pip'} install -r requirements.txt`,
  );
}

const args = [
  '-m',
  'uvicorn',
  'app.main:app',
  '--reload',
  '--host',
  '127.0.0.1',
  '--port',
  port,
];

console.log(`[ai-service] ${pythonBin} ${args.join(' ')}`);

const child = spawn(pythonBin, args, {
  cwd: aiServiceDir,
  stdio: 'inherit',
  env: process.env,
  shell: isWin,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
