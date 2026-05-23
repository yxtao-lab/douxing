/**
 * PM2 进程配置（生产环境）
 * 用法（项目根目录）：
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const aiEnabled = process.env.AI_SERVICE_ENABLED === 'true';

/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: 'douxing-api',
    cwd: root,
    script: 'packages/server/dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: path.join(root, 'logs/pm2-api-error.log'),
    out_file: path.join(root, 'logs/pm2-api-out.log'),
    merge_logs: true,
    time: true,
  },
];

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
