#!/usr/bin/env node
/**
 * 检测微信开发者工具 CLI 路径，并写入 .env.local
 *
 * 用法: pnpm setup:wechat-devtools
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv, projectRoot } from './lib/load-root-env.mjs';
import { findWechatCli } from './lib/wechat-devtools.mjs';

loadRootEnv();

const cli = findWechatCli();
if (!cli) {
  console.error('[setup:wechat-devtools] 未找到微信开发者工具 CLI。');
  console.error('请先安装: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html');
  console.error('安装后在 .env.local 手动设置 WECHAT_DEVTOOLS_CLI=你的 cli.bat 绝对路径');
  process.exit(1);
}

const envLocalPath = resolve(projectRoot, '.env.local');
const key = 'WECHAT_DEVTOOLS_CLI';
const line = `${key}=${cli.replace(/\\/g, '/')}`;

let content = existsSync(envLocalPath) ? readFileSync(envLocalPath, 'utf8') : '';
if (new RegExp(`^${key}=`, 'm').test(content)) {
  content = content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
} else {
  content = `${content.trimEnd()}${content.endsWith('\n') || content.length === 0 ? '' : '\n'}${line}\n`;
}

writeFileSync(envLocalPath, content, 'utf8');
console.log(`[setup:wechat-devtools] 已写入 ${envLocalPath}`);
console.log(`[setup:wechat-devtools] ${line}`);
