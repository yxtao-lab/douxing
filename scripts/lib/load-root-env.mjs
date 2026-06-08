import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(__dirname, '../..');

/** 解析单行 KEY=VALUE，忽略注释与空行 */
function parseEnvLines(text) {
  const entries = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

/**
 * 轻量加载根目录 .env（不依赖 dotenv 包）
 * 优先级与 Vite 一致：后加载的文件覆盖先加载的；进程已有变量不被覆盖。
 */
export function loadRootEnv(options = {}) {
  const mode = options.mode ?? process.env.NODE_ENV ?? 'development';
  const files = ['.env', '.env.local'];
  if (mode) {
    files.push(`.env.${mode}`, `.env.${mode}.local`);
  }

  const fromFiles = {};
  for (const name of files) {
    const envPath = resolve(projectRoot, name);
    if (!existsSync(envPath)) continue;
    Object.assign(fromFiles, parseEnvLines(readFileSync(envPath, 'utf8')));
  }

  for (const [key, value] of Object.entries(fromFiles)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
