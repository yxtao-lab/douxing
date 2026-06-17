/**
 * 从 cn-division 同步省/市 JSON 到 shared/data，供 Python ai-service 与构建产物共用。
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'node_modules', 'cn-division', 'dist', 'code');
const destDir = join(root, 'data', 'admin-divisions');

mkdirSync(destDir, { recursive: true });
copyFileSync(join(srcDir, 'provinces.json'), join(destDir, 'provinces.json'));
copyFileSync(join(srcDir, 'cities.json'), join(destDir, 'cities.json'));

console.log('[shared] 已同步 cn-division 省/市数据 → data/admin-divisions/');
