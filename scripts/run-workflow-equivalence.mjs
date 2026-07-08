#!/usr/bin/env node
/**
 * W1-6 · 运行 legacy vs LangGraph 等价率脚本（自动使用 ai-service/.venv）
 */
import { spawnSync } from 'node:child_process';
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

if (!existsSync(venvPython)) {
  console.error(
    '[workflow-equivalence] 未找到 packages/ai-service/.venv，请先执行：\n' +
      `  cd packages/ai-service && ${isWin ? 'py -m venv .venv' : 'python3 -m venv .venv'}\n` +
      `  ${isWin ? '.venv\\Scripts\\pip' : '.venv/bin/pip'} install -r requirements.txt`,
  );
  process.exit(1);
}

const args = ['-m', 'app.scripts.workflow_equivalence', ...process.argv.slice(2)];
const env = {
  ...process.env,
  WORKFLOW_ENGINE: process.env.WORKFLOW_ENGINE ?? 'langgraph',
};

console.log(`[workflow-equivalence] WORKFLOW_ENGINE=${env.WORKFLOW_ENGINE}`);
console.log(`[workflow-equivalence] ${venvPython} ${args.join(' ')}`);

const result = spawnSync(venvPython, args, {
  cwd: aiServiceDir,
  stdio: 'inherit',
  env,
  shell: false,
});

process.exit(result.status ?? 1);
