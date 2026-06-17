/**
 * C7 Step 10：管道 vs Agent 首句规划等价率脚本
 *
 * 用法（仓库根目录）：
 *   pnpm --filter @douxing/server agent:equivalence-cases
 *   LLM_ENABLED=false AI_SERVICE_ENABLED=false pnpm --filter @douxing/server agent:equivalence-cases
 *   pnpm --filter @douxing/server agent:equivalence-cases -- --report reports/agent-equivalence.json
 *   pnpm --filter @douxing/server agent:equivalence-cases -- --fast
 */
import '../config/env.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_EQUIVALENCE_MIN_RATE,
  type EquivalenceSeedCase,
  runEquivalenceSuite,
} from '../services/agent-equivalence.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');

const args = process.argv.slice(2);

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const seedPath = resolve(
  repoRoot,
  argValue('--seed', 'packages/ml-training/datasets/prompts-seed.jsonl'),
);
const reportPath = argValue('--report', '');
const limit = parseInt(argValue('--limit', '9999'), 10);
const poiJaccardMin = parseFloat(argValue('--poi-jaccard-min', '1'));
const liveMode = hasFlag('--live');
const fastMode = hasFlag('--fast');
const deterministic = !liveMode;

/** 与 prompts-seed.jsonl 对齐的内置种子（文件缺失时兜底） */
const FALLBACK_SEEDS: EquivalenceSeedCase[] = [
  { id: 'hz-3d-culture', prompt: '杭州3天文化之旅，预算3000左右，想逛西湖和灵隐寺', city: '杭州', days: 3, themes: ['文化', '自然'] },
  { id: 'bj-5d-family', prompt: '北京5天亲子游，故宫、长城、环球影城，预算8000', city: '北京', days: 5, themes: ['亲子', '历史'] },
  { id: 'cd-2d-food', prompt: '成都2天美食休闲，宽窄巷子火锅', city: '成都', days: 2, themes: ['美食', '休闲'] },
  { id: 'sh-3d-city', prompt: '上海3天城市漫步，外滩陆家嘴', city: '上海', days: 3, themes: ['城市', '摄影'] },
  { id: 'xa-4d-history', prompt: '西安4天历史探秘，兵马俑回民街', city: '西安', days: 4, themes: ['历史', '美食'] },
  { id: 'xm-3d-island', prompt: '厦门3天海岛休闲，鼓浪屿曾厝垵', city: '厦门', days: 3, themes: ['休闲', '自然'] },
  { id: 'cq-3d-spicy', prompt: '重庆3天麻辣美食，洪崖洞解放碑', city: '重庆', days: 3, themes: ['美食'] },
  { id: 'sz-2d-garden', prompt: '苏州2天园林古镇，拙政园周庄', city: '苏州', days: 2, themes: ['文化'] },
  { id: 'gz-3d-tea', prompt: '广州3天早茶美食CityWalk', city: '广州', days: 3, themes: ['美食', '休闲'] },
  { id: 'nj-3d-minguo', prompt: '南京3天民国文化，中山陵夫子庙', city: '南京', days: 3, themes: ['历史', '文化'] },
  { id: 'wh-2d-sakura', prompt: '武汉2天樱花季东湖黄鹤楼', city: '武汉', days: 2, themes: ['自然', '文化'] },
  { id: 'cs-2d-xiang', prompt: '长沙2天湘菜美食橘子洲', city: '长沙', days: 2, themes: ['美食'] },
  { id: 'qd-3d-beach', prompt: '青岛3天海滨啤酒节栈桥', city: '青岛', days: 3, themes: ['休闲', '美食'] },
  { id: 'dl-3d-coast', prompt: '大连3天海滨老虎滩', city: '大连', days: 3, themes: ['休闲', '自然'] },
  { id: 'km-4d-slow', prompt: '昆明4天云南慢生活石林', city: '昆明', days: 4, themes: ['自然', '休闲'] },
  { id: 'lj-3d-oldtown', prompt: '丽江3天古城玉龙雪山', city: '丽江', days: 3, themes: ['文化', '自然'] },
  { id: 'gl-3d-scenery', prompt: '桂林3天山水阳朔西街', city: '桂林', days: 3, themes: ['自然', '摄影'] },
  { id: 'sy-5d-resort', prompt: '三亚5天度假亚龙湾天涯海角', city: '三亚', days: 5, themes: ['休闲'] },
  { id: 'hrb-3d-ice', prompt: '哈尔滨3天冰雪中央大街', city: '哈尔滨', days: 3, themes: ['休闲', '文化'] },
  { id: 'ls-5d-potala', prompt: '拉萨5天布达拉宫大昭寺', city: '拉萨', days: 5, themes: ['文化'] },
];

interface SeedRow {
  prompt: string;
  city?: string;
  days?: number;
  budget?: string;
  themes?: string[];
}

function loadSeeds(): EquivalenceSeedCase[] {
  if (!existsSync(seedPath)) {
    console.warn(`[agent-equivalence] 种子文件不存在，使用内置 ${FALLBACK_SEEDS.length} 条`);
    return FALLBACK_SEEDS.slice(0, limit);
  }

  const rows: SeedRow[] = readFileSync(seedPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SeedRow);

  return rows.slice(0, limit).map((row, index) => ({
    id: `seed-${index + 1}`,
    prompt: row.prompt,
    city: row.city,
    days: row.days,
    budget: row.budget,
    themes: row.themes,
  }));
}

async function main() {
  if (deterministic) {
    process.env.LLM_ENABLED = 'false';
    process.env.AI_SERVICE_ENABLED = 'false';
  }

  const seeds = loadSeeds();
  if (seeds.length < 20) {
    console.error(`[agent-equivalence] 种子不足 20 条（当前 ${seeds.length}）`);
    process.exit(1);
  }

  const report = await runEquivalenceSuite(seeds, {
    deterministic,
    poiJaccardMin,
    skipEnrich: fastMode,
  });

  console.log(
    `[agent-equivalence] 模式=${report.mode} · 用例=${seeds.length} · POI Jaccard≥${poiJaccardMin}`,
  );

  emailReport(report);
}

function emailReport(report: Awaited<ReturnType<typeof runEquivalenceSuite>>): void {
  for (const c of report.cases) {
    if (c.equivalent) {
      console.log(`[OK] ${c.id} · ${c.prompt.slice(0, 36)}…`);
    } else {
      console.error(`[FAIL] ${c.id} · ${c.mismatch}`);
      console.error(`       管道: ${c.pipelineSummary}`);
      console.error(`       Agent: ${c.agentSummary}`);
    }
  }

  const ratePct = (report.equivalenceRate * 100).toFixed(1);
  const thresholdPct = (AGENT_EQUIVALENCE_MIN_RATE * 100).toFixed(0);
  console.log(
    `\n等价率 ${report.equivalentCases}/${report.totalCases} = ${ratePct}%（阈值 ${thresholdPct}%）`,
  );

  if (reportPath) {
    const absReport = resolve(repoRoot, reportPath);
    mkdirSync(dirname(absReport), { recursive: true });
    writeFileSync(absReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`报告已写入 ${absReport}`);
  }

  if (!report.passed) {
    process.exit(1);
  }
  console.log('\n全部等价率验收通过');
}

main().catch((err) => {
  console.error('[agent-equivalence] 运行失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
