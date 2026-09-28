/**
 * 兜行本地开发端口（避开常见 3000 / 5173 冲突）
 * 可通过根目录 .env 覆盖同名变量。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 将根目录 `.env` 载入 `process.env`（已有键不覆盖）。
 */
export function loadRootEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

loadRootEnv();

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function readPort(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : fallback;
}

/** 本地开发默认端口表 */
export const DEV_PORTS = {
  server: readPort(process.env.SERVER_PORT, 13000),
  web: readPort(process.env.WEB_PORT, 15173),
  mobile: readPort(process.env.MOBILE_H5_PORT, 15174),
  app: readPort(process.env.APP_DEV_PORT, 15175),
  pc: readPort(process.env.PC_PORT, 15176),
  ai: readPort(process.env.AI_SERVICE_PORT, 18100),
  routeSolver: readPort(process.env.ROUTE_SOLVER_PORT, 18200),
};

/** Vite / 脚本共用的 API 代理目标 */
export const API_PROXY_TARGET = `http://127.0.0.1:${DEV_PORTS.server}`;

/** 启动前应释放的开发端口列表 */
export function listDevPortsToFree() {
  return [
    DEV_PORTS.server,
    DEV_PORTS.web,
    DEV_PORTS.mobile,
    DEV_PORTS.app,
    DEV_PORTS.pc,
    DEV_PORTS.ai,
  ];
}
