import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, '../../../../.env');
const localEnv = resolve(__dirname, '../../../.env');
const envPath = existsSync(rootEnv) ? rootEnv : existsSync(localEnv) ? localEnv : null;

function warnDuplicateKeys(path: string) {
  const seen = new Map<string, number>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.warn(
      `[env] .env 中存在重复配置（后者会覆盖前者）: ${duplicates.map(([k]) => k).join(', ')}`,
    );
  }
}

if (envPath) {
  warnDuplicateKeys(envPath);
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}
