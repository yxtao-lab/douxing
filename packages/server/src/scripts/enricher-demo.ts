/**
 * 本地 Enricher 演示脚本（不经过 HTTP，直接调用 enrichRouteDraft）
 *
 * 用法（在仓库根目录）：
 *   pnpm --filter @douxing/server enricher:demo
 *   pnpm --filter @douxing/server enricher:demo -- --offline
 *   pnpm --filter @douxing/server enricher:demo -- --intercity
 *   pnpm --filter @douxing/server enricher:demo -- --open-hours
 *   pnpm --filter @douxing/server enricher:demo -- --locale en-US
 *
 * 模式：
 *   默认（full）  — 读取 .env：MySQL 查酒店、高德 distance/geocode、Redis 缓存（若配置）
 *   --offline     — 关闭高德（Haversine 估时），酒店走 fallback，不依赖 AMAP_WEB_KEY
 *   --intercity   — 杭沪二日 + Catalog 班次（需 MySQL 查酒店时建议 --offline）
 *   --open-hours  — 北京故宫闭馆日 warning（需 MySQL + sync:open-hours）
 *   --playbook    — 西湖玩法 RAG 段间交通
 */

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const intercityDemo = args.includes('--intercity');
const openHoursDemo = args.includes('--open-hours');
const playbookDemo = args.includes('--playbook');

await import('../config/env.js');

if (offline) {
  process.env.AMAP_ENABLED = 'false';
}

const { enrichRouteDraft } = await import('../services/route-enricher.service.js');
const { retrievePlaybooksForPlanning } = await import('../services/playbook-rag.service.js');
import type { TravelIntentSnapshot } from '@douxing/shared';

const locale = args.includes('--locale')
  ? (args[args.indexOf('--locale') + 1] as 'zh-CN' | 'en-US' | undefined) ?? 'zh-CN'
  : 'zh-CN';

