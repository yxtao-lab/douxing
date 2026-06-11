#!/usr/bin/env node
/**
 * 兜行 · Gitee Push Webhook 接收端（方案 C）
 *
 * Gitee 仓库 → 管理 → WebHooks：
 *   URL:    https://api.你的域名/hooks/douxing-deploy
 *   密码:   与 .env 中 WEBHOOK_SECRET 一致（Header: X-Gitee-Token）
 *   事件:   Push
 *
 * 启动: node scripts/gitee-webhook-server.mjs
 * 生产: sudo bash scripts/install-webhook-service.sh
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const HOOK_PATH = '/hooks/douxing-deploy';
const DEFAULT_PORT = 9090;

function loadEnvFile() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

loadEnvFile();

const port = Number(process.env.WEBHOOK_PORT || DEFAULT_PORT);
const secret = process.env.WEBHOOK_SECRET?.trim() || '';
const deployBranches = (process.env.WEBHOOK_DEPLOY_BRANCHES || 'main,master')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const deployScript = resolve(root, 'scripts/gitee-webhook-deploy.sh');
const logDir = process.env.WEBHOOK_DEPLOY_LOG_DIR?.trim() || resolve(root, 'logs');
const logPath = resolve(logDir, 'webhook-deploy.log');

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJson(raw) {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function branchFromRef(ref) {
  const prefix = 'refs/heads/';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) return null;
  return ref.slice(prefix.length);
}

function verifyToken(req) {
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const token = req.headers['x-gitee-token'];
  return typeof token === 'string' && token === secret;
}

function triggerDeploy(meta) {
  if (!existsSync(deployScript)) {
    throw new Error(`发版脚本不存在: ${deployScript}`);
  }
  mkdirSync(logDir, { recursive: true });
  const out = openSync(logPath, 'a');
  const stamp = new Date().toISOString();
  const child = spawn('bash', [deployScript], {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      WEBHOOK_TRIGGERED_AT: stamp,
      WEBHOOK_REF: meta.ref || '',
      WEBHOOK_BRANCH: meta.branch || '',
    },
  });
  child.unref();
  return { logPath, pid: child.pid, triggeredAt: stamp };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'douxing-webhook' });
      return;
    }

    const urlPath = req.url?.split('?')[0] || '';
    if (req.method !== 'POST' || urlPath !== HOOK_PATH) {
      sendJson(res, 404, { ok: false, message: 'not found' });
      return;
    }

    if (!verifyToken(req)) {
      sendJson(res, 401, { ok: false, message: 'invalid webhook token' });
      return;
    }

    const rawBody = await readBody(req);
    const payload = parseJson(rawBody);
    const event = req.headers['x-gitee-event'] || req.headers['x-git-oschina-event'] || '';

    if (event && event !== 'Push Hook') {
      sendJson(res, 200, { ok: true, ignored: true, event });
      return;
    }

    const ref = payload?.ref || '';
    const branch = branchFromRef(ref);
    if (!branch || !deployBranches.includes(branch)) {
      sendJson(res, 200, {
        ok: true,
        ignored: true,
        reason: 'branch not configured for deploy',
        branch,
        deployBranches,
      });
      return;
    }

    const result = triggerDeploy({
      ref,
      branch,
      commits: payload?.commits?.length ?? 0,
    });

    sendJson(res, 202, {
      ok: true,
      message: 'deploy started',
      branch,
      ...result,
    });
  } catch (err) {
    console.error('[webhook-server]', err);
    sendJson(res, 500, { ok: false, message: err instanceof Error ? err.message : 'internal error' });
  }
});

if (!secret && process.env.NODE_ENV === 'production') {
  console.error('[webhook-server] 生产环境必须设置 WEBHOOK_SECRET');
  process.exit(1);
}

server.listen(port, '127.0.0.1', () => {
  console.log(`[webhook-server] 监听 http://127.0.0.1:${port}${HOOK_PATH}`);
  console.log(`[webhook-server] 发版分支: ${deployBranches.join(', ')}`);
  console.log(`[webhook-server] 日志: ${logPath}`);
  if (!secret) {
    console.warn('[webhook-server] 未设置 WEBHOOK_SECRET，仅适合本地调试');
  }
});
