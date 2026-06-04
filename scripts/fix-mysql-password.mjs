#!/usr/bin/env node
/**
 * 同步 Docker MySQL 用户密码与 .env 一致（已有数据卷时改 .env 不会自动生效）
 *
 * 用法（项目根目录）:
 *   pnpm fix:mysql-password
 *   pnpm fix:mysql-password --recreate   # 清空 MySQL 数据卷后重建（会丢库）
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pmFilterExecCmd } from './pm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const containerName = 'douxing-mysql';

function loadEnvFile() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) {
    console.error('[fix:mysql] 未找到 .env');
    process.exit(1);
  }
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

const execOpts = { encoding: 'utf8', shell: true };

function run(cmd, opts = {}) {
  const result = execSync(cmd, { ...execOpts, cwd: root, ...opts });
  if (result == null || opts.stdio === 'inherit') return '';
  return result.toString().trim();
}

function tryRun(cmd) {
  try {
    run(cmd, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

function containerRunning() {
  try {
    const out = run(`docker inspect -f "{{.State.Running}}" ${containerName}`);
    return out === 'true';
  } catch {
    return false;
  }
}

function tryRootLogin(password) {
  return tryRun(
    `docker exec -e MYSQL_PWD=${password} ${containerName} mysql -u root -e "SELECT 1"`,
  );
}

function tryAppLogin(user, password, database) {
  return tryRun(
    `docker exec -e MYSQL_PWD=${password} ${containerName} mysql -u ${user} ${database} -e "SELECT 1"`,
  );
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function execSqlAsRoot(rootPassword, sql) {
  run(
    `docker exec -e MYSQL_PWD=${rootPassword} ${containerName} mysql -u root -e ${shellQuote(sql)}`,
    { stdio: 'inherit' },
  );
}

function recreateMysql() {
  const prodCompose = existsSync(resolve(root, 'deploy/docker-compose.prod.yml'));
  const composeFile = prodCompose ? 'deploy/docker-compose.prod.yml' : 'docker-compose.yml';
  console.log(`[fix:mysql] 清空并重建 MySQL（${composeFile}）...`);
  run(`docker compose -f ${composeFile} down`);
  try {
    run(`docker volume rm ${detectVolumeName()}`, { stdio: 'inherit' });
  } catch {
    run(`docker compose -f ${composeFile} down -v`, { stdio: 'inherit' });
  }
  run(`docker compose -f ${composeFile} up -d mysql`, { stdio: 'inherit' });
  console.log('[fix:mysql] 等待 MySQL 初始化...');
  for (let i = 1; i <= 30; i++) {
    if (tryRootLogin(process.env.MYSQL_ROOT_PASSWORD)) {
      console.log('[fix:mysql] MySQL 已用 .env 新密码初始化');
      return;
    }
    execSync('sleep 2');
    console.log(`[fix:mysql] 等待中... (${i}/30)`);
  }
  throw new Error('MySQL 重建后仍无法连接，请检查 .env 中 MYSQL_ROOT_PASSWORD');
}

function detectVolumeName() {
  try {
    const mounts = run(`docker inspect ${containerName} --format '{{range .Mounts}}{{.Name}} {{end}}'`);
    const volume = mounts.split(/\s+/).find((name) => name.includes('mysql'));
    if (volume) return volume;
  } catch {
    /* ignore */
  }
  return 'project_mysql_data';
}

function findWorkingRootPassword() {
  const candidates = [
    process.env.MYSQL_ROOT_PASSWORD,
    process.env.MYSQL_PASSWORD,
    'douxing123',
    '123456',
    'root123456',
    'Sj13098830296.',
  ].filter(Boolean);

  const seen = new Set();
  for (const password of candidates) {
    if (seen.has(password)) continue;
    seen.add(password);
    if (tryRootLogin(password)) {
      console.log('[fix:mysql] 已用 root 登录成功');
      return password;
    }
  }
  return null;
}

