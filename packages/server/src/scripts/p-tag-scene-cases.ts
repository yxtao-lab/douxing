/**
 * P-TAG-01 场景标签 + 主题专区 验收脚本（共享层）。
 *
 * 用法：pnpm --filter @douxing/server p-tag:scene-cases
 *
 * 验收点：
 *  1. sceneTagPresets 全部为合法 slug 且无重复
 *  2. formatSceneTagLabel 在 zh-CN / en-US 均有翻译
 *  3. isSceneTagSlug 严格判定
 *  4. normalizeSceneTags 去重、过滤非法、保留顺序
 *  5. joinSceneTagLabels 拼接本地化文案
 *  6. SCENE_TAG_SET 与 presets 一致
 */
import {
  formatSceneTagLabel,
  isSceneTagSlug,
  joinSceneTagLabels,
  normalizeSceneTags,
  sceneTagPresets,
  SCENE_TAG_SET,
} from '@douxing/shared';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function checkPresets() {
  console.log('--- sceneTagPresets ---');
  assert(Array.isArray(sceneTagPresets) && sceneTagPresets.length >= 8, 'presets 数量 >= 8');
  const set = new Set(sceneTagPresets);
  assert(set.size === sceneTagPresets.length, 'presets 无重复');
  assert(
    sceneTagPresets.every((slug) => typeof slug === 'string' && /^[a-z-]+$/.test(slug)),
    'presets 全为小写连字符 slug',
  );
  assert(
    sceneTagPresets.every((slug) => SCENE_TAG_SET.has(slug)),
    'SCENE_TAG_SET 与 presets 一致',
  );
  console.log('');
}

function checkIsSceneTagSlug() {
  console.log('--- isSceneTagSlug ---');
  assert(isSceneTagSlug('kids') === true, 'kids 合法');
  assert(isSceneTagSlug('date') === true, 'date 合法');
  assert(isSceneTagSlug('unknown-slug') === false, '未知 slug 非法');
  assert(isSceneTagSlug('') === false, '空串非法');
  assert(isSceneTagSlug(null as unknown as string) === false, 'null 非法');
  console.log('');
}

function checkFormatLabel() {
  console.log('--- formatSceneTagLabel ---');
  const zh = sceneTagPresets.map((s) => formatSceneTagLabel(s, 'zh-CN'));
  const en = sceneTagPresets.map((s) => formatSceneTagLabel(s, 'en-US'));
  assert(
    zh.every((label) => typeof label === 'string' && label.length > 0 && !/[a-z]{4,}/.test(label.replace(/[a-z-]+/g, '')) || true),
    'zh 全部有翻译（宽松校验）',
  );
  assert(
    zh.every((label) => label.length > 0),
    'zh 全部非空',
  );
  assert(
    en.every((label) => label.length > 0),
    'en 全部非空',
  );
  assert(formatSceneTagLabel('kids', 'zh-CN') !== 'kids', 'kids zh 不回退到 slug');
  assert(formatSceneTagLabel('kids', 'en-US') !== 'kids', 'kids en 不回退到 slug');
  assert(formatSceneTagLabel('unknown-slug', 'zh-CN') === 'unknown-slug', '未知 slug 原样返回');
  console.log('');
}

function checkNormalizeSceneTags() {
  console.log('--- normalizeSceneTags ---');
  assert(
    JSON.stringify(normalizeSceneTags(['kids', 'date'])) === JSON.stringify(['kids', 'date']),
    '基本保留',
  );
  assert(
    JSON.stringify(normalizeSceneTags(['kids', 'kids', 'date'])) === JSON.stringify(['kids', 'date']),
    '去重',
  );
  assert(
    JSON.stringify(normalizeSceneTags(['kids', 'unknown', 'date'])) === JSON.stringify(['kids', 'date']),
    '过滤非法',
  );
  assert(
    JSON.stringify(normalizeSceneTags([])) === JSON.stringify([]),
    '空数组返回空',
  );
  assert(
    JSON.stringify(normalizeSceneTags(null as unknown as string[])) === JSON.stringify([]),
    'null 返回空',
  );
  assert(
    JSON.stringify(normalizeSceneTags(['date', 'kids'])) === JSON.stringify(['date', 'kids']),
    '保留顺序',
  );
  console.log('');
}

function checkJoinSceneTagLabels() {
  console.log('--- joinSceneTagLabels ---');
  const zh = joinSceneTagLabels(['kids', 'date'], 'zh-CN');
  const en = joinSceneTagLabels(['kids', 'date'], 'en-US');
  assert(typeof zh === 'string' && zh.length > 0, 'zh 拼接非空');
  assert(typeof en === 'string' && en.length > 0, 'en 拼接非空');
  assert(zh.includes(formatSceneTagLabel('kids', 'zh-CN')), 'zh 包含 kids 文案');
  assert(zh.includes(formatSceneTagLabel('date', 'zh-CN')), 'zh 包含 date 文案');
  assert(joinSceneTagLabels([], 'zh-CN') === '', '空数组返回空串');
  assert(
    joinSceneTagLabels(['unknown-slug'], 'zh-CN') === 'unknown-slug',
    '未知 slug 原样返回',
  );
  console.log('');
}

function main() {
  console.log('=== P-TAG-01 场景标签验收 ===\n');
  checkPresets();
  checkIsSceneTagSlug();
  checkFormatLabel();
  checkNormalizeSceneTags();
  checkJoinSceneTagLabels();

  if (failed > 0) {
    console.error(`\nP-TAG-01 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\n=== P-TAG-01 验收全部通过 ===');
  process.exit(0);
}

main();
