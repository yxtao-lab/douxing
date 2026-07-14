export {
  APP_TIMEZONE,
  DISPLAY_DATETIME_FORMAT,
  formatDisplayDateTime,
  formatDbDateTimeForApi,
  isDisplayDateTimeLike,
} from '@douxing/shared';

/** @deprecated 日志等管理端展示请使用 formatDbDateTimeForApi */
export { formatDbDateTimeForApi as toApiIsoDateTime } from '@douxing/shared';
