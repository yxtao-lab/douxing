#!/usr/bin/env node
/**
 * 兜行 · 生产服务器部署脚本（在腾讯云轻量服务器上执行）
 *
 * 用法:
 *   pnpm deploy:server              # 完整部署：Docker + 构建 + 迁移 + PM2
 *   pnpm deploy:server --skip-docker
 *   pnpm deploy:server --skip-build   # 仅重启 PM2（代码已构建）
 *   pnpm deploy:server --nginx DOMAIN=api.example.com
 *   pnpm deploy:server --check        # 检查环境与配置
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

loadEnvFile();

const args = process.argv.slice(2);
const skipDocker = args.includes('--skip-docker');
const skipBuild = args.includes('--skip-build');
const checkOnly = args.includes('--check');
const nginxIdx = args.indexOf('--nginx');
const nginxDomain = nginxIdx !== -1 ? args[nginxIdx + 1] : null;

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', cwd: root });
    return true;
  } catch {
    return false;
  }
}

function getCmdVersion(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForMysql(maxAttempts = 30) {
  const password = process.env.MYSQL_ROOT_PASSWORD;
  if (!password) throw new Error('缺少 MYSQL_ROOT_PASSWORD');
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      execSync(
        `docker exec douxing-mysql mysqladmin ping -h localhost -u root -p${password}`,
        { stdio: 'pipe', cwd: root },
      );
      console.log('[deploy:server] MySQL 已就绪');
      return;
    } catch {
      console.log(`[deploy:server] 等待 MySQL... (${i}/${maxAttempts})`);
      await sleep(2000);
    }
  }
  throw new Error('MySQL 启动超时');
}

function validateProductionEnv() {
  const errors = [];
  const warnings = [];

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'API_PUBLIC_BASE_URL',
    'MYSQL_ROOT_PASSWORD',
    'MYSQL_PASSWORD',
  ];
  for (const key of required) {
    if (!process.env[key]?.trim()) errors.push(`缺少必填项: ${key}`);
  }

  if (process.env.JWT_SECRET === 'change-me-in-production') {
    errors.push('JWT_SECRET 仍为默认值，请改为强随机字符串');
  }
  if (process.env.API_PUBLIC_BASE_URL?.startsWith('http://')) {
    warnings.push('API_PUBLIC_BASE_URL 使用 HTTP，小程序上线须 HTTPS');
  }
  if (process.env.NODE_ENV !== 'production') {
    warnings.push('建议设置 NODE_ENV=production');
  }
  if (process.env.SMS_DEV_EXPOSE_CODE === 'true') {
    warnings.push('生产环境请勿开启 SMS_DEV_EXPOSE_CODE');
  }

  return { errors, warnings };
}

function ensureEnvFile() {
  const envPath = resolve(root, '.env');
  const prodExample = resolve(root, 'deploy/env.production.example');
  if (!existsSync(envPath) && existsSync(prodExample)) {
    copyFileSync(prodExample, envPath);
    console.log('[deploy:server] 已从 deploy/env.production.example 创建 .env，请编辑后重试');
    process.exit(1);
  }
  if (!existsSync(envPath)) {
    console.error('[deploy:server] 未找到 .env，请先复制 deploy/env.production.example');
    process.exit(1);
  }
}

function renderNginxConfig(domain) {
  const templatePath = resolve(root, 'deploy/nginx/douxing-api.conf.template');
  const outPath = resolve(root, 'deploy/nginx/douxing-api.conf');
  const port = process.env.SERVER_PORT || '3000';
  const content = readFileSync(templatePath, 'utf8')
    .replaceAll('__DOMAIN__', domain)
    .replaceAll('__SERVER_PORT__', port);
  writeFileSync(outPath, content, 'utf8');
  console.log(`[deploy:server] 已生成 Nginx 配置: deploy/nginx/douxing-api.conf`);
  console.log('');
  console.log('  OpenCloudOS 9 / RHEL（conf.d）：');
  console.log(`    sudo cp deploy/nginx/douxing-api.conf /etc/nginx/conf.d/douxing-api.conf`);
  console.log(`    sudo certbot --nginx -d ${domain}`);
  console.log(`    sudo nginx -t && sudo systemctl reload nginx`);
  console.log('');
  console.log('  Ubuntu / Debian（sites-available）：');
  console.log(`    sudo cp deploy/nginx/douxing-api.conf /etc/nginx/sites-available/douxing-api`);
  console.log(`    sudo ln -sf /etc/nginx/sites-available/douxing-api /etc/nginx/sites-enabled/`);
  console.log(`    sudo certbot --nginx -d ${domain}`);
  console.log(`    sudo nginx -t && sudo systemctl reload nginx`);
  console.log('');
  console.log('  OpenCloudOS 若 502，执行: sudo setsebool -P httpd_can_network_connect 1');
  console.log('');
}

function checkEnvironment() {
  console.log('========================================');
  console.log('  兜行 · 生产环境检查');
  console.log('========================================\n');

  const tools = [
    ['node', 'node -v'],
    ['pnpm', 'pnpm -v'],
    ['docker', 'docker -v'],
    ['pm2', 'pm2 -v'],
  ];
  for (const [name, cmd] of tools) {
    const ver = getCmdVersion(cmd);
    console.log(ver ? `  ✓ ${name}: ${ver}` : `  ✗ ${name}: 未安装`);
  }

  const nginxVer = getCmdVersion('nginx -v');
  console.log(nginxVer ? `  ✓ nginx: ${nginxVer}` : `  ○ nginx: 未安装（HTTPS 反代需要）`);

  ensureEnvFile();
  loadEnvFile();
  const { errors, warnings } = validateProductionEnv();

  console.log('');
  if (warnings.length) {
    console.log('警告:');
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (errors.length) {
    console.log('\n错误:');
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    process.exit(1);
  }
  console.log('\n环境检查通过。');
}

async function main() {
  if (checkOnly) {
    checkEnvironment();
    return;
  }

  console.log('========================================');
  console.log('  兜行 · 生产服务器部署');
  console.log('========================================');

  ensureEnvFile();
  loadEnvFile();

  const { errors, warnings } = validateProductionEnv();
  if (warnings.length) warnings.forEach((w) => console.warn(`[deploy:server] 警告: ${w}`));
  if (errors.length) {
    errors.forEach((e) => console.error(`[deploy:server] 错误: ${e}`));
    process.exit(1);
  }

  mkdirSync(resolve(root, 'logs'), { recursive: true });

  if (!skipDocker) {
    console.log('\n[deploy:server] 启动生产 Docker（MySQL + Redis）...');
    run('docker compose -f deploy/docker-compose.prod.yml up -d');
    await waitForMysql();
  } else {
    console.log('[deploy:server] 跳过 Docker（--skip-docker）');
  }

  run('pnpm install --frozen-lockfile');

  if (process.env.DATABASE_URL) {
    run('pnpm --filter @douxing/server exec tsx src/db/wait-only.ts');
  }

  if (!skipBuild) {
    run('pnpm build:server');
    console.log('\n[deploy:server] 数据库迁移与种子...');
    run('pnpm db:migrate');
    // 生产环境通常不重复 seed；首次部署可手动 pnpm db:seed
  }

  if (process.env.AI_SERVICE_ENABLED === 'true') {
    const venvDir = resolve(root, 'packages/ai-service/.venv');
    if (!existsSync(venvDir)) {
      console.log('\n[deploy:server] 初始化 Python AI 虚拟环境...');
      run('python3 -m venv packages/ai-service/.venv');
      const pip =
        process.platform === 'win32'
          ? 'packages/ai-service/.venv/Scripts/pip'
          : 'packages/ai-service/.venv/bin/pip';
      run(`${pip} install -r packages/ai-service/requirements.txt`);
    }
  }

  console.log('\n[deploy:server] 启动 / 重载 PM2...');
  if (tryRun('pm2 describe douxing-api')) {
    run('pm2 reload deploy/ecosystem.config.cjs --update-env');
  } else {
    run('pm2 start deploy/ecosystem.config.cjs');
  }
  run('pm2 save');

  if (nginxDomain) {
    renderNginxConfig(nginxDomain);
  }

  const baseUrl = process.env.API_PUBLIC_BASE_URL?.replace(/\/$/, '');
  console.log('\n========================================');
  console.log('  部署完成');
  console.log('========================================');
  console.log(`  健康检查: ${baseUrl}/api/health`);
  console.log(`  PM2 状态: pm2 status`);
  console.log(`  查看日志: pm2 logs douxing-api`);
  if (!nginxDomain) {
    console.log('');
    console.log('  尚未配置 Nginx，请执行：');
    console.log('    pnpm deploy:server --nginx api.你的域名.com');
    console.log('  或参阅 docs/deploy-production.md');
  }
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[deploy:server] 失败:', err.message);
  process.exit(1);
});