const intent: TravelIntentSnapshot = playbookDemo
  ? {
      city: '杭州',
      days: 1,
      budget: null,
      budgetMin: null,
      budgetMax: null,
      themes: ['文化', '自然'],
      confidence: 'high',
      lodgingArea: '西湖',
      lodgingTier: 'comfort',
      cities: ['杭州'],
    }
  : openHoursDemo
    ? {
        city: '北京',
        days: 1,
        budget: null,
        budgetMin: null,
        budgetMax: null,
        themes: ['文化', '历史'],
        confidence: 'high',
        lodgingTier: 'comfort',
        cities: ['北京'],
        startDate: '2026-06-15',
      }
  : intercityDemo
  ? {
      city: '杭州',
      days: 2,
      budget: null,
      budgetMin: null,
      budgetMax: null,
      themes: ['文化'],
      confidence: 'high',
      transportPreference: 'high_speed_rail',
      lodgingTier: 'comfort',
      cities: ['杭州', '上海'],
      startDate: '2026-06-15',
    }
  : {
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

const draft = playbookDemo
  ? {
      name: 'Enricher Demo · 西湖玩法',
      description: '玩法 RAG 段间交通演示',
      budgetRange: '2000-4000',
      days: 1,
      interestTags: ['文化'],
      sceneTags: [],
      matchedCity: '杭州',
      unlockPrice: 9.9,
      isAiGenerated: true,
      routeDetail: {
        days: [
          {
            date: '第1天',
            title: '西湖经典',
            attractions: [
              {
                name: '断桥残雪',
                time: '',
                cost: 0,
                description: '西湖十景',
                poiType: 'attraction',
                latitude: 30.258,
                longitude: 120.148,
              },
              {
                name: '苏堤',
                time: '',
                cost: 0,
                description: '漫步苏堤',
                poiType: 'attraction',
                latitude: 30.245,
                longitude: 120.138,
              },
              {
                name: '花港观鱼',
                time: '',
                cost: 0,
                description: '观鱼',
                poiType: 'attraction',
                latitude: 30.232,
                longitude: 120.135,
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
            ],
          },
        ],
      },
    }
  : openHoursDemo
    ? {
        name: 'Enricher Demo · 故宫闭馆',
        description: '开放时长与闭馆 conflict warning 演示',
        budgetRange: '1500-3000',
        days: 1,
        interestTags: ['文化', '历史'],
        sceneTags: [],
        matchedCity: '北京',
        unlockPrice: 9.9,
        isAiGenerated: true,
        routeDetail: {
          days: [
            {
              date: '第1天',
              calendarDate: '2026-06-15',
              title: '故宫文化',
              attractions: [
                {
                  name: '故宫博物院',
                  time: '',
                  cost: 60,
                  description: '紫禁城',
                  poiType: 'attraction',
                  latitude: 39.916,
                  longitude: 116.397,
                },
                {
                  name: '景山公园',
                  time: '',
                  cost: 2,
                  description: '俯瞰故宫',
                  poiType: 'attraction',
                  latitude: 39.925,
                  longitude: 116.397,
                },
              ],
            },
          ],
        },
      }
  : intercityDemo
  ? {
      name: 'Enricher Demo · 杭沪二日',
      description: '跨城班次演示',
      budgetRange: '2000-4000',
      days: 2,
      interestTags: ['文化'],
      sceneTags: [],
      matchedCity: '杭州',
      unlockPrice: 9.9,
      isAiGenerated: true,
      routeDetail: {
        days: [
          {
            date: '第1天',
            calendarDate: '2026-06-15',
            title: '杭州西湖',
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
            ],
          },
          {
            date: '第2天',
            calendarDate: '2026-06-16',
            title: '上海外滩',
            attractions: [
              {
                name: '外滩',
                time: '',
                cost: 0,
                description: '夜景',
                poiType: 'attraction',
                latitude: 31.24,
                longitude: 121.49,
              },
            ],
          },
        ],
      },
    }
  : {
      name: 'Enricher Demo · 杭州一日',
      description: '本地脚本测试',
      budgetRange: '2000-4000',
      days: 1,
      interestTags: ['文化'],
      sceneTags: [],
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

console.log(
  `[enricher-demo] 场景: ${
    playbookDemo
      ? 'playbook'
      : openHoursDemo
        ? 'open-hours'
        : intercityDemo
          ? 'intercity'
          : 'default'
  }`,
);
console.log(`[enricher-demo] 模式: ${offline ? 'offline（无高德）' : 'full（.env 高德+MySQL）'}`);
console.log(`[enricher-demo] locale: ${locale}`);

const playbooks = playbookDemo
  ? await retrievePlaybooksForPlanning({
      city: intent.city,
      themes: intent.themes,
      prompt: '杭州西湖经典一日游',
      dayTitle: '西湖经典',
    })
  : intercityDemo || openHoursDemo
    ? []
    : [];

if (playbookDemo) {
  console.log(
    `[enricher-demo] playbooks: ${playbooks.map((p) => p.playbook.scope).join(', ') || '无'}`,
  );
}

try {
  const enriched = await enrichRouteDraft(draft, { intent, locale, playbooks });

  for (let i = 0; i < enriched.routeDetail.days.length; i += 1) {
    const day = enriched.routeDetail.days[i]!;
    console.log(`\n=== 第 ${i + 1} 天 ===`);

    console.log('\n--- 住宿 ---');
    console.log(JSON.stringify(day.lodging, null, 2));

    console.log('\n--- 交通段 ---');
    for (const seg of day.transit ?? []) {
      console.log(
        `  ${seg.from} → ${seg.to} | ${seg.mode} | ${seg.durationMinutes}min | ${seg.time}${seg.scheduleNo ? ` | ${seg.scheduleNo}` : ''}${seg.estimated ? ' (估算)' : ''} | ${seg.description ?? ''}`,
      );
      if (seg.bookingUrl) {
        console.log(`    booking: ${seg.bookingUrl}`);
      }
    }

    console.log('\n--- 游玩时刻 ---');
    for (const spot of day.attractions) {
      console.log(`  ${spot.name}: ${spot.time}`);
    }

    if (day.warnings?.length) {
      console.log('\n--- 警告 ---');
      day.warnings.forEach((w) => console.log(`  ${w}`));
    }
  }

  console.log('\n[enricher-demo] 完成');
} catch (err) {
  console.error('[enricher-demo] 失败:', err instanceof Error ? err.message : err);
  process.exit(1);
}
