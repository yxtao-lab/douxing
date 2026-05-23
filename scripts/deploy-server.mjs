#!/usr/bin/env node
/**
 * 兜行 · 生产服务器部署脚本（在腾讯云轻量服务器上执行）
 *
 * 用法:
 *   pnpm deploy:server              # 完整部署：Docker + 构建 + 迁移 + PM2
 *   pnpm deploy:server --skip-docker
 *   pnpm deploy:server --skip-build   # 仅重启 PM2（代码已构建）
 *   pnpm deploy:server --nginx DOMAIN=api.example.com
 *   pnpm deploy:server --nginx api.yxtao.site --skip-docker --skip-build
 *   pnpm deploy:server --nginx-only api.yxtao.site   # 仅生成 Nginx 配置
 *   pnpm deploy:server --use-tsx       # 低内存：跳过 server tsc
 *   pnpm deploy:server --force-build   # 强制 tsc（2G 机可能卡住）
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
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
const useTsxFlag = args.includes('--use-tsx');
const forceBuild = args.includes('--force-build');
const nginxOnly = args.includes('--nginx-only');
const checkOnly = args.includes('--check');
const nginxIdx = args.indexOf('--nginx');
const nginxOnlyIdx = args.indexOf('--nginx-only');
const nginxDomain =
  nginxIdx !== -1
    ? args[nginxIdx + 1]
    : nginxOnlyIdx !== -1
      ? args[nginxOnlyIdx + 1]
      : null;
const sslCertIdx = args.indexOf('--ssl-cert');
const sslCertPath = sslCertIdx !== -1 ? args[sslCertIdx + 1] : null;
const sslKeyIdx = args.indexOf('--ssl-key');
const sslKeyPath = sslKeyIdx !== -1 ? args[sslKeyIdx + 1] : null;

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

/** 返回可用的 compose 命令前缀：docker compose 或 docker-compose */
function resolveDockerComposePrefix() {
  if (tryRun('docker compose version')) return 'docker compose';
  if (tryRun('docker-compose version')) return 'docker-compose';
  return null;
}

function ensureDockerReady() {
  const dockerVer = getCmdVersion('docker -v');
  if (!dockerVer) {
    throw new Error(
      '未检测到 Docker。请先执行: sudo bash scripts/setup-opencloudos9.sh',
    );
  }

  if (!tryRun('docker info')) {
    throw new Error(
      'Docker 守护进程未运行。请执行: sudo systemctl enable --now docker',
    );
  }

  const composePrefix = resolveDockerComposePrefix();
  if (!composePrefix) {
    throw new Error(
      [
        '未检测到 docker compose 插件（OpenCloudOS 常见）。请任选一种方式安装：',
        '',
        '  sudo dnf install -y docker-compose-plugin',
        '  sudo systemctl restart docker',
        '',
        '或手动安装插件：',
        '  sudo mkdir -p /usr/libexec/docker/cli-plugins',
        '  sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \\',
        '    -o /usr/libexec/docker/cli-plugins/docker-compose',
        '  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose',
        '',
        '验证: docker compose version',
      ].join('\n'),
    );
  }

  console.log(`[deploy:server] Docker: ${dockerVer}`);
  console.log(`[deploy:server] Compose: ${getCmdVersion(`${composePrefix} version`)}`);
  return composePrefix;
}

/** 优先使用项目内 pm2（pnpm install 后可用），其次全局 pm2 */
function resolvePm2Prefix() {
  if (tryRun('pnpm exec pm2 -v')) return 'pnpm exec pm2';
  if (tryRun('pm2 -v')) return 'pm2';
  if (tryRun('npx pm2 -v')) return 'npx pm2';
  return null;
}

