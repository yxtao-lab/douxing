/**
 * H9+-2 · Step 17 Web Playbook CRUD 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server playbook:crud-cases
 *   pnpm --filter @douxing/server playbook:crud-cases -- --skip-db
 */
import '../config/env.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, ApiMessageKey } from '@douxing/shared';
import { ROUTE_PLAYBOOKS } from '../data/route-playbooks.js';
import {
  createRoutePlaybook,
  deleteRoutePlaybook,
  getRoutePlaybookById,
  invalidatePlaybookCache,
  loadEnabledRoutePlaybooks,
  updateRoutePlaybook,
} from '../services/playbook.service.js';
import {
  formatPlaybookContextForLlm,
  retrievePlaybooksFromCatalog,
} from '../services/playbook-rag.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const skipDb = process.argv.includes('--skip-db');

const TEST_PLAYBOOK_ID = 'step17-crud-accept';

const WEB_PLAYBOOK_I18N_KEYS = [
  'playbooks.fieldSummaryZh',
  'playbooks.fieldSummaryEn',
  'playbooks.createTitle',
  'playbooks.editTitle',
  'playbooks.colEnabled',
  'playbooks.saveFailed',
  'playbooks.deleteConfirm',
] as const;

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function readLocaleObject(relativePath: string, exportName: string): Record<string, unknown> {
  const abs = resolve(repoRoot, relativePath);
  const raw = readFileSync(abs, 'utf8');
  const marker = `export const ${exportName} = `;
  const start = raw.indexOf(marker);
  if (start < 0) {
    throw new Error(`无法解析 locale 文件: ${relativePath}`);
  }
  const bodyStart = start + marker.length;
  let depth = 0;
  let end = -1;
  for (let i = bodyStart; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`无法解析 locale 对象: ${relativePath}`);
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return (${raw.slice(bodyStart, end)})`)() as Record<string, unknown>;
}

function getNested(obj: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function checkSeedSummaries(): void {
  console.log('--- seed 双语摘要 ---');
  for (const playbook of ROUTE_PLAYBOOKS) {
    const zhOk = playbook.summaryZh.trim().length >= 8;
    const enOk = playbook.summaryEn.trim().length >= 8;
    assert(zhOk && enOk, `${playbook.id} 含 summaryZh + summaryEn`);
  }

  const sample = ROUTE_PLAYBOOKS[0]!;
  const zhCtx = formatPlaybookContextForLlm([{ playbook: sample, score: 10 }], 'zh-CN');
  const enCtx = formatPlaybookContextForLlm([{ playbook: sample, score: 10 }], 'en-US');
  assert(zhCtx.includes(sample.summaryZh.slice(0, 8)), 'LLM 注入含中文摘要');
  assert(enCtx.includes('Playbook reference'), 'LLM 注入 en-US 标题');
  console.log('');
}

function checkWebI18n(): void {
  console.log('--- Web 管理端 i18n ---');
  const zh = readLocaleObject('packages/web/src/i18n/locales/zh-CN.ts', 'webZhCN');
  const en = readLocaleObject('packages/web/src/i18n/locales/en-US.ts', 'webEnUS');

  for (const key of WEB_PLAYBOOK_I18N_KEYS) {
    const zhVal = getNested(zh, key);
    const enVal = getNested(en, key);
    assert(typeof zhVal === 'string' && zhVal.length > 0, `zh-CN ${key}`);
    assert(typeof enVal === 'string' && enVal.length > 0, `en-US ${key}`);
  }
  console.log('');
}

async function checkCrudCycle(): Promise<void> {
  console.log('--- DB CRUD（运营不发版）---');

  await deleteRoutePlaybook(TEST_PLAYBOOK_ID).catch(() => undefined);

  const created = await createRoutePlaybook({
    id: TEST_PLAYBOOK_ID,
    city: '杭州',
    scope: 'Step17 验收',
    keywords: ['验收', '测试'],
    themes: ['文化'],
    classicOrder: ['断桥残雪', '雷峰塔'],
    segments: [
      {
        from: '断桥残雪',
        to: '雷峰塔',
        mode: 'walk',
        reasonKey: 'scenicWalk',
        fromAliases: ['断桥'],
      },
    ],
    summaryZh: 'Step17 验收动线：断桥至雷峰塔步行。',
    summaryEn: 'Step17 acceptance route: walk from Broken Bridge to Leifeng Pagoda.',
    enabled: true,
    sortOrder: 9999,
  });
  assert(created.id === TEST_PLAYBOOK_ID, 'createRoutePlaybook 写入 DB');

  const fetched = await getRoutePlaybookById(TEST_PLAYBOOK_ID);
  assert(Boolean(fetched?.summaryZh.includes('Step17')), 'getRoutePlaybookById 可读中文摘要');
  assert(Boolean(fetched?.summaryEn.includes('Step17')), 'getRoutePlaybookById 可读英文摘要');

  invalidatePlaybookCache();
  const enabledItems = await loadEnabledRoutePlaybooks();
  assert(
    enabledItems.some((item) => item.id === TEST_PLAYBOOK_ID),
    'loadEnabledRoutePlaybooks 含新建项（RAG 读 DB）',
  );

  const matches = retrievePlaybooksFromCatalog(enabledItems, {
    city: '杭州',
    prompt: 'Step17 验收 断桥',
    themes: ['文化'],
    limit: 3,
  });
  assert(
    matches.some((item) => item.playbook.id === TEST_PLAYBOOK_ID),
    'retrievePlaybooksFromCatalog 命中新建 playbook',
  );

  const updated = await updateRoutePlaybook(TEST_PLAYBOOK_ID, {
    summaryZh: 'Step17 已更新中文摘要。',
    summaryEn: 'Step17 updated English summary.',
    enabled: false,
  });
  assert(updated?.enabled === false, 'updateRoutePlaybook 可改启用状态');

  invalidatePlaybookCache();
  const afterDisable = await loadEnabledRoutePlaybooks();
  assert(
    !afterDisable.some((item) => item.id === TEST_PLAYBOOK_ID),
    '禁用后 RAG 不再返回该 playbook',
  );

  const deleted = await deleteRoutePlaybook(TEST_PLAYBOOK_ID);
  assert(deleted, 'deleteRoutePlaybook 删除成功');
  assert(!(await getRoutePlaybookById(TEST_PLAYBOOK_ID)), '删除后 getRoutePlaybookById 为 null');
  console.log('');
}

async function checkValidationErrors(): Promise<void> {
  console.log('--- 段间边校验 ---');
  let validationFailed = false;
  try {
    await createRoutePlaybook({
      id: 'step17-invalid-segments',
      city: '杭州',
      scope: '无效',
      keywords: [],
      themes: [],
      classicOrder: ['A'],
      segments: [{ from: 'A', to: 'B', mode: 'hovercraft' as 'walk', reasonKey: 'classicWalk' }],
      summaryZh: '无效',
      summaryEn: 'invalid',
    });
  } catch (err) {
    validationFailed =
      err instanceof ApiError && err.messageKey === ApiMessageKey.PLAYBOOK_VALIDATION_FAILED;
  } finally {
    await deleteRoutePlaybook('step17-invalid-segments').catch(() => undefined);
  }
  assert(validationFailed, '非法 segments 抛出 PLAYBOOK_VALIDATION_FAILED');
  console.log('');
}

async function main(): Promise<void> {
  console.log('=== H9+-2 Web Playbook CRUD 验收（Step 17）===\n');

  checkSeedSummaries();
  checkWebI18n();

  if (skipDb) {
    console.log('--- DB CRUD ---');
    console.log('[SKIP] --skip-db 已跳过 DB 用例\n');
  } else {
    try {
      await checkCrudCycle();
      await checkValidationErrors();
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB CRUD 异常:', err instanceof Error ? err.message : err);
      console.error('提示：需 MySQL 可用；无 DB 时使用 --skip-db\n');
    }
  }

  if (failed > 0) {
    console.error(`Step 17 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 17 验收全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[playbook-crud-cases] 运行失败:', err);
  process.exit(1);
});
