#!/usr/bin/env node
/**
 * 兜行一键部署脚本
 * 用法: pnpm bootstrap [--skip-docker] [--skip-build] [--dev]
 * 注意: 勿使用 pnpm deploy / pnpm setup，会与 pnpm 内置命令冲突
 */
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pmInstallCmd,
  pmFilterExecCmd,
  pmRunCmd,
  pmSpawnDev,
  getRunHint,
  detectPm,
} from './pm.mjs';

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
    // 与 dotenv 一致：后出现的同名键覆盖前面的
    process.env[key] = value;
  }
}

loadEnvFile();

const args = process.argv.slice(2);
const skipDocker = args.includes('--skip-docker');
const skipBuild = args.includes('--skip-build');
const devMode = args.includes('--dev');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForMysql(maxAttempts = 30) {
  const password = process.env.MYSQL_ROOT_PASSWORD || 'root123456';
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      execSync(
        `docker exec douxing-mysql mysqladmin ping -h localhost -u root -p${password}`,
        { stdio: 'pipe', cwd: root },
      );
      console.log('[deploy] MySQL container is ready');
      return;
    } catch {
      console.log(`[deploy] Waiting for MySQL... (${i}/${maxAttempts})`);
      await sleep(2000);
    }
  }
  throw new Error('MySQL did not become ready in time');
}

async function main() {
  console.log('========================================');
  console.log('  兜行 (Douxing) 一键部署');
  console.log('========================================');

  const envPath = resolve(root, '.env');
  const envExample = resolve(root, '.env.example');
  if (!existsSync(envPath) && existsSync(envExample)) {
    copyFileSync(envExample, envPath);
    console.log('[deploy] Created .env from .env.example');
  }

  if (!skipDocker) {
    const mysqlImage =
      process.env.MYSQL_IMAGE || 'docker.m.daocloud.io/library/mysql:8.0';
    console.log(`[deploy] MySQL image: ${mysqlImage}`);
    try {
      run('docker compose up -d mysql');
      await waitForMysql();
    } catch {
      console.error('\n[deploy] Docker 拉取/启动 MySQL 失败，常见原因：无法访问 Docker Hub。');
      console.error('  方案 1: 在 .env 中设置国内镜像（已写入 .env.example）：');
      console.error('         MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0');
      console.error('  方案 2: 本机已安装 MySQL 时跳过 Docker：');
      console.error('         pnpm bootstrap --skip-docker');
      console.error('  方案 3: 配置 Docker Desktop 镜像加速器后重试');
      console.error('  方案 4: 3306 被占用时，本机已有 MySQL → pnpm bootstrap --skip-docker');
      console.error('         或用 Docker 时设置 DOCKER_MYSQL_HOST_PORT=3307\n');
      process.exit(1);
    }
  } else {
    console.log('[deploy] Skipped Docker (--skip-docker)');
  }

  run(pmInstallCmd());

  if (!skipDocker && process.env.DATABASE_URL) {
    console.log('\n[deploy] Waiting for host port from DATABASE_URL...');
    run(pmFilterExecCmd('@douxing/server', 'tsx', ['src/db/wait-only.ts']));
  }

  console.log('\n[deploy] Running database migrations and seed...');
  run(pmRunCmd('db:setup'));

  if (!skipBuild && !devMode) {
    run(pmRunCmd('build'));
    console.log('\n[deploy] Build completed. Start production server with:');
    console.log(`  ${detectPm() === 'pnpm' ? 'pnpm --filter @douxing/server start' : 'npm run start -w @douxing/server'}`);
    console.log('\n[deploy] 微信小程序产物: packages/mobile/dist/build/mp-weixin');
    console.log('  用微信开发者工具导入该目录后上传发布');
  }

  if (devMode) {
    console.log('\n[deploy] Starting development servers...');
    const child = pmSpawnDev('dev');
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }

  console.log('\n========================================');
  console.log('  部署完成（仅构建，服务未启动）');
  console.log('========================================');
  console.log('  请在新终端执行以下命令启动访问：');
  console.log('');
  console.log(`    ${getRunHint('dev')}          # API + 管理端 + H5 + 微信小程序 + Android App 编译监听`);
  console.log('');
  console.log('  或一键部署并启动：');
  console.log(`    ${getRunHint('bootstrap:dev')}`);
  console.log('');
  console.log('  启动后访问：');
  console.log('    管理端  http://localhost:5173');
  console.log('    移动端 H5  http://localhost:5174');
  console.log('    后端    http://localhost:3000');
  console.log('    微信小程序  微信开发者工具导入:');
  console.log('      packages/mobile/dist/dev/mp-weixin');
  console.log('    （开发阶段关闭「校验合法域名」）');
  console.log('    账号    admin / admin123');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[deploy] Failed:', err.message);
  process.exit(1);
});
