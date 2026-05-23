/**
 * PM2 进程配置（生产环境）
 *
 * 默认：node packages/server/dist/index.js（需 pnpm build:server）
 * 低内存机器：SERVER_RUNTIME=tsx 或 dist 不存在时自动用 tsx 直跑源码（免 tsc）
 *
 *   SERVER_RUNTIME=tsx pm2 start deploy/ecosystem.config.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

/** 读取根目录 .env，注入 PM2，避免 reload 残留旧 DATABASE_URL */
function loadEnvFile() {
  const envPath = path.join(root, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile();
const aiEnabled = (fileEnv.AI_SERVICE_ENABLED || process.env.AI_SERVICE_ENABLED) === 'true';
const serverDist = path.join(root, 'packages/server/dist/index.js');
const useTsx = process.env.SERVER_RUNTIME === 'tsx' || !fs.existsSync(serverDist);

function findTsxCli() {
  const candidates = [
    path.join(root, 'node_modules/tsx/dist/cli.mjs'),
    path.join(root, 'packages/server/node_modules/tsx/dist/cli.mjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'tsx';
}

/** @type {import('pm2').StartOptions} */
const apiApp = useTsx
  ? {
      name: 'douxing-api',
      cwd: root,
      script: findTsxCli(),
      args: 'packages/server/src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      env: { ...fileEnv, NODE_ENV: 'production', SERVER_RUNTIME: 'tsx' },
      error_file: path.join(root, 'logs/pm2-api-error.log'),
      out_file: path.join(root, 'logs/pm2-api-out.log'),
      merge_logs: true,
      time: true,
    }
  : {
      name: 'douxing-api',
      cwd: root,
      script: 'packages/server/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { ...fileEnv, NODE_ENV: 'production' },
      error_file: path.join(root, 'logs/pm2-api-error.log'),
      out_file: path.join(root, 'logs/pm2-api-out.log'),
      merge_logs: true,
      time: true,
    };

/** @type {import('pm2').StartOptions[]} */
const apps = [apiApp];

if (aiEnabled) {
  const venvPython =
    process.platform === 'win32'
      ? path.join(root, 'packages/ai-service/.venv/Scripts/python.exe')
      : path.join(root, 'packages/ai-service/.venv/bin/python');

  apps.push({
    name: 'douxing-ai-service',
    cwd: path.join(root, 'packages/ai-service'),
    script: venvPython,
    args: '-m uvicorn app.main:app --host 127.0.0.1 --port 8100',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '768M',
    error_file: path.join(root, 'logs/pm2-ai-error.log'),
    out_file: path.join(root, 'logs/pm2-ai-out.log'),
    merge_logs: true,
    time: true,
  });
}

module.exports = { apps };
