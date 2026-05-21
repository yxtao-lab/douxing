import type { Request, Response } from 'express';
import { handleWechatPayNotify } from '../services/payment.service.js';

/** 微信支付异步通知（需 raw body，在 index.ts 单独挂载） */
export async function wechatPayNotifyHandler(req: Request, res: Response) {
  try {
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : '';
    const result = await handleWechatPayNotify(rawBody, req.headers);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('[payments/wechat/notify]', err);
    res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
}
