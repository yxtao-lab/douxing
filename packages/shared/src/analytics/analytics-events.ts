/** DT3 · 客户端埋点事件名（与 analytics_events.event_name 对齐） */
export const AnalyticsEventName = {
  APP_LAUNCH: 'app.launch',
  PLAN_PAGE_VIEW: 'plan.page_view',
  PLAN_PROMPT_SUBMIT: 'plan.prompt_submit',
  PLAN_SESSION_CREATED: 'plan.session_created',
  PLAN_ROUTE_SAVED: 'plan.route_saved',
  ROUTE_VIEW: 'route.view',
  ROUTE_PUBLISH: 'route.publish',
  CHECKIN_CREATE: 'checkin.create',
  SHARE_ROUTE: 'share.route',
} as const;

export type AnalyticsEventNameValue =
  (typeof AnalyticsEventName)[keyof typeof AnalyticsEventName];

/** 客户端允许上报的事件白名单 */
export const CLIENT_ANALYTICS_EVENT_NAMES: readonly AnalyticsEventNameValue[] =
  Object.values(AnalyticsEventName);

const CLIENT_EVENT_SET = new Set<string>(CLIENT_ANALYTICS_EVENT_NAMES);

export function isClientAnalyticsEventName(name: string): name is AnalyticsEventNameValue {
  return CLIENT_EVENT_SET.has(name);
}

/** 旅程漏斗步骤（管理端展示顺序） */
export const ANALYTICS_FUNNEL_STEPS: ReadonlyArray<{
  stepKey: string;
  eventName: AnalyticsEventNameValue;
}> = [
  { stepKey: 'planPage', eventName: AnalyticsEventName.PLAN_PAGE_VIEW },
  { stepKey: 'planSubmit', eventName: AnalyticsEventName.PLAN_PROMPT_SUBMIT },
  { stepKey: 'planSession', eventName: AnalyticsEventName.PLAN_SESSION_CREATED },
  { stepKey: 'routeSaved', eventName: AnalyticsEventName.PLAN_ROUTE_SAVED },
  { stepKey: 'routePublish', eventName: AnalyticsEventName.ROUTE_PUBLISH },
  { stepKey: 'checkin', eventName: AnalyticsEventName.CHECKIN_CREATE },
];
