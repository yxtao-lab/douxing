import type { TravelIntentSnapshot } from '@douxing/shared';

import { getPlanCandidateCountByMemberLevel } from '@douxing/shared';



export interface PlanRouteVariantDef {

  key: string;

  label: string;

  hint: string;

}



const BASE_VARIANTS: PlanRouteVariantDef[] = [

  {

    key: 'classic',

    label: '方案 A · 经典均衡',

    hint: '经典必游景点，每天 2～3 个节点，节奏均衡，适合首次到访',

  },

  {

    key: 'culture',

    label: '方案 B · 文化深度',

    hint: '侧重博物馆、历史建筑、人文体验，减少购物点',

  },

  {

    key: 'relaxed',

    label: '方案 C · 休闲轻松',

    hint: '节奏放缓，减少跨区赶路，留出下午茶或自由活动时间',

  },

  {

    key: 'adventure',

    label: '方案 D · 小众探索',

    hint: '侧重街区漫步、小众打卡与本地体验，避开过度拥挤景点',

  },

  {

    key: 'premium',

    label: '方案 E · 品质优选',

    hint: '精选高口碑景点与品质餐饮，体验优先于打卡数量',

  },

];



const THEME_VARIANT_OVERRIDES: Record<string, Partial<PlanRouteVariantDef>> = {

  亲子: {

    key: 'family',

    label: '方案 B · 亲子友好',

    hint: '适合带娃：景点间距近、强度低、预留休息',

  },

  美食: {

    key: 'food',

    label: '方案 C · 美食探店',

    hint: '突出特色餐厅、小吃街与市集，安排用餐时段',

  },

  浪漫: {

    key: 'romantic',

    label: '方案 C · 浪漫约会',

    hint: '侧重夜景、江景、小众打卡与慢节奏体验',

  },

  户外: {

    key: 'outdoor',

    label: '方案 B · 户外自然',

    hint: '侧重自然风景、徒步或湿地等户外活动',

  },

};



/** 根据意图主题与会员配额生成方案变体定义 */

export function buildPlanRouteVariants(

  intent: TravelIntentSnapshot,

  candidateCount = getPlanCandidateCountByMemberLevel(0),

): PlanRouteVariantDef[] {

  const variants = BASE_VARIANTS.map((v) => ({ ...v }));



  for (const theme of intent.themes) {

    const override = THEME_VARIANT_OVERRIDES[theme];

    if (!override) continue;

    if (theme === '亲子' || theme === '户外') {

      variants[1] = { ...variants[1], ...override };

    } else {

      variants[2] = { ...variants[2], ...override };

    }

  }



  const safeCount = Math.max(1, Math.min(candidateCount, variants.length));

  return variants.slice(0, safeCount);

}



/** @deprecated 使用 getPlanCandidateCountByMemberLevel */

export const PLAN_CANDIDATE_COUNT = 2;


