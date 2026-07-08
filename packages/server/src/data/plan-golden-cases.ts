/**
 * W4-1 · 规划 Golden Case 数据集（≥30 条）。
 * 覆盖：模板选择、意图路由、意图解析、工作流 Tool 链（RAG topK）。
 */

/** Golden Case 期望断言 */
export interface PlanGoldenCaseExpect {
  /** 期望命中工作流模板 ID */
  templateId?: string;
  /** 期望意图路由（追问类） */
  routedIntent?: string;
  /** 解析后的天数 */
  intentDays?: number;
  /** 解析后的主城市（不含「市」后缀比较） */
  intentCity?: string;
  /** RAG 命中下限（--with-rag 且 DB 可用时） */
  minRagHits?: number;
  /** RAG 命中上限（默认取模板 topK） */
  maxRagHits?: number;
  /** plan_new 主链应包含的 Tool 名（--with-rag） */
  toolChainIncludes?: string[];
}

/** 单条 Golden Case */
export interface PlanGoldenCase {
  id: string;
  category: 'template' | 'intent_route' | 'intent_parse' | 'workflow_chain';
  prompt: string;
  days?: number;
  budget?: string;
  budgetMax?: number;
  budgetMin?: number;
  city?: string;
  cities?: string[];
  themes?: string[];
  /** 模拟追问时的 routedIntent（workflow_chain 用） */
  followUpRoutedIntent?: string;
  expect: PlanGoldenCaseExpect;
}

