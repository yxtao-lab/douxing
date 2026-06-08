#!/usr/bin/env node
/**
 * 查看当前环境配置与切换说明
 * 用法: pnpm env:status
 */
import { loadEnv } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot } from './lib/load-root-env.mjs';

const FRONTEND_MODES = [
  { id: 'development', label: '本地开发', command: 'pnpm dev' },
  { id: 'staging', label: '测试打包', command: 'pnpm build:mp-weixin:staging' },
  { id: 'production', label: '生产打包', command: 'pnpm build:mp-weixin' },
];

const ENV_FILES = [
  { path: '.env', role: '后端运行时（数据库/JWT/密钥），勿写 VITE_*' },
  { path: '.env.example', role: '后端模板，首次 cp .env.example .env' },
  { path: '.env.local', role: '本机专用（API 局域网 IP、微信 CLI），gitignore' },
  { path: '.env.development', role: 'dev 共享前端配置（H5 地址等）' },
  { path: '.env.staging', role: '测试包前端 API' },
  { path: '.env.production', role: '生产包前端 API' },
];

function readCompiledMpDevApi() {
  const file = resolve(projectRoot, 'packages/mobile/dist/dev/mp-weixin/utils/api-base.js');
  if (!existsSync(file)) return null;
  const match = readFileSync(file, 'utf8').match(/const fromEnv = "([^"]+)"/);
  return match?.[1] ?? null;
}

function resolveDevApiUrl() {
  const env = loadEnv('development', projectRoot, 'VITE_');
  return env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api（默认）';
}

function isOnlineApi(url) {
  return /yxtao\.site/i.test(url);
}

console.log('========================================');
console.log('  兜行 · 环境配置');
console.log('========================================\n');

console.log('【最简单切换】按你要做的事选命令，无需改文件：\n');
for (const item of FRONTEND_MODES) {
  console.log(`  ${item.label.padEnd(8)} → ${item.command}`);
}
console.log('\n  本机 API 地址 → 编辑 .env.local 中的 VITE_API_BASE_URL，改后重启 pnpm dev\n');

console.log('【前端 API 地址】\n');
for (const { id, label } of FRONTEND_MODES) {
  const env = loadEnv(id, projectRoot, 'VITE_');
  const api = env.VITE_API_BASE_URL?.trim() || (id === 'development' ? resolveDevApiUrl() : '（未配置）');
  const tag = isOnlineApi(api) && id === 'development' ? ' ← 开发环境不应指向线上' : '';
  console.log(`  ${label} (${id}): ${api}${tag}`);
}

const compiled = readCompiledMpDevApi();
const expectedDev = resolveDevApiUrl().replace(/（默认）$/, '');
console.log('\n【小程序 dev 编译产物】');
if (!compiled) {
  console.log('  （尚未编译，执行 pnpm dev:mp-weixin）');
} else {
  console.log(`  ${compiled}`);
  const normalizedExpected = expectedDev.replace(/（默认）$/, '');
  if (compiled !== normalizedExpected && !compiled.includes(normalizedExpected.replace('/api', ''))) {
    console.log('  ⚠ 与当前配置不一致，请 Ctrl+C 后重新 pnpm dev');
  }
}

console.log('\n【配置文件】\n');
for (const { path, role } of ENV_FILES) {
  const exists = existsSync(resolve(projectRoot, path));
  console.log(`  ${exists ? '✓' : '·'} ${path.padEnd(22)} ${role}`);
}

const legacyLocal = resolve(projectRoot, '.env.development.local');
if (existsSync(legacyLocal)) {
  console.log('\n  ⚠ 发现已废弃的 .env.development.local，请合并到 .env.local 后删除');
}

console.log('');
