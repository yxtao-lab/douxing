/**
 * 本地 Enricher 演示脚本（不经过 HTTP，直接调用 enrichRouteDraft）
 *
 * 用法（在仓库根目录）：
 *   pnpm --filter @douxing/server enricher:demo
 *   pnpm --filter @douxing/server enricher:demo -- --offline
 *   pnpm --filter @douxing/server enricher:demo -- --locale en-US
 *
 * 模式：
 *   默认（full）  — 读取 .env：MySQL 查酒店、高德 distance/geocode、Redis 缓存（若配置）
 *   --offline     — 关闭高德（Haversine 估时），酒店走 fallback，不依赖 AMAP_WEB_KEY
 *
 * 前置：full 模式建议 docker compose up -d（MySQL）；offline 可无数据库（酒店库失败会自动降级）
 */

const args = process.argv.slice(2);
const offline = args.includes('--offline');

await import('../config/env.js');

if (offline) {
  process.env.AMAP_ENABLED = 'false';
}

const { enrichRouteDraft } = await import('../services/route-enricher.service.js');
import type { TravelIntentSnapshot } from '@douxing/shared';

const locale = args.includes('--locale')
  ? (args[args.indexOf('--locale') + 1] as 'zh-CN' | 'en-US' | undefined) ?? 'zh-CN'
  : 'zh-CN';

const intent: TravelIntentSnapshot = {
  city: '杭州',
  days: 1,
  budget: null,
  budgetMin: null,
  budgetMax: null,
  themes: ['文化'],
  confidence: 'high',
  transportPreference: 'high_speed_rail',
  lodgingArea: '西湖',
  lodgingTier: 'comfort',
  cities: ['杭州'],
};

const draft = {
  name: 'Enricher Demo · 杭州一日',
  description: '本地脚本测试',
  budgetRange: '2000-4000',
  days: 1,
  interestTags: ['文化'],
  matchedCity: '杭州',
  unlockPrice: 9.9,
  isAiGenerated: true,
  routeDetail: {
    days: [
      {
        date: '第1天',
        title: '西湖文化',
        attractions: [
          {
            name: '西湖',
            time: '',
            cost: 0,
            description: '漫步',
            poiType: 'attraction',
            latitude: 30.259,
            longitude: 120.14,
          },
          {
            name: '雷峰塔',
            time: '',
            cost: 40,
            description: '登塔',
            poiType: 'attraction',
            latitude: 30.231,
            longitude: 120.148,
          },
          {
            name: '灵隐寺',
            time: '',
            cost: 75,
            description: '礼佛',
            poiType: 'attraction',
            latitude: 30.242,
            longitude: 120.096,
          },
        ],
      },
    ],
  },
};

console.log(`[enricher-demo] 模式: ${offline ? 'offline（无高德）' : 'full（.env 高德+MySQL）'}`);
console.log(`[enricher-demo] locale: ${locale}`);

try {
  const enriched = await enrichRouteDraft(draft, { intent, locale });
  const day = enriched.routeDetail.days[0]!;

  console.log('\n--- 住宿 ---');
  console.log(JSON.stringify(day.lodging, null, 2));

  console.log('\n--- 交通段 ---');
  for (const seg of day.transit ?? []) {
    console.log(
      `  ${seg.from} → ${seg.to} | ${seg.mode} | ${seg.durationMinutes}min | ${seg.time}${seg.estimated ? ' (估算)' : ''}`,
    );
  }

  console.log('\n--- 游玩时刻 ---');
  for (const spot of day.attractions) {
    console.log(`  ${spot.name}: ${spot.time}`);
  }

  if (day.warnings?.length) {
    console.log('\n--- 警告 ---');
    day.warnings.forEach((w) => console.log(`  ${w}`));
  }

  console.log('\n[enricher-demo] 完成');
} catch (err) {
  console.error('[enricher-demo] 失败:', err instanceof Error ? err.message : err);
  process.exit(1);
}