function syncPasswords(rootPassword) {
  const target = process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD;
  const rootTarget = process.env.MYSQL_ROOT_PASSWORD || target;
  const database = process.env.MYSQL_DATABASE || 'douxing';
  const appUser = process.env.MYSQL_USER || 'douxing';

  if (!target || !rootTarget) {
    throw new Error('.env 缺少 MYSQL_PASSWORD 或 MYSQL_ROOT_PASSWORD');
  }

  console.log(`[fix:mysql] 同步用户密码 → ${appUser} / root`);

  const sql = `
CREATE USER IF NOT EXISTS '${appUser}'@'%' IDENTIFIED BY '${target}';
ALTER USER '${appUser}'@'%' IDENTIFIED BY '${target}';
CREATE USER IF NOT EXISTS '${appUser}'@'localhost' IDENTIFIED BY '${target}';
ALTER USER '${appUser}'@'localhost' IDENTIFIED BY '${target}';
CREATE USER IF NOT EXISTS '${appUser}'@'172.18.0.1' IDENTIFIED BY '${target}';
ALTER USER '${appUser}'@'172.18.0.1' IDENTIFIED BY '${target}';
ALTER USER 'root'@'%' IDENTIFIED BY '${rootTarget}';
ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootTarget}';
GRANT ALL PRIVILEGES ON ${database}.* TO '${appUser}'@'%';
GRANT ALL PRIVILEGES ON ${database}.* TO '${appUser}'@'localhost';
GRANT ALL PRIVILEGES ON ${database}.* TO '${appUser}'@'172.18.0.1';
FLUSH PRIVILEGES;
`.trim();

  execSqlAsRoot(rootPassword, sql);
}

function verifyFromHost() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[fix:mysql] 未设置 DATABASE_URL，跳过宿主机连接验证');
    return false;
  }
  try {
    run(pmFilterExecCmd('@douxing/server', 'tsx', ['src/db/wait-only.ts']), { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

loadEnvFile();

const recreate = process.argv.includes('--recreate');
const force = process.argv.includes('--force');

console.log('========================================');
console.log('  兜行 · Docker MySQL 密码修复');
console.log('========================================');

if (!containerRunning()) {
  console.error(`[fix:mysql] 容器 ${containerName} 未运行，请先: docker compose up -d mysql`);
  process.exit(1);
}

if (recreate) {
  recreateMysql();
  verifyFromHost();
  console.log('\n[fix:mysql] 完成。请执行: pnpm deploy:server --skip-docker --use-tsx');
  process.exit(0);
}

const hostOk = verifyFromHost();
if (hostOk && !force) {
  console.log('[fix:mysql] 宿主机 DATABASE_URL 连接正常，无需修改 MySQL 密码');
  console.log('[fix:mysql] 若 PM2 仍报 Access denied，请执行:');
  console.log('  pnpm exec pm2 delete douxing-api');
  console.log('  pnpm deploy:server --skip-docker --skip-build');
  process.exit(0);
}

if (hostOk && force) {
  console.log('[fix:mysql] --force：仍强制同步 MySQL 用户密码');
}

const rootPassword = findWorkingRootPassword();
if (!rootPassword) {
  console.error('[fix:mysql] 无法用任何已知 root 密码登录 MySQL');
  console.error('  方案 1（推荐，会清空数据）: pnpm fix:mysql-password --recreate');
  console.error('  方案 2: 手动进容器改密码，或联系运维');
  process.exit(1);
}

syncPasswords(rootPassword);

if (!verifyFromHost()) {
  console.error('[fix:mysql] 密码同步后宿主机仍无法连接，请检查 .env 中 DATABASE_URL 是否与 MYSQL_PASSWORD 一致');
  process.exit(1);
}

console.log('[fix:mysql] 宿主机连接验证通过');
console.log('\n[fix:mysql] 完成。生产机请执行:');
console.log('  pnpm exec pm2 delete douxing-api');
console.log('  pnpm deploy:server --skip-docker --skip-build');
