#!/usr/bin/env node
/**
 * 启动外置 Route Solver（packages/or-tools/service）
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serviceDir = join(root, 'packages', 'or-tools', 'service');
const isWin = process.platform === 'win32';
const venvPython = join(
  serviceDir,
  '.venv',
  isWin ? 'Scripts/python.exe' : 'bin/python',
);
const pythonBin = existsSync(venvPython) ? venvPython : isWin ? 'python' : 'python3';
const port = process.env.ROUTE_SOLVER_PORT ?? '8200';

if (!existsSync(venvPython)) {
  console.warn(
    '[route-solver] 未找到 .venv，使用系统 Python。建议：\n' +
      `  cd packages/or-tools/service && ${isWin ? 'py -m venv .venv' : 'python3 -m venv .venv'} && ` +
      `${isWin ? '.venv\\Scripts\\pip' : '.venv/bin/pip'} install -r requirements.txt`,
  );
}

const args = [
  '-m',
  'uvicorn',
  'app.main:app',
  '--reload',
  '--reload-dir',
  'app',
  '--host',
  '127.0.0.1',
  '--port',
  port,
];

console.log(`[route-solver] ${pythonBin} ${args.join(' ')} (cwd=${serviceDir})`);
const child = spawn(pythonBin, args, {
  cwd: serviceDir,
  stdio: 'inherit',
  env: process.env,
  shell: isWin,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
