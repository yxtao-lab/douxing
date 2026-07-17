/**
 * P-ONBOARD-01 首次标签引导验收（共享层）。
 *
 * 用法：pnpm --filter @douxing/server p-onboard:tag-guide-cases
 */
import {
  ONBOARDING_DEFAULTS,
  normalizeOnboardingInput,
  needsOnboarding,
  isGenderSlug,
  isAgeRangeSlug,
  isTravelRadiusSlug,
  isBudgetTierSlug,
  isCompanionStructureSlug,
  formatGenderLabel,
  formatAgeRangeLabel,
  formatTravelRadiusLabel,
  genderPresets,
  ageRangePresets,
  travelRadiusPresets,
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

function checkNeedsOnboarding() {
  console.log('--- needsOnboarding ---');
  assert(needsOnboarding(null) === true, 'null 需引导');
  assert(needsOnboarding(undefined) === true, 'undefined 需引导');
  assert(needsOnboarding('') === true, '空串需引导');
  assert(needsOnboarding('2026-07-17 12:00:00') === false, '有时间戳不需引导');
  console.log('');
}

function checkSkippedDefaults() {
  console.log('--- skipped 默认值 ---');
  const result = normalizeOnboardingInput({ skipped: true });
  assert(result.gender === ONBOARDING_DEFAULTS.gender, '默认 gender');
  assert(result.ageRange === ONBOARDING_DEFAULTS.ageRange, '默认 ageRange');
  assert(result.travelRadius === ONBOARDING_DEFAULTS.travelRadius, '默认 travelRadius');
  assert(
    JSON.stringify(result.preferredScenes) ===
      JSON.stringify(ONBOARDING_DEFAULTS.preferredScenes),
    '默认 preferredScenes',
  );
  assert(result.preferredScenes.length > 0, '跳过后场景非空');
  console.log('');
}

function checkPartialFill() {
  console.log('--- 部分填写合并默认 ---');
  const result = normalizeOnboardingInput({
    gender: 'female',
    preferredScenes: ['date'],
  });
  assert(result.gender === 'female', '保留 gender');
  assert(result.ageRange === ONBOARDING_DEFAULTS.ageRange, '缺 ageRange 用默认');
  assert(result.travelRadius === ONBOARDING_DEFAULTS.travelRadius, '缺 travelRadius 用默认');
  assert(JSON.stringify(result.preferredScenes) === JSON.stringify(['date']), '保留场景');
  console.log('');
}

function checkEmptyScenesFallback() {
  console.log('--- 空场景回退默认 ---');
  const result = normalizeOnboardingInput({ preferredScenes: [] });
  assert(
    JSON.stringify(result.preferredScenes) ===
      JSON.stringify(ONBOARDING_DEFAULTS.preferredScenes),
    '空场景用默认',
  );
  console.log('');
}

function checkEnumsAndLabels() {
  console.log('--- 枚举与文案 ---');
  assert(genderPresets.every((g) => isGenderSlug(g)), 'gender presets 合法');
  assert(ageRangePresets.every((a) => isAgeRangeSlug(a)), 'ageRange presets 合法');
  assert(travelRadiusPresets.every((r) => isTravelRadiusSlug(r)), 'travelRadius presets 合法');
  assert(isBudgetTierSlug('mid-range') === true, 'mid-range 合法');
  assert(isCompanionStructureSlug('family') === true, 'family 合法');
  assert(formatGenderLabel('male', 'zh-CN') !== 'male', 'gender zh 有翻译');
  assert(formatAgeRangeLabel('23-30', 'en-US').length > 0, 'ageRange en 非空');
  assert(formatTravelRadiusLabel('local', 'zh-CN').length > 0, 'travelRadius zh 非空');
  console.log('');
}

function checkCompanionAndBudget() {
  console.log('--- companion / budget ---');
  const result = normalizeOnboardingInput({
    companionStructure: ['couple', 'invalid', 'couple'],
    budgetTier: 'premium',
  });
  assert(
    JSON.stringify(result.companionStructure) === JSON.stringify(['couple']),
    'companion 去重过滤',
  );
  assert(result.budgetTier === 'premium', 'budgetTier 保留');
  console.log('');
}

function main() {
  console.log('=== P-ONBOARD-01 首次标签引导验收 ===\n');
  checkNeedsOnboarding();
  checkSkippedDefaults();
  checkPartialFill();
  checkEmptyScenesFallback();
  checkEnumsAndLabels();
  checkCompanionAndBudget();

  if (failed > 0) {
    console.error(`\nP-ONBOARD-01 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\n=== P-ONBOARD-01 验收全部通过 ===');
  process.exit(0);
}

main();
