/**
 * H9+-1：TOP 10 旅游城市与 Playbook RAG 检索验收用例
 * 与 agent-equivalence-cases 前 10 城对齐
 */

export const PLAYBOOK_TOP_10_CITIES = [
  '杭州',
  '北京',
  '成都',
  '上海',
  '西安',
  '厦门',
  '重庆',
  '苏州',
  '广州',
  '南京',
] as const;

export type PlaybookTopCity = (typeof PLAYBOOK_TOP_10_CITIES)[number];

export interface PlaybookRetrievalCase {
  id: string;
  prompt: string;
  city: PlaybookTopCity;
  themes: string[];
  /** 期望命中的 playbook id（须在 top-N 内） */
  expectPlaybookId: string;
}

/** 每城至少 1 条检索用例，用于命中率观测 */
export const PLAYBOOK_RETRIEVAL_CASES: PlaybookRetrievalCase[] = [
  {
    id: 'hz-west-lake',
    prompt: '杭州3天西湖断桥苏堤雷峰塔',
    city: '杭州',
    themes: ['文化', '自然'],
    expectPlaybookId: 'hangzhou-west-lake',
  },
  {
    id: 'hz-lingyin',
    prompt: '灵隐寺龙井村品茶一日游',
    city: '杭州',
    themes: ['文化', '美食'],
    expectPlaybookId: 'hangzhou-lingyin-tea',
  },
  {
    id: 'bj-palace',
    prompt: '北京故宫太和殿乾清宫',
    city: '北京',
    themes: ['历史', '文化'],
    expectPlaybookId: 'beijing-forbidden-city',
  },
  {
    id: 'bj-wall',
    prompt: '慕田峪长城一日游',
    city: '北京',
    themes: ['历史', '自然'],
    expectPlaybookId: 'beijing-mutianyu',
  },
  {
    id: 'sh-bund',
    prompt: '上海外滩南京路豫园老城',
    city: '上海',
    themes: ['都市', '夜景'],
    expectPlaybookId: 'shanghai-bund',
  },
  {
    id: 'cd-classic',
    prompt: '成都熊猫基地宽窄巷子锦里',
    city: '成都',
    themes: ['美食', '休闲'],
    expectPlaybookId: 'chengdu-classic',
  },
  {
    id: 'xa-terra',
    prompt: '西安兵马俑华清池东线',
    city: '西安',
    themes: ['历史', '文化'],
    expectPlaybookId: 'xian-terracotta',
  },
  {
    id: 'nj-confucius',
    prompt: '南京夫子庙秦淮河中山陵',
    city: '南京',
    themes: ['历史', '文化'],
    expectPlaybookId: 'nanjing-confucius',
  },
  {
    id: 'sz-garden',
    prompt: '苏州拙政园平江路园林',
    city: '苏州',
    themes: ['文化', '休闲'],
    expectPlaybookId: 'suzhou-gardens',
  },
  {
    id: 'cq-night',
    prompt: '重庆洪崖洞解放碑夜景',
    city: '重庆',
    themes: ['美食', '夜景'],
    expectPlaybookId: 'chongqing-jiefangbei',
  },
  {
    id: 'gz-canton',
    prompt: '广州陈家祠上下九早茶',
    city: '广州',
    themes: ['美食', '文化'],
    expectPlaybookId: 'guangzhou-canton',
  },
  {
    id: 'xm-island',
    prompt: '厦门鼓浪屿日光岩轮渡',
    city: '厦门',
    themes: ['休闲', '自然'],
    expectPlaybookId: 'xiamen-gulangyu',
  },
];

/** 检索 top-N 内命中期望 playbook 的最低比例 */
export const PLAYBOOK_RETRIEVAL_MIN_HIT_RATE = 1;

/** classicOrder / 段间端点名与 C3 景点库对齐的最低比例 */
export const PLAYBOOK_ALIAS_MIN_COVERAGE = 0.85;