/** W4 Golden 数据集（34 条） */
export const PLAN_GOLDEN_CASES: PlanGoldenCase[] = [
  // —— 模板选择 · 低预算 ——
  {
    id: 'tpl-cd-budget-3d',
    category: 'template',
    prompt: '成都3天美食，预算2000以内',
    city: '成都',
    days: 3,
    budgetMax: 2000,
    themes: ['美食'],
    expect: { templateId: 'budget_short', intentDays: 3, intentCity: '成都' },
  },
  {
    id: 'tpl-sz-budget-low',
    category: 'template',
    prompt: '深圳2天穷游',
    city: '深圳',
    days: 2,
    budgetMax: 1500,
    expect: { templateId: 'budget_short' },
  },
  {
    id: 'tpl-cq-budget-text',
    category: 'template',
    prompt: '重庆3天低预算火锅',
    city: '重庆',
    days: 3,
    budget: '低预算',
    expect: { templateId: 'budget_short' },
  },
  {
    id: 'tpl-gz-budget-max',
    category: 'template',
    prompt: '广州3天早茶',
    city: '广州',
    days: 3,
    budgetMax: 2800,
    expect: { templateId: 'budget_short' },
  },
  {
    id: 'tpl-hz-budget-edge',
    category: 'template',
    prompt: '杭州3天西湖',
    city: '杭州',
    days: 3,
    budgetMax: 3000,
    expect: { templateId: 'budget_short' },
  },
  // —— 模板选择 · 标准 ——
  {
    id: 'tpl-hz-standard-3d',
    category: 'template',
    prompt: '杭州3天文化之旅，预算5000',
    city: '杭州',
    days: 3,
    budgetMax: 5000,
    themes: ['文化'],
    expect: { templateId: 'standard_3d', intentDays: 3, intentCity: '杭州' },
  },
  {
    id: 'tpl-sh-standard',
    category: 'template',
    prompt: '上海3天城市漫步外滩陆家嘴',
    city: '上海',
    days: 3,
    budgetMax: 6000,
    expect: { templateId: 'standard_3d' },
  },
  {
    id: 'tpl-nj-standard',
    category: 'template',
    prompt: '南京3天民国文化中山陵',
    city: '南京',
    days: 3,
    budgetMax: 4500,
    expect: { templateId: 'standard_3d' },
  },
  {
    id: 'tpl-xm-standard',
    category: 'template',
    prompt: '厦门3天鼓浪屿休闲',
    city: '厦门',
    days: 3,
    budgetMax: 4000,
    expect: { templateId: 'standard_3d' },
  },
  {
    id: 'tpl-cs-standard',
    category: 'template',
    prompt: '长沙2天湘菜橘子洲',
    city: '长沙',
    days: 2,
    budgetMax: 3500,
    expect: { templateId: 'standard_3d' },
  },
  // —— 模板选择 · 高端/多城/长线 ——
  {
    id: 'tpl-bj-premium-6d',
    category: 'template',
    prompt: '北京6天亲子故宫长城',
    city: '北京',
    days: 6,
    budgetMax: 12000,
    expect: { templateId: 'premium_multi' },
  },
  {
    id: 'tpl-sy-premium-5d',
    category: 'template',
    prompt: '三亚6天度假亚龙湾',
    city: '三亚',
    days: 6,
    budgetMax: 15000,
    expect: { templateId: 'premium_multi' },
  },
  {
    id: 'tpl-multi-cd-cq',
    category: 'template',
    prompt: '成都重庆4天美食之旅',
    cities: ['成都', '重庆'],
    days: 4,
    budgetMax: 8000,
    expect: { templateId: 'premium_multi' },
  },
  {
    id: 'tpl-multi-sh-hz',
    category: 'template',
    prompt: '上海杭州5天江南游',
    cities: ['上海', '杭州'],
    days: 5,
    expect: { templateId: 'premium_multi' },
  },
  // —— 意图路由 · 追问分支 ——
  {
    id: 'route-budget-tune',
    category: 'intent_route',
    prompt: '预算降到3000以内',
    expect: { routedIntent: 'budget_tune' },
  },
  {
    id: 'route-lodging-tune',
    category: 'intent_route',
    prompt: '想住西湖边经济型酒店',
    expect: { routedIntent: 'lodging_tune' },
  },
  {
    id: 'route-qa-food',
    category: 'intent_route',
    prompt: '成都有什么好吃的',
    expect: { routedIntent: 'qa_food' },
  },
  {
    id: 'route-select-variant-b',
    category: 'intent_route',
    prompt: '就方案B',
    expect: { routedIntent: 'select_variant' },
  },
  {
    id: 'route-tweak-day',
    category: 'intent_route',
    prompt: '第三天轻松一点',
    expect: { routedIntent: 'tweak_day' },
  },
  {
    id: 'route-tweak-poi',
    category: 'intent_route',
    prompt: '不要灵隐寺，换个小众景点',
    expect: { routedIntent: 'tweak_poi' },
  },
  {
    id: 'route-plan-new',
    category: 'intent_route',
    prompt: '帮我规划杭州3天',
    expect: { routedIntent: 'plan_new' },
  },
  {
    id: 'route-budget-tune-2',
    category: 'intent_route',
    prompt: '总预算控制在5000',
    expect: { routedIntent: 'budget_tune' },
  },
  {
    id: 'route-qa-food-2',
    category: 'intent_route',
    prompt: '附近有什么好吃的餐厅',
    expect: { routedIntent: 'qa_food' },
  },
  {
    id: 'route-select-variant-a',
    category: 'intent_route',
    prompt: '选方案A',
    expect: { routedIntent: 'select_variant' },
  },
  // —— 意图解析 ——
  {
    id: 'parse-hz-3d',
    category: 'intent_parse',
    prompt: '杭州3天文化之旅，预算3000左右，想逛西湖和灵隐寺',
    expect: { intentDays: 3, intentCity: '杭州' },
  },
  {
    id: 'parse-bj-5d',
    category: 'intent_parse',
    prompt: '北京5天亲子游，故宫、长城',
    expect: { intentDays: 5, intentCity: '北京' },
  },
  {
    id: 'parse-cd-2d',
    category: 'intent_parse',
    prompt: '成都2天美食休闲，宽窄巷子火锅',
    expect: { intentDays: 2, intentCity: '成都' },
  },
  {
    id: 'parse-xa-4d',
    category: 'intent_parse',
    prompt: '西安4天历史探秘，兵马俑回民街',
    expect: { intentDays: 4, intentCity: '西安' },
  },
  {
    id: 'parse-gl-3d',
    category: 'intent_parse',
    prompt: '桂林3天山水阳朔西街',
    expect: { intentDays: 3, intentCity: '桂林' },
  },
  {
    id: 'parse-qd-3d',
    category: 'intent_parse',
    prompt: '青岛3天海滨啤酒节栈桥',
    expect: { intentDays: 3, intentCity: '青岛' },
  },
  {
    id: 'parse-wh-2d',
    category: 'intent_parse',
    prompt: '武汉2天樱花季东湖黄鹤楼',
    expect: { intentDays: 2, intentCity: '武汉' },
  },
  {
    id: 'parse-lj-3d',
    category: 'intent_parse',
    prompt: '丽江3天古城玉龙雪山',
    expect: { intentDays: 3, intentCity: '丽江' },
  },
  {
    id: 'parse-dl-3d',
    category: 'intent_parse',
    prompt: '大连3天海滨老虎滩',
    expect: { intentDays: 3, intentCity: '大连' },
  },
  {
    id: 'parse-km-4d',
    category: 'intent_parse',
    prompt: '昆明4天云南慢生活石林',
    expect: { intentDays: 4, intentCity: '昆明' },
  },
  // —— 工作流 Tool 链（需 DB + --with-rag） ——
  {
    id: 'chain-hz-standard-rag',
    category: 'workflow_chain',
    prompt: '杭州3天文化西湖灵隐寺',
    city: '杭州',
    days: 3,
    budgetMax: 5000,
    followUpRoutedIntent: 'plan_new',
    expect: {
      templateId: 'standard_3d',
      maxRagHits: 12,
      minRagHits: 1,
      toolChainIncludes: ['select_workflow_template', 'retrieve_attractions'],
    },
  },
  {
    id: 'chain-cd-budget-rag',
    category: 'workflow_chain',
    prompt: '成都3天美食预算2000',
    city: '成都',
    days: 3,
    budgetMax: 2000,
    followUpRoutedIntent: 'plan_new',
    expect: {
      templateId: 'budget_short',
      maxRagHits: 8,
      minRagHits: 1,
      toolChainIncludes: ['select_workflow_template', 'retrieve_attractions'],
    },
  },
  {
    id: 'chain-bj-premium-rag',
    category: 'workflow_chain',
    prompt: '北京6天亲子游故宫长城',
    city: '北京',
    days: 6,
    budgetMax: 10000,
    followUpRoutedIntent: 'plan_new',
    expect: {
      templateId: 'premium_multi',
      maxRagHits: 20,
      minRagHits: 1,
      toolChainIncludes: ['select_workflow_template', 'retrieve_attractions'],
    },
  },
  {
    id: 'chain-sh-standard-rag',
    category: 'workflow_chain',
    prompt: '上海3天外滩陆家嘴',
    city: '上海',
    days: 3,
    budgetMax: 6000,
    followUpRoutedIntent: 'plan_new',
    expect: {
      templateId: 'standard_3d',
      maxRagHits: 12,
      toolChainIncludes: ['select_workflow_template', 'retrieve_attractions'],
    },
  },
];
