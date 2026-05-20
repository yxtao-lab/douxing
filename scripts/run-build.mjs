#!/usr/bin/env node
/**
 * 按平台选择性构建
 * 用法: pnpm build:only web,mobile
 *       pnpm build:app-all  (等价 app-android + app-ios)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLATFORMS,
  NATIVE_DEPLOY_TARGETS,
  resolvePlatformList,
  listPlatformHelp,
} from './platforms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function runPlatformBuild(id) {
  const p = PLATFORMS[id];
  if (!p?.build) throw new Error(`${id} 不支持构建`);
  console.log(`\n[build] ${p.label} (${id})`);
  const src = p.output ? resolve(root, p.output) : null;
  const result = spawnSync(p.build.shell, { cwd: root, stdio: 'inherit', shell: true });
  const artifactReady = src && existsSync(src);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !artifactReady) {
    throw new Error(`${p.label} 构建失败，退出码 ${result.status ?? 'unknown'}`);
  }
  if (result.status !== 0 && artifactReady) {
    console.warn(`[build] 命令退出码 ${result.status}，产物已生成，继续后续步骤`);
  }
  if (p.output && src && existsSync(src)) {
    console.log(`[build] 产物目录: ${p.output}`);
    if (p.releaseDir) {
      console.log(`[build] HBuilderX 导入: ${p.output}（${p.label}）`);
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.length === 0) {
    console.log('用法: pnpm build:only <平台>[,<平台>...]');
    console.log('      pnpm build:app-all\n');
    console.log(listPlatformHelp());
    process.exit(argv.includes('--help') ? 0 : 1);
  }

  let ids = resolvePlatformList(argv);

  if (argv.some((a) => a === 'app-all' || a.includes('app-all'))) {
    ids = [...new Set([...ids.filter((id) => id !== 'app'), ...NATIVE_DEPLOY_TARGETS])];
  }

  for (const id of ids) {
    runPlatformBuild(id);
  }

  console.log('\n[build] 全部完成');
  process.exit(0);
}

main();
