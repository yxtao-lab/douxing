#!/usr/bin/env node
/**
 * 一键停止兜行相关进程
 * 用法: pnpm stop [--skip-docker] [--docker-only]
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import killPort from 'kill-port';
import { listDevPortsToFree, loadRootEnv } from './dev-ports.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const skipDocker = args.includes('--skip-docker');
const dockerOnly = args.includes('--docker-only');

function getDevPorts() {
  loadRootEnv();
  const dockerMysqlPort = Number(process.env.DOCKER_MYSQL_HOST_PORT) || 3307;
  return {
    dev: listDevPortsToFree(),
    docker: [dockerMysqlPort],
  };
}

async function freePort(port) {
  try {
    await killPort(port, 'tcp');
    console.log(`[stop] 已释放端口 ${port}`);
    return true;
  } catch {
    console.log(`[stop] 端口 ${port} 无进程占用`);
    return false;
  }
}

function stopDocker() {
  try {
    execSync('docker compose down', { cwd: root, stdio: 'inherit' });
    console.log('[stop] Docker 容器已停止');
  } catch {
    console.log('[stop] Docker 未运行或 compose down 失败（可忽略）');
  }
}

async function stopDevServers() {
  const { dev } = getDevPorts();
  console.log('[stop] 正在停止开发服务端口:', dev.join(', '));
  for (const port of dev) {
    await freePort(port);
  }
}

async function main() {
  console.log('========================================');
  console.log('  兜行 · 一键停止');
  console.log('========================================\n');

  loadRootEnv();

  if (dockerOnly) {
    stopDocker();
    return;
  }

  if (!skipDocker) {
    stopDocker();
  } else {
    console.log('[stop] 已跳过 Docker（--skip-docker）');
  }

  await stopDevServers();

  console.log('\n========================================');
  console.log('  已停止');
  console.log('  - API / 管理端 / PC 用户端 / 移动端 H5 占用端口（微信小程序为编译监听，随终端一并结束）');
  if (!skipDocker) console.log('  - Docker MySQL 容器');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('[stop] 失败:', err.message);
  process.exit(1);
});
