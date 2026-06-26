/**
 * 开发环境联调自检（对应 docs/下一步工作.md §开发环境自检）
 *
 * 用法：
 *   pnpm --filter @douxing/server dev:self-check
 *   pnpm --filter @douxing/server dev:self-check -- --with-enrich   # 额外实跑 enrich dry-run（需网络）
 */
import '../config/env.js';
import { runS1RbacCases } from './s1-rbac-cases.js';
import { runS2DynamicMenuCases } from './s2-dynamic-menu-cases.js';
import { runDt3AnalyticsCases } from './dt3-analytics-cases.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import { isNull, sql } from 'drizzle-orm';

const withEnrich = process.argv.includes('--with-enrich');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsAttractions = path.resolve(__dirname, '../../uploads/attractions');

let failed = 0;
let warned = 0;

function ok(label: string) {
  console.log(`[OK] ${label}`);
}

function fail(label: string) {
  failed += 1;
  console.error(`[FAIL] ${label}`);
}

function warn(label: string) {
  warned += 1;
  console.warn(`[WARN] ${label}`);
}

async function checkDatabase() {
  console.log('--- 数据库 ---');
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    ok('MySQL 连接正常');
  } catch (err) {
    fail(`MySQL 连接失败: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

async function checkCoverEnrichEnv() {
  console.log('--- 封面 enrich 环境 ---');
  const amapKey = process.env.AMAP_WEB_KEY?.trim();
  if (!amapKey) {
    warn('未配置 AMAP_WEB_KEY，跳过 enrich 实跑（开发环境可后续补全）');
  } else {
    ok('AMAP_WEB_KEY 已配置');
    if (withEnrich) {
      try {
        const { spawnSync } = await import('node:child_process');
        const result = spawnSync(
          'pnpm',
          ['--filter', '@douxing/server', 'enrich:attraction-images', '--', '--dry-run', '--limit=3'],
          {
            cwd: path.resolve(__dirname, '../../../..'),
            shell: true,
            encoding: 'utf8',
            timeout: 120_000,
          },
        );
        const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        if (result.status === 0) {
          ok('enrich:attraction-images --dry-run 执行成功');
        } else if (/fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i.test(output)) {
          warn('enrich dry-run 因网络/外网 API 不可用未通过（开发环境可忽略，需要时再跑 enrich）');
        } else {
          fail(`enrich dry-run 失败: ${output.trim() || `exit ${result.status}`}`);
        }
      } catch (err) {
        fail(`enrich dry-run 异常: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      ok('封面 enrich 仅检查环境（实跑请加 --with-enrich）');
    }
  }

  if (!fs.existsSync(uploadsAttractions)) {
    warn('uploads/attractions 目录不存在（首次 enrich 前正常）');
  } else {
    ok('uploads/attractions 目录存在');
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ total: sql<number>`count(*)` })
      .from(attractions)
      .where(isNull(attractions.coverImageUrl));
    const missing = Number(row?.total ?? 0);
    ok(`无封面景点 ${missing} 个（可 enrich 补全）`);
  } catch {
    warn('无法统计无封面景点');
  }
  console.log('');
}

async function checkJourneyAlbumEnv() {
  console.log('--- 旅程相册 J 线 ---');
  const uploadsPhotos = path.resolve(__dirname, '../../uploads/photos');
  if (!fs.existsSync(uploadsPhotos)) {
    warn('uploads/photos 目录不存在（首次上传前正常）');
  } else {
    ok('uploads/photos 目录存在');
  }
  const quotaEnforce = process.env.PHOTO_QUOTA_ENFORCE;
  ok(`PHOTO_QUOTA_ENFORCE=${quotaEnforce ?? '(默认 true)'}`);
  console.log('');
}

async function checkRbac() {
  console.log('--- S1 RBAC ---');
  const passed = await runS1RbacCases();
  if (passed) {
    ok('s1:rbac-cases 全绿');
  } else {
    fail('s1:rbac-cases 未通过');
  }
  console.log('');
}

async function checkDynamicMenu() {
  console.log('--- S2 动态菜单 ---');
  const passed = await runS2DynamicMenuCases();
  if (passed) {
    ok('s2:dynamic-menu-cases 全绿');
  } else {
    fail('s2:dynamic-menu-cases 未通过');
  }
  console.log('');
}

async function checkDt3Analytics() {
  console.log('--- DT3 客户端埋点 ---');
  const passed = await runDt3AnalyticsCases();
  if (passed) {
    ok('dt3:analytics-cases 全绿');
  } else {
    fail('dt3:analytics-cases 未通过');
  }
  console.log('');
}

async function main() {
  console.log('=== 开发环境联调自检 ===\n');
  await checkDatabase();
  await checkCoverEnrichEnv();
  await checkJourneyAlbumEnv();
  await checkRbac();
  await checkDynamicMenu();
  await checkDt3Analytics();

  console.log(`完成：${failed} 失败 · ${warned} 警告`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
