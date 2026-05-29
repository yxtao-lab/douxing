import type { RouteTransitMode } from '@douxing/shared';

/** H9-4：玩法段间交通建议 */
export type PlaybookTransitReasonKey =
  | 'classicWalk'
  | 'scenicWalk'
  | 'sightseeingBus'
  | 'ferry'
  | 'taxiShort';

export interface PlaybookSegmentEdge {
  from: string;
  to: string;
  mode: RouteTransitMode;
  reasonKey: PlaybookTransitReasonKey;
  fromAliases?: string[];
  toAliases?: string[];
}

/** H9-4：经典玩法动线 */
export interface RoutePlaybook {
  id: string;
  city: string;
  /** 如「西湖景区」 */
  scope: string;
  keywords: string[];
  themes: string[];
  classicOrder: string[];
  segments: PlaybookSegmentEdge[];
  summaryZh: string;
  summaryEn: string;
}

export const ROUTE_PLAYBOOKS: RoutePlaybook[] = [
  {
    id: 'hangzhou-west-lake',
    city: '杭州',
    scope: '西湖景区',
    keywords: ['西湖', '断桥', '苏堤', '雷峰塔', '白堤', '孤山', '花港', '三潭'],
    themes: ['文化', '自然', '休闲'],
    classicOrder: ['断桥残雪', '白堤', '孤山', '苏堤', '花港观鱼', '雷峰塔'],
    summaryZh:
      '西湖经典环湖动线：断桥入湖 → 白堤 → 孤山 → 苏堤漫步 → 花港 → 雷峰塔；湖区内以步行为主，长段可观光车。',
    summaryEn:
      'Classic West Lake loop: Broken Bridge → Bai Causeway → Solitary Hill → Su Causeway → Flower Harbor → Leifeng Pagoda; mostly on foot, shuttle for longer legs.',
    segments: [
      {
        from: '断桥残雪',
        to: '白堤',
        mode: 'walk',
        reasonKey: 'classicWalk',
        fromAliases: ['断桥'],
      },
      { from: '白堤', to: '孤山', mode: 'walk', reasonKey: 'scenicWalk' },
      { from: '孤山', to: '苏堤', mode: 'walk', reasonKey: 'scenicWalk', toAliases: ['苏堤春晓'] },
      {
        from: '苏堤',
        to: '花港观鱼',
        mode: 'walk',
        reasonKey: 'scenicWalk',
        fromAliases: ['苏堤春晓'],
        toAliases: ['花港'],
      },
      {
        from: '花港观鱼',
        to: '雷峰塔',
        mode: 'bus',
        reasonKey: 'sightseeingBus',
        fromAliases: ['花港'],
        toAliases: ['雷峰'],
      },
      {
        from: '雷峰塔',
        to: '西湖',
        mode: 'walk',
        reasonKey: 'scenicWalk',
        fromAliases: ['雷峰'],
      },
    ],
  },
  {
    id: 'beijing-forbidden-city',
    city: '北京',
    scope: '故宫博物院',
    keywords: ['故宫', '紫禁城', '太和殿', '午门', '神武门'],
    themes: ['文化', '历史'],
    classicOrder: ['午门', '太和殿', '乾清宫', '御花园', '神武门'],
    summaryZh: '故宫中轴线：午门入宫 → 太和殿 → 乾清宫 → 御花园 → 神武门出；全程步行参观。',
    summaryEn:
      'Forbidden City central axis: Meridian Gate → Hall of Supreme Harmony → Palace of Heavenly Purity → Imperial Garden → Gate of Divine Prowess; all on foot.',
    segments: [
      { from: '午门', to: '太和殿', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '太和殿', to: '乾清宫', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '乾清宫', to: '御花园', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '御花园', to: '神武门', mode: 'walk', reasonKey: 'classicWalk' },
    ],
  },
  {
    id: 'shanghai-bund',
    city: '上海',
    scope: '外滩商圈',
    keywords: ['外滩', '南京路', '豫园', '陆家嘴'],
    themes: ['都市', '夜景', '购物'],
    classicOrder: ['外滩', '南京路步行街', '豫园'],
    summaryZh: '外滩至老城：外滩滨江步行 → 南京路步行街 → 豫园；短距可步行或打车。',
    summaryEn:
      'Bund to old town: Bund promenade walk → Nanjing Road → Yu Garden; short hops by walk or taxi.',
    segments: [
      { from: '外滩', to: '南京路步行街', mode: 'walk', reasonKey: 'classicWalk', toAliases: ['南京路'] },
      {
        from: '南京路步行街',
        to: '豫园',
        mode: 'taxi',
        reasonKey: 'taxiShort',
        fromAliases: ['南京路'],
      },
    ],
  },
];
