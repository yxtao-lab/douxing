import type {
  PlaybookTransitReasonKey,
  RoutePlaybookInfo,
  RoutePlaybookSegmentEdge,
  RouteTransitMode,
} from '@douxing/shared';

export type { PlaybookTransitReasonKey, RoutePlaybookSegmentEdge };
export type RoutePlaybook = Omit<RoutePlaybookInfo, 'enabled' | 'sortOrder'>;

/** H9-4 / H9+-1：玩法动线 seed（写入 DB，供 RAG 与管理端维护） */
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
  {
    id: 'chengdu-classic',
    city: '成都',
    scope: '成都经典',
    keywords: ['成都', '熊猫', '宽窄巷子', '锦里', '人民公园'],
    themes: ['美食', '休闲', '亲子'],
    classicOrder: ['大熊猫繁育研究基地', '宽窄巷子', '人民公园', '锦里古街'],
    summaryZh: '成都休闲线：早看熊猫 → 宽窄巷子午餐 → 人民公园喝茶 → 锦里夜游；段间以打车为主。',
    summaryEn:
      'Chengdu leisure loop: Panda Base morning → Wide & Narrow Alleys → People\'s Park tea → Jinli evening; taxi between districts.',
    segments: [
      {
        from: '大熊猫繁育研究基地',
        to: '宽窄巷子',
        mode: 'taxi',
        reasonKey: 'taxiShort',
        fromAliases: ['熊猫基地'],
      },
      { from: '宽窄巷子', to: '人民公园', mode: 'taxi', reasonKey: 'taxiShort' },
      { from: '人民公园', to: '锦里古街', mode: 'taxi', reasonKey: 'taxiShort', toAliases: ['锦里'] },
    ],
  },
  {
    id: 'beijing-mutianyu',
    city: '北京',
    scope: '慕田峪长城',
    keywords: ['长城', '慕田峪', '八达岭'],
    themes: ['历史', '自然'],
    classicOrder: ['慕田峪长城'],
    summaryZh: '慕田峪一日：市区打车/包车至慕田峪，景区内步行登城；建议早出发避开拥堵。',
    summaryEn:
      'Mutianyu day trip: taxi or chartered car from downtown, walk on the wall; leave early to avoid traffic.',
    segments: [],
  },
  {
    id: 'hangzhou-lingyin-tea',
    city: '杭州',
    scope: '灵隐龙井',
    keywords: ['灵隐寺', '龙井', '龙井村', '飞来峰'],
    themes: ['文化', '美食', '自然'],
    classicOrder: ['灵隐寺', '飞来峰', '龙井村'],
    summaryZh: '禅茶一日：灵隐寺礼佛 → 飞来峰石刻 → 龙井村品茶；景区间步行或短途观光车。',
    summaryEn:
      'Temple and tea: Lingyin Temple → Feilai Peak → Longjing Village tea tasting; walk or shuttle between sites.',
    segments: [
      { from: '灵隐寺', to: '飞来峰', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '飞来峰', to: '龙井村', mode: 'bus', reasonKey: 'sightseeingBus', toAliases: ['龙井'] },
    ],
  },
  {
    id: 'xian-terracotta',
    city: '西安',
    scope: '兵马俑',
    keywords: ['兵马俑', '秦始皇帝陵', '华清池'],
    themes: ['历史', '文化'],
    classicOrder: ['秦始皇兵马俑博物馆', '华清宫'],
    summaryZh: '东线经典：兵马俑博物馆 → 华清宫；市区至临潼建议打车或旅游专线。',
    summaryEn:
      'East line: Terracotta Army Museum → Huaqing Palace; taxi or tour bus from downtown to Lintong.',
    segments: [
      {
        from: '秦始皇兵马俑博物馆',
        to: '华清宫',
        mode: 'taxi',
        reasonKey: 'taxiShort',
        fromAliases: ['兵马俑'],
        toAliases: ['华清池'],
      },
    ],
  },
  {
    id: 'nanjing-confucius',
    city: '南京',
    scope: '夫子庙秦淮河',
    keywords: ['夫子庙', '秦淮河', '中山陵', '玄武湖'],
    themes: ['文化', '历史'],
    classicOrder: ['夫子庙', '秦淮河', '中山陵'],
    summaryZh: '金陵文化线：夫子庙秦淮风光 → 中山陵；老城步行，至紫金山段建议打车或地铁。',
    summaryEn:
      'Nanjing culture: Confucius Temple & Qinhuai → Sun Yat-sen Mausoleum; walk in old town, taxi or metro to Purple Mountain.',
    segments: [
      { from: '夫子庙', to: '秦淮河', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '秦淮河', to: '中山陵', mode: 'taxi', reasonKey: 'taxiShort' },
    ],
  },
  {
    id: 'suzhou-gardens',
    city: '苏州',
    scope: '古典园林',
    keywords: ['拙政园', '狮子林', '平江路', '苏州博物馆'],
    themes: ['文化', '休闲'],
    classicOrder: ['拙政园', '苏州博物馆', '平江路'],
    summaryZh: '园林古城：拙政园 → 苏博 → 平江路历史街区；古城区以步行为主。',
    summaryEn:
      'Classical gardens: Humble Administrator\'s Garden → Suzhou Museum → Pingjiang Road; mostly walking in the old town.',
    segments: [
      { from: '拙政园', to: '苏州博物馆', mode: 'walk', reasonKey: 'classicWalk', toAliases: ['苏博'] },
      { from: '苏州博物馆', to: '平江路', mode: 'walk', reasonKey: 'scenicWalk' },
    ],
  },
  {
    id: 'chongqing-jiefangbei',
    city: '重庆',
    scope: '解放碑洪崖洞',
    keywords: ['解放碑', '洪崖洞', '磁器口', '长江索道'],
    themes: ['美食', '夜景', '都市'],
    classicOrder: ['解放碑', '洪崖洞', '磁器口古镇'],
    summaryZh: '山城夜景线：解放碑 → 洪崖洞夜景 → 磁器口；短距步行，跨江段可索道或打车。',
    summaryEn:
      'Mountain city night views: Jiefangbei → Hongyadong → Ciqikou; walk locally, cable car or taxi across the river.',
    segments: [
      { from: '解放碑', to: '洪崖洞', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '洪崖洞', to: '磁器口古镇', mode: 'taxi', reasonKey: 'taxiShort', toAliases: ['磁器口'] },
    ],
  },
  {
    id: 'guangzhou-canton',
    city: '广州',
    scope: '老城文化',
    keywords: ['陈家祠', '沙面', '上下九', '北京路'],
    themes: ['文化', '美食'],
    classicOrder: ['陈家祠', '沙面', '上下九步行街'],
    summaryZh: '西关风情：陈家祠 → 沙面岛 → 上下九；老城段步行，跨区可地铁。',
    summaryEn:
      'Cantonese heritage: Chen Clan Academy → Shamian Island → Shangxiajiu; walk in old districts, metro between areas.',
    segments: [
      { from: '陈家祠', to: '沙面', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '沙面', to: '上下九步行街', mode: 'walk', reasonKey: 'scenicWalk', toAliases: ['上下九'] },
    ],
  },
  {
    id: 'xiamen-gulangyu',
    city: '厦门',
    scope: '鼓浪屿',
    keywords: ['鼓浪屿', '日光岩', '菽庄花园', '轮渡'],
    themes: ['休闲', '文化', '自然'],
    classicOrder: ['轮渡码头', '日光岩', '菽庄花园'],
    summaryZh: '鼓浪屿一日：轮渡上岛 → 日光岩 → 菽庄花园；岛内全程步行。',
    summaryEn:
      'Gulangyu island: ferry → Sunlight Rock → Shuzhuang Garden; all on foot on the island.',
    segments: [
      { from: '轮渡码头', to: '日光岩', mode: 'walk', reasonKey: 'classicWalk' },
      { from: '日光岩', to: '菽庄花园', mode: 'walk', reasonKey: 'scenicWalk' },
    ],
  },
];

const VALID_MODES = new Set<RouteTransitMode>([
  'train',
  'flight',
  'subway',
  'bus',
  'taxi',
  'walk',
  'drive',
]);

const VALID_REASON_KEYS = new Set<PlaybookTransitReasonKey>([
  'classicWalk',
  'scenicWalk',
  'sightseeingBus',
  'ferry',
  'taxiShort',
]);

/** 校验段间边结构（管理端/API 写入前） */
export function assertValidPlaybookSegments(segments: RoutePlaybookSegmentEdge[]): void {
  for (const seg of segments) {
    if (!seg.from?.trim() || !seg.to?.trim()) {
      throw new Error('segment from/to required');
    }
    if (!VALID_MODES.has(seg.mode)) {
      throw new Error(`invalid segment mode: ${seg.mode}`);
    }
    if (!VALID_REASON_KEYS.has(seg.reasonKey)) {
      throw new Error(`invalid segment reasonKey: ${seg.reasonKey}`);
    }
  }
}
