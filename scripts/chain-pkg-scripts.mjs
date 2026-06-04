#!/usr/bin/env node
/**
 * 在当前包目录链式执行多个 npm/pnpm 脚本（供子包 package.json 使用）
 * 用法: node scripts/chain-pkg-scripts.mjs build:h5 build:mp-weixin
 */
import { execSync } from 'node:child_process';
import { pmLocalRunCmd } from './pm.mjs';

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
  console.error('用法: node scripts/chain-pkg-scripts.mjs <script1> [script2...]');
  process.exit(1);
}

for (const script of scripts) {
  const cmd = pmLocalRunCmd(script);
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}
