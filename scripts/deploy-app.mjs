#!/usr/bin/env node
/**
 * iOS / Android App 一键部署（构建原生资源 + 可选后端）
 *
 * 用法:
 *   pnpm deploy:app                    # 构建 Android + iOS 资源
 *   pnpm deploy:app --with-backend     # 含数据库 + API
 *   pnpm deploy:app --platform android
 *   pnpm deploy:app --platform ios
 *   pnpm deploy:app --dev              # 启动 API + 指定原生 dev
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORMS, NATIVE_DEPLOY_TARGETS, resolvePlatformId } from './platforms.mjs';
import { pmInstallCmd, getRunHint } from './pm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

function parseArgs(argv) {
  const opts = {
    withBackend: false,
    skipDocker: false,
    devMode: false,
    platforms: [...NATIVE_DEPLOY_TARGETS],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--with-backend') opts.withBackend = true;
    else if (a === '--skip-docker') opts.skipDocker = true;
    else if (a === '--dev') opts.devMode = true;
    else if (a === '--platform' || a === '-p') {
      const v = argv[++i];
      if (v === 'all') opts.platforms = [...NATIVE_DEPLOY_TARGETS];
      else {
        const id = resolvePlatformId(v);
        if (!id?.startsWith('app')) throw new Error(`无效平台: ${v}`);
        opts.platforms = id === 'app' ? [...NATIVE_DEPLOY_TARGETS] : [id];
      }
    } else if (a.startsWith('--platform=')) {
      const v = a.split('=')[1];
      const id = resolvePlatformId(v);
      opts.platforms = id === 'app' ? [...NATIVE_DEPLOY_TARGETS] : [id];
    }
  }
  return opts;
}

function printNativeGuide(platforms) {
  const api = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api';
  console.log('\n========================================');
  console.log('  原生 App 部署说明');
  console.log('========================================');
  console.log('\n1. CLI 已生成 App 资源（需 HBuilderX 云打包或离线打包）');
  console.log('   主目录: packages/mobile/dist/build/app');
  console.log('   Android / iOS 共用同一 App 资源，云打包时分别选择平台即可');
  console.log('\n2. 使用 HBuilderX（推荐）');
  console.log('   - 导入: packages/mobile/dist/build/app');
  console.log('   - 发行 → 原生 App-云打包 → 选 Android / iOS');
  console.log('   - 真机调试: 运行 → 运行到手机或模拟器');
  console.log('\n3. API 地址（打包前在 .env 配置生产地址）');
  console.log(`   当前 VITE_API_BASE_URL=${api}`);
  console.log('   真机不能使用 localhost，请改为局域网 IP 或 HTTPS 域名');
  console.log('\n4. 单独开发某一端');
  console.log(`   ${getRunHint('dev:only')} app-android   # Android`);
  console.log(`   ${getRunHint('dev:only')} app-ios       # iOS（需 macOS + Xcode）`);
  console.log(`   ${getRunHint('dev:only')} server,app-android`);
  console.log('========================================\n');
}

async function main() {
  loadEnvFile();
  const opts = parseArgs(process.argv.slice(2));

  console.log('========================================');
  console.log('  兜行 · 原生 App 一键部署');
  console.log('  目标:', opts.platforms.map((id) => PLATFORMS[id].label).join(' + '));
  console.log('========================================');

  const envExample = resolve(root, '.env.example');
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath) && existsSync(envExample)) {
    copyFileSync(envExample, envPath);
    console.log('[deploy:app] 已从 .env.example 创建 .env');
  }

  if (opts.withBackend) {
    const deployArgs = ['node', 'scripts/deploy.mjs', '--skip-build'];
    if (opts.skipDocker) deployArgs.push('--skip-docker');
    console.log('\n[deploy:app] 初始化后端与数据库...');
    execSync(deployArgs.join(' '), { cwd: root, stdio: 'inherit' });
  }

  run(pmInstallCmd());

  const buildTargets = opts.platforms.join(',');
  run(`node scripts/run-build.mjs ${buildTargets}`);

  const summaryPath = resolve(root, 'packages/mobile/dist/release/deploy-summary.json');
  mkdirSync(resolve(root, 'packages/mobile/dist/release'), { recursive: true });
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        deployedAt: new Date().toISOString(),
        platforms: opts.platforms,
        appResource: 'packages/mobile/dist/build/app',
        apiBaseUrl: process.env.VITE_API_BASE_URL,
      },
      null,
      2,
    ),
    'utf8',
  );

  printNativeGuide(opts.platforms);

  if (opts.devMode) {
    const devTargets = ['server', ...opts.platforms];
    console.log('[deploy:app] 开发模式启动:', devTargets.join(', '));
    const child = spawn('node', ['scripts/run-dev.mjs', ...devTargets], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }
}

main().catch((err) => {
  console.error('[deploy:app] 失败:', err.message);
  process.exit(1);
});
