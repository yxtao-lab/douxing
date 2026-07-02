/**
 * H3-a · Step 27 规划页 Focus 宠物 UI 验收（共享逻辑）
 *
 * 用法：pnpm --filter @douxing/server plan-pet-focus:cases
 */
import {
  resolvePlanPetFocusViewModel,
  wrapPlanAssistantWithPetTone,
  type PlanPetMeta,
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

function checkPetTone() {
  console.log('--- 口吻化 assistant ---');
  const pet: Pick<PlanPetMeta, 'nickname' | 'personality'> = {
    nickname: '团子',
    personality: 'foodie',
  };
  const zh = wrapPlanAssistantWithPetTone('已为您生成 2 套方案', pet, 'zh-CN');
  assert(zh.includes('团子'), 'zh 含昵称');
  assert(zh.includes('美食'), 'zh foodie 前缀');

  const en = wrapPlanAssistantWithPetTone('Plan ready', pet, 'en-US');
  assert(en.includes('Food buddy'), 'en foodie prefix');

  const skipped = wrapPlanAssistantWithPetTone(`「团子」：已有前缀`, pet, 'zh-CN');
  assert(skipped === '「团子」：已有前缀', '已有前缀不重复');
  console.log('');
}

function checkFocusViewModel() {
  console.log('--- 记忆摘要 ViewModel ---');
  const meta: PlanPetMeta = {
    nickname: '咪咪',
    species: 'cat',
    personality: 'photo',
    memorySummary: '召回 2 条记忆：· 偏爱慢节奏',
    recallExplain: [
      { memoryType: 'preference', content: '偏爱慢节奏', reason: '稳定偏好标签' },
      { memoryType: 'regret', content: '火锅没吃到', reason: '上次遗憾·建议优先补偿' },
    ],
  };
  const zh = resolvePlanPetFocusViewModel(meta, 'zh-CN');
  assert(Boolean(zh?.showPanel), 'showPanel');
  assert(zh?.hasMemories === true, 'hasMemories');
  assert((zh?.recallItems.length ?? 0) === 0, '规划页不展开 recallItems');
  assert(Boolean(zh?.memoryAppliedHint), 'memoryAppliedHint');
  assert(Boolean(zh?.personalityLabel.includes('摄影')), 'zh personality label');

  const en = resolvePlanPetFocusViewModel(meta, 'en-US');
  assert(Boolean(en?.memoryAppliedHint.toLowerCase().includes('companion')), 'en memoryAppliedHint');
  console.log('');
}

function main() {
  console.log('=== H3-a 规划页 Focus 宠物 UI 验收（Step 27）===\n');
  checkPetTone();
  checkFocusViewModel();

  if (failed > 0) {
    console.error(`Step 27 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 27 验收全部通过 ===');
  process.exit(0);
}

main();
