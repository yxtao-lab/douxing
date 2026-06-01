import './config/env.js';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { uploadsDir } from './routes/users.js';
import { checkInPhotosDir } from './routes/checkins.js';
import { attractionCoversDir } from './routes/attractions.js';
import { APP_NAME, API_PREFIX } from '@douxing/shared';
import { startOrderTimeoutJob } from './jobs/order-timeout.job.js';
import { wechatPayNotifyHandler } from './routes/payments.js';
import { getCheckinConfigSummary } from './config/checkin.js';
import { getRouteUnlockConfigSummary } from './config/route-unlock.js';
import { getConfiguredPublicBase } from './utils/public-asset-url.util.js';
import { localeMiddleware } from './middleware/locale.js';
import { success } from './utils/response.js';
import { ApiMessageKey } from '@douxing/shared';

const app = express();
const port = Number(process.env.SERVER_PORT) || 3000;

// Nginx 反代后信任 X-Forwarded-*，保证 req.protocol / 公开 URL 正确
app.set('trust proxy', 1);

app.use(cors());
app.post(
  `${API_PREFIX}/payments/wechat/notify`,
  express.raw({ type: 'application/json' }),
  wechatPayNotifyHandler,
);
app.use(express.json());
app.use(localeMiddleware);
app.use('/uploads/avatars', express.static(uploadsDir));
app.use('/uploads/checkins', express.static(checkInPhotosDir));
app.use('/uploads/attractions', express.static(attractionCoversDir));
app.use(routes);

app.get('/', (_req, res) => {
  success(res, { name: APP_NAME, status: 'ok' }, ApiMessageKey.SERVER_RUNNING);
});

app.listen(port, () => {
  startOrderTimeoutJob();
  const checkinConfig = getCheckinConfigSummary();
  const routeUnlockConfig = getRouteUnlockConfigSummary();
  console.log(`[server] ${APP_NAME} API listening on http://localhost:${port}`);
  console.log(
    `[checkin] 地理围栏 ${checkinConfig.geofenceEnabled ? '已启用' : '已关闭'}（CHECKIN_GEOFENCE_ENABLED=${checkinConfig.rawGeofenceEnv ?? '未设置，默认 true'}）`,
  );
  console.log(
    `[route-unlock] 解锁支付 ${routeUnlockConfig.paymentRequired ? '已启用' : '已关闭'}（ROUTE_UNLOCK_PAYMENT_REQUIRED=${routeUnlockConfig.rawEnv ?? '未设置，默认 false'}）`,
  );
  const publicBase = getConfiguredPublicBase();
  console.log(
    `[assets] 静态资源公网基址 ${publicBase ?? '未设置 API_PUBLIC_BASE_URL(_DVE/_PROD)，接口返回 uploads 相对路径'}`,
  );
});
