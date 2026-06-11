#!/usr/bin/env node
/**
 * 兜行 · 统一发版脚本（服务器或 CI/CD 调用）
 *
 * 用法:
 *   pnpm deploy:release                          # API + PC 静态（默认）
 *   pnpm deploy:release -- --target=pc           # 仅构建并发布 PC 静态
 *   pnpm deploy:release -- --target=server       # 仅后端（等同 deploy:server 精简版）
 *   pnpm deploy:release -- --target=pc,web       # PC + Web 管理端静态
 *   pnpm deploy:release -- --staging             # 使用 staging 构建配置
 *   pnpm deploy:release -- --skip-docker         # 跳过后端 Docker
 *   pnpm deploy:release -- --skip-nginx          # 跳过 Nginx 配置渲染
 *
 * 环境变量（.env）:
 *   STATIC_ROOT          静态资源目录，默认 <项目根>/static
 *   PC_NGINX_DOMAIN      PC 子域，如 pc.yxtao.site
 *   WEB_NGINX_DOMAIN     管理端子域（可选）
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectPm, pmRunCmd } from './pm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const staging = args.includes('--staging');
const skipDocker = args.includes('--skip-docker');
const skipNginx = args.includes('--skip-nginx');
const skipServer = args.includes('--skip-server');

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

function parseTargets() {
  const idx = args.indexOf('--target');
  if (idx === -1) {
    if (skipServer) return ['pc'];
    return ['server', 'pc'];
  }
  const raw = args[idx + 1];
  if (!raw || raw.startsWith('-')) {
    console.error('[deploy:release] 用法: --target=server,pc,web');
    process.exit(1);
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

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

function resolveStaticRoot() {
  return process.env.STATIC_ROOT?.trim() || resolve(root, 'static');
}

function publishStaticDist(sourceDir, destDir, label) {
  if (!existsSync(sourceDir)) {
    throw new Error(`${label} 构建产物不存在: ${sourceDir}`);
  }
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(sourceDir, destDir, { recursive: true });
  console.log(`[deploy:release] ${label} 已发布 → ${destDir}`);
}

function renderNginxFromTemplate(templateName, outName, replacements) {
  const templatePath = resolve(root, `deploy/nginx/${templateName}`);
  const outPath = resolve(root, `deploy/nginx/${outName}`);
  let content = readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
  }
  writeFileSync(outPath, content, 'utf8');
  console.log(`[deploy:release] 已生成 Nginx 配置: deploy/nginx/${outName}`);
  return outPath;
}

function setupPcNginx() {
  const domain = process.env.PC_NGINX_DOMAIN?.trim();
  if (!domain) {
    console.log('[deploy:release] 未设置 PC_NGINX_DOMAIN，跳过 PC Nginx 配置');
    return;
  }
  const staticRoot = resolveStaticRoot();
  const serverPort = process.env.SERVER_PORT || '3000';
  renderNginxFromTemplate('douxing-pc.conf.template', 'douxing-pc.conf', {
    __PC_DOMAIN__: domain,
    __STATIC_ROOT__: staticRoot,
    __SERVER_PORT__: serverPort,
  });
  if (tryRun('nginx -v')) {
    console.log('');
    console.log('  安装 PC Nginx 站点:');
    console.log(`    sudo bash scripts/install-nginx-pc.sh ${domain}`);
    console.log(`    sudo certbot --nginx -d ${domain}`);
  }
}

function setupWebNginx() {
  const domain = process.env.WEB_NGINX_DOMAIN?.trim();
  if (!domain) {
    console.log('[deploy:release] 未设置 WEB_NGINX_DOMAIN，跳过 Web Nginx 配置');
    return;
  }
  const staticRoot = resolveStaticRoot();
  const serverPort = process.env.SERVER_PORT || '3000';
  renderNginxFromTemplate('douxing-web.conf.template', 'douxing-web.conf', {
    __WEB_DOMAIN__: domain,
    __STATIC_ROOT__: staticRoot,
    __SERVER_PORT__: serverPort,
  });
  if (tryRun('nginx -v')) {
    console.log('');
    console.log('  安装 Web 管理端 Nginx 站点:');
    console.log(`    sudo bash scripts/install-nginx-web.sh ${domain}`);
    console.log(`    sudo bash scripts/install-nginx-web.sh ${domain} --certbot`);
  }
}

function deployPcStatic() {
  const buildCmd = staging ? 'build:pc:staging' : 'build:pc';
  console.log('\n[deploy:release] 构建 PC 用户端...');
  run(pmRunCmd(buildCmd));

  const staticRoot = resolveStaticRoot();
  publishStaticDist(resolve(root, 'packages/pc/dist'), resolve(staticRoot, 'pc'), 'PC 用户端');

  if (!skipNginx) {
    setupPcNginx();
  }
}

function deployWebStatic() {
  const buildCmd = staging ? 'build:web:staging' : 'build:web';
  console.log('\n[deploy:release] 构建 Web 管理端...');
  run(pmRunCmd(buildCmd));

  const staticRoot = resolveStaticRoot();
  publishStaticDist(resolve(root, 'packages/web/dist'), resolve(staticRoot, 'web'), 'Web 管理端');

  if (!skipNginx) {
    setupWebNginx();
  }
}

function deployServer() {
  const serverArgs = [];
  if (args.includes('--skip-build')) serverArgs.push('--skip-build');
  if (skipDocker) serverArgs.push('--skip-docker');
  if (skipNginx) serverArgs.push('--skip-nginx');
  run(`node scripts/deploy-server.mjs ${serverArgs.join(' ')}`.trim());
}

async function main() {
  const targets = parseTargets();
  const pm = detectPm();

  console.log('========================================');
  console.log('  兜行 · 统一发版');
  console.log('========================================');
  console.log(`  包管理: ${pm}`);
  console.log(`  目标: ${targets.join(', ')}`);
  console.log(`  环境: ${staging ? 'staging' : 'production'}`);
  console.log(`  静态目录: ${resolveStaticRoot()}`);
  console.log('========================================');

  mkdirSync(resolveStaticRoot(), { recursive: true });

  if (targets.includes('server')) {
    deployServer();
  }

  if (targets.includes('pc')) {
    deployPcStatic();
  }

  if (targets.includes('web')) {
    deployWebStatic();
  }

  console.log('\n========================================');
  console.log('  发版完成');
  console.log('========================================');
  if (targets.includes('pc') && process.env.PC_NGINX_DOMAIN) {
    console.log(`  PC 站点: https://${process.env.PC_NGINX_DOMAIN}`);
  }
  if (targets.includes('web') && process.env.WEB_NGINX_DOMAIN) {
    console.log(`  Web 管理端: https://${process.env.WEB_NGINX_DOMAIN}`);
  }
  if (targets.includes('server')) {
    const apiBase =
      process.env.API_PUBLIC_BASE_URL?.trim() ||
      process.env.API_PUBLIC_BASE_URL_PROD?.trim() ||
      'http://127.0.0.1:3000';
    console.log(`  API 健康检查: ${apiBase.replace(/\/$/, '')}/api/health`);
  }
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[deploy:release] 失败:', err.message);
  process.exit(1);
});