function ensurePm2Ready() {
  const pm2Prefix = resolvePm2Prefix();
  if (!pm2Prefix) {
    throw new Error(
      [
        '未检测到 PM2。部署脚本会在 pnpm install 后自动使用项目内 pm2；',
        '若仍失败，请执行: pnpm install && pnpm deploy:server --skip-docker --skip-build',
        '或全局安装: npm install -g pm2（已是 root 勿加 sudo；sudo 会找不到 npm）',
      ].join('\n'),
    );
  }
  console.log(`[deploy:server] PM2: ${getCmdVersion(`${pm2Prefix} -v`)} (${pm2Prefix})`);
  return pm2Prefix;
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

/** 2G/4G 轻量机 tsc 易卡死，自动走 tsx */
function resolveUseTsx() {
  if (forceBuild) return false;
  if (useTsxFlag) return true;
  if (process.env.SERVER_RUNTIME === 'tsx') return true;
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  if (totalMb > 0 && totalMb <= 4096) {
    console.log(
      `[deploy:server] 检测到内存约 ${totalMb}MB，自动启用 tsx 模式（跳过 server tsc，避免卡住）`,
    );
    console.log('[deploy:server] 若必须编译 dist：加 --force-build（可能很慢）');
    return true;
  }
  return false;
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

function renderNginxConfig(domain, sslCert, sslKey) {
  const useSsl = Boolean(sslCert && sslKey);
  const templatePath = resolve(
    root,
    useSsl ? 'deploy/nginx/douxing-api.ssl.conf.template' : 'deploy/nginx/douxing-api.conf.template',
  );
  const outPath = resolve(root, 'deploy/nginx/douxing-api.conf');
  const port = process.env.SERVER_PORT || '3000';
  let content = readFileSync(templatePath, 'utf8')
    .replaceAll('__DOMAIN__', domain)
    .replaceAll('__SERVER_PORT__', port);
  if (useSsl) {
    content = content.replaceAll('__SSL_CERT__', sslCert).replaceAll('__SSL_KEY__', sslKey);
  }
  writeFileSync(outPath, content, 'utf8');
  console.log(
    `[deploy:server] 已生成 Nginx 配置 (${useSsl ? 'HTTPS 已有证书' : 'HTTP，待 Certbot'}): deploy/nginx/douxing-api.conf`,
  );
  console.log('');
  console.log('  Debian 12 / Ubuntu（sites-available，推荐）：');
  console.log(`    sudo cp deploy/nginx/douxing-api.conf /etc/nginx/sites-available/douxing-api`);
  console.log(`    sudo ln -sf /etc/nginx/sites-available/douxing-api /etc/nginx/sites-enabled/`);
  console.log(`    sudo rm -f /etc/nginx/sites-enabled/default`);
  if (useSsl) {
    console.log(`    sudo nginx -t && sudo systemctl reload nginx`);
    console.log(`    curl https://${domain}/api/health`);
  } else {
    console.log(`    sudo certbot --nginx -d ${domain}`);
    console.log(`    sudo nginx -t && sudo systemctl reload nginx`);
  }
  console.log('');
  console.log('  OpenCloudOS / RHEL：');
  console.log(`    sudo bash scripts/install-nginx-conf.sh ${domain}`);
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
  ];
  for (const [name, cmd] of tools) {
    const ver = getCmdVersion(cmd);
    console.log(ver ? `  ✓ ${name}: ${ver}` : `  ✗ ${name}: 未安装`);
  }

  const pm2Prefix = resolvePm2Prefix();
  console.log(
    pm2Prefix
      ? `  ✓ pm2: ${getCmdVersion(`${pm2Prefix} -v`)} (${pm2Prefix})`
      : `  ✗ pm2: 未安装（pnpm install 后可用，或 npm i -g pm2）`,
  );

  const composePrefix = resolveDockerComposePrefix();
  console.log(
    composePrefix
      ? `  ✓ compose: ${getCmdVersion(`${composePrefix} version`)}`
      : `  ✗ compose: 未安装（需 docker-compose-plugin）`,
  );

  if (tryRun('docker info')) {
    console.log('  ✓ docker daemon: 运行中');
  } else if (getCmdVersion('docker -v')) {
    console.log('  ✗ docker daemon: 未运行（systemctl start docker）');
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

  if (nginxOnly) {
    if (!nginxDomain || nginxDomain.startsWith('-')) {
      console.error('[deploy:server] 用法: pnpm deploy:server --nginx-only api.yxtao.site');
      process.exit(1);
    }
    ensureEnvFile();
    loadEnvFile();
    renderNginxConfig(nginxDomain, sslCertPath, sslKeyPath);
    return;
  }

  const useTsx = resolveUseTsx();

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
    const composePrefix = ensureDockerReady();
    console.log('\n[deploy:server] 启动生产 Docker（MySQL + Redis）...');
    run(`${composePrefix} -f deploy/docker-compose.prod.yml up -d`);
    await waitForMysql();
  } else {
    console.log('[deploy:server] 跳过 Docker（--skip-docker）');
  }

  run('pnpm install --frozen-lockfile');

  if (process.env.DATABASE_URL) {
    run('pnpm --filter @douxing/server exec tsx src/db/wait-only.ts');
  }

  if (!skipBuild) {
    if (useTsx) {
      console.log('\n[deploy:server] 低内存模式（--use-tsx）：只构建 shared，server 由 tsx 直跑');
      run('pnpm --filter @douxing/shared build');
      process.env.SERVER_RUNTIME = 'tsx';
    } else {
      run('pnpm build:server', {
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1024' },
      });
    }
    console.log('\n[deploy:server] 数据库迁移...');
    run('pnpm db:migrate');
  } else if (useTsx) {
    process.env.SERVER_RUNTIME = 'tsx';
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
  const pm2 = ensurePm2Ready();
  if (tryRun(`${pm2} describe douxing-api`)) {
    run(`${pm2} reload deploy/ecosystem.config.cjs --update-env`);
  } else {
    run(`${pm2} start deploy/ecosystem.config.cjs`);
  }
  run(`${pm2} save`);

  const serverPort = process.env.SERVER_PORT || '3000';
  console.log('\n[deploy:server] 等待 API 就绪...');
  await sleep(2000);
  let localOk = false;
  for (let i = 1; i <= 10; i++) {
    if (tryRun(`curl -sf http://127.0.0.1:${serverPort}/api/health`)) {
      localOk = true;
      console.log(`[deploy:server] 本机 API 正常: http://127.0.0.1:${serverPort}/api/health`);
      break;
    }
    console.log(`[deploy:server] 等待 API... (${i}/10)`);
    await sleep(1500);
  }
  if (!localOk) {
    console.error('\n[deploy:server] 警告: 本机 API 未响应，请执行:');
    console.error(`  bash scripts/diagnose-server.sh`);
    console.error(`  ${pm2} logs douxing-api --lines 50`);
  }

  if (nginxDomain) {
    if ((sslCertPath && !sslKeyPath) || (!sslCertPath && sslKeyPath)) {
      console.error('[deploy:server] --ssl-cert 与 --ssl-key 需同时指定');
      process.exit(1);
    }
    renderNginxConfig(nginxDomain, sslCertPath, sslKeyPath);
  }

  const baseUrl = process.env.API_PUBLIC_BASE_URL?.replace(/\/$/, '');
  console.log('\n========================================');
  console.log('  部署完成');
  console.log('========================================');
  console.log(`  健康检查: ${baseUrl}/api/health`);
  console.log(`  PM2 状态: ${pm2} status`);
  console.log(`  查看日志: ${pm2} logs douxing-api`);
  if (!nginxDomain) {
    console.log('');
    console.log('  尚未配置 Nginx，请执行：');
    console.log('    pnpm deploy:server --nginx-only api.你的域名.com');
    console.log('    或: pnpm deploy:server --nginx api.你的域名.com --skip-docker --skip-build');
    console.log('  参阅 docs/启动与部署流程.md');
  }
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[deploy:server] 失败:', err.message);
  process.exit(1);
});
