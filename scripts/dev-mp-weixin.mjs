#!/usr/bin/env node
/**
 * 微信小程序 dev：首次编译完成后自动打开微信开发者工具
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from './lib/load-root-env.mjs';
import { openWechatProject, printWechatOpenHelp } from './lib/wechat-devtools.mjs';

loadRootEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const mobileRoot = resolve(root, 'packages/mobile');
const mpDevDir = resolve(mobileRoot, 'dist/dev/mp-weixin');
const readyMarker = resolve(mpDevDir, 'project.config.json');

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

const child = spawn('pnpm', ['exec', 'uni', '-p', 'mp-weixin'], {
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
