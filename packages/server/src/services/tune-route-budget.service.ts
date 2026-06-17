/**
 * C7-b Step 4：按新预算约束校正路线 draft（Enricher/校验由 Agent graph 后续调用）
 */
import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import { enforceRouteConstraints } from './travel-intent.service.js';

export interface TuneRouteBudgetInput {
  draft: GeneratedRouteDraft;
  intent: TravelIntentSnapshot;
  locale?: LocaleCode;
}

export function tuneRouteBudget(input: TuneRouteBudgetInput): GeneratedRouteDraft {
  return enforceRouteConstraints(input.draft, input.intent);
}
