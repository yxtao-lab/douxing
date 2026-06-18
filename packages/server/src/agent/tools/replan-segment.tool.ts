import { ApiError, isApiError, type LocaleCode } from '@douxing/shared';
import { replanSegment } from '../../services/replan-segment.service.js';
import { replanSegmentInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runReplanSegmentTool(raw: unknown) {
  const parsed = replanSegmentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  try {
    const result = await replanSegment({
      routeId: parsed.data.routeId,
      userId: parsed.data.userId,
      locale: parsed.data.locale as LocaleCode | undefined,
      context: parsed.data.context,
    });
    return toolSuccess(result);
  } catch (err) {
    if (isApiError(err)) {
      return toolFail(err.messageKey, 'ROUTE_ERROR');
    }
    const message = err instanceof Error ? err.message : 'replan_segment failed';
    return toolFail(message, 'TOOL_ERROR');
  }
}
