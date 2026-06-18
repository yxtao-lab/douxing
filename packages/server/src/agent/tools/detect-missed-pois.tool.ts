import { isApiError, type LocaleCode } from '@douxing/shared';
import { analyzeRouteMissedPois } from '../../services/missed-poi.service.js';
import { detectMissedPoisInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runDetectMissedPoisTool(raw: unknown) {
  const parsed = detectMissedPoisInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  try {
    const result = await analyzeRouteMissedPois({
      routeId: parsed.data.routeId,
      userId: parsed.data.userId,
      dayIndex: parsed.data.dayIndex,
      currentTimeMinutes: parsed.data.currentTimeMinutes,
      locale: parsed.data.locale as LocaleCode | undefined,
      includeAlternatives: parsed.data.includeAlternatives,
      autoRecordRegrets: parsed.data.autoRecordRegrets,
    });
    return toolSuccess(result);
  } catch (err) {
    if (isApiError(err)) {
      return toolFail(err.messageKey, 'ROUTE_ERROR');
    }
    const message = err instanceof Error ? err.message : 'detect_missed_pois failed';
    return toolFail(message, 'TOOL_ERROR');
  }
}
