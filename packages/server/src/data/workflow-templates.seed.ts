import type { WorkflowTemplateInfo } from '@douxing/shared';

/**
 * W3-3 · 预置工作流模板（DB 空表时 seed 写入）。
 * 选择顺序：priority 降序，首条 JSON Logic 命中生效。
 */
export const WORKFLOW_TEMPLATE_SEEDS: WorkflowTemplateInfo[] = [
  {
    id: 'premium_multi',
    nameZh: '高端多城长线',
    nameEn: 'Premium multi-city',
    descriptionZh: '天数 >5 或多城市：更大 RAG 池、3 套方案、更多玩法动线',
    descriptionEn: 'Long or multi-city trips: larger RAG pool, 3 variants, more playbooks',
    version: 1,
    enabled: true,
    priority: 100,
    selectionRules: {
      or: [
        { '>': [{ var: 'days' }, 5] },
        { '>': [{ var: 'citiesCount' }, 1] },
      ],
    },
    nodeConfig: {
      topK: 20,
      variantCount: 3,
      playbookLimit: 5,
      mmrLambda: 0.65,
    },
    abVariantBId: null,
    abSplitPercent: 0,
    sortOrder: 10,
  },
  {
    id: 'budget_short',
    nameZh: '低预算短途',
    nameEn: 'Budget short trip',
    descriptionZh: '预算偏低或 budgetTier=low：topK=8，2 套精简方案',
    descriptionEn: 'Low budget: topK=8, 2 compact variants',
    version: 1,
    enabled: true,
    priority: 90,
    selectionRules: {
      or: [
        {
          and: [
            { '!=': [{ var: 'budgetMax' }, null] },
            { '<=': [{ var: 'budgetMax' }, 3000] },
          ],
        },
        { '==': [{ var: 'budgetTier' }, 'low'] },
      ],
    },
    nodeConfig: {
      topK: 8,
      variantCount: 2,
      playbookLimit: 2,
      mmrLambda: 0.75,
    },
    abVariantBId: 'standard_3d',
    abSplitPercent: 0,
    sortOrder: 20,
  },
  {
    id: 'standard_3d',
    nameZh: '标准 3 日国内',
    nameEn: 'Standard domestic',
    descriptionZh: '默认模板：topK=12，2 套方案',
    descriptionEn: 'Default: topK=12, 2 variants',
    version: 1,
    enabled: true,
    priority: 0,
    selectionRules: true,
    nodeConfig: {
      topK: 12,
      variantCount: 2,
      playbookLimit: 3,
    },
    abVariantBId: null,
    abSplitPercent: 0,
    sortOrder: 99,
  },
];

/** 兜底模板 ID（无规则命中时使用） */
export const DEFAULT_WORKFLOW_TEMPLATE_ID = 'standard_3d';
