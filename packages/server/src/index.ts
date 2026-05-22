import './config/env.js';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { uploadsDir } from './routes/users.js';
import { checkInPhotosDir } from './routes/checkins.js';
import { APP_NAME, API_PREFIX } from '@douxing/shared';
import { startOrderTimeoutJob } from './jobs/order-timeout.job.js';
import { wechatPayNotifyHandler } from './routes/payments.js';
import { getCheckinConfigSummary } from './config/checkin.js';

const app = express();
const port = Number(process.env.SERVER_PORT) || 3000;

app.use(cors());
app.post(
  `${API_PREFIX}/payments/wechat/notify`,
  express.raw({ type: 'application/json' }),
  wechatPayNotifyHandler,
);
app.use(express.json());
app.use('/uploads/avatars', express.static(uploadsDir));
app.use('/uploads/checkins', express.static(checkInPhotosDir));
app.use(routes);

app.get('/', (_req, res) => {
  res.json({ name: APP_NAME, message: '兜行 API 服务运行中' });
});

app.listen(port, () => {
  startOrderTimeoutJob();
  const checkinConfig = getCheckinConfigSummary();
  console.log(`[server] ${APP_NAME} API listening on http://localhost:${port}`);
  console.log(
    `[checkin] 地理围栏 ${checkinConfig.geofenceEnabled ? '已启用' : '已关闭'}（CHECKIN_GEOFENCE_ENABLED=${checkinConfig.rawGeofenceEnv ?? '未设置，默认 true'}）`,
  );
});
