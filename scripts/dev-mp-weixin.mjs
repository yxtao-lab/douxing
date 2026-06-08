#!/usr/bin/env node
/**
 * 微信小程序 dev：首次编译完成后自动打开微信开发者工具
 */
import { spawn } from 'node:child_process';
import { loadEnv } from 'vite';
import { pmExecCmd } from './pm.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from './lib/load-root-env.mjs';
import { openWechatProject, printWechatOpenHelp } from './lib/wechat-devtools.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const mobileRoot = resolve(root, 'packages/mobile');
const mpDevDir = resolve(mobileRoot, 'dist/dev/mp-weixin');
const readyMarker = resolve(mpDevDir, 'project.config.json');
const apiBaseCompiled = resolve(mpDevDir, 'utils/api-base.js');

loadRootEnv({ mode: 'development' });

/** VITE_* 交给 Vite/Uni 按 mode 加载，避免 process.env 抢占导致误用 .env 中的线上地址 */
for (const key of Object.keys(process.env)) {
  if (key.startsWith('VITE_')) delete process.env[key];
}

const viteEnv = loadEnv('development', root, 'VITE_');
const apiBaseUrl = viteEnv.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api';
console.log(`[mp-weixin] 开发 API: ${apiBaseUrl}`);
console.log(`[mp-weixin] 导入目录: ${mpDevDir}`);
if (/yxtao\.site/i.test(apiBaseUrl)) {
  console.warn(
    '[mp-weixin] 当前 API 指向线上域名。本地开发请编辑 .env.local 的 VITE_API_BASE_URL，勿在 .env 中写 VITE_*，修改后重启 pnpm dev',
  );
}

function readCompiledApiBase() {
  if (!existsSync(apiBaseCompiled)) return null;
  const text = readFileSync(apiBaseCompiled, 'utf8');
  const match = text.match(/const fromEnv = "([^"]+)"/);
  return match?.[1] ?? null;
}

const compiledApi = readCompiledApiBase();
if (compiledApi && compiledApi !== apiBaseUrl) {
  console.warn(
    `[mp-weixin] 编译产物 API（${compiledApi}）与环境不一致，正在重新编译…`,
  );
}

let opening = false;
let opened = false;
let warned = false;

async function tryOpenDevTools(reason) {
  if (opened || opening || process.env.DOUXING_NO_OPEN === '1') return;
  if (!existsSync(readyMarker)) return;

  opening = true;
  try {
    console.log(`[mp-weixin] 编译完成（${reason}），正在打开微信开发者工具…`);
    const result = await openWechatProject(mpDevDir);
    if (result.ok) {
      opened = true;
      console.log(`[mp-weixin] 已打开（${result.method}${result.cli ? `: ${result.cli}` : ''}）`);
      return;
    }
    if (!warned) {
      warned = true;
      printWechatOpenHelp(mpDevDir);
    }
  } finally {
    opening = false;
  }
}

function attachBuildWatcher(stream, label) {
  if (!stream) return;
  let tail = '';
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    process[label].write(chunk);
    if (opened || opening) return;
    tail = (tail + text).slice(-4096);
    if (/ready in \d+ms/i.test(tail) || /Build complete/i.test(tail)) {
      setTimeout(() => tryOpenDevTools(label), 600);
    }
  });
}

const child = spawn(pmExecCmd(['uni', '-p', 'mp-weixin']), {
  cwd: mobileRoot,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: process.env,
});

attachBuildWatcher(child.stdout, 'stdout');
attachBuildWatcher(child.stderr, 'stderr');

// 兜底：避免 stdout 分片导致漏掉编译完成信号
const pollTimer = setInterval(() => {
  if (opened) {
    clearInterval(pollTimer);
    return;
  }
  if (opening) return;
  if (existsSync(readyMarker)) {
    tryOpenDevTools('poll');
  }
}, 2000);

child.on('exit', (code) => {
  clearInterval(pollTimer);
  process.exit(code ?? 0);
});
