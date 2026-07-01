import type { Request } from 'express';
import { normalizeIpv4Address } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { sysApiLog, sysLoginLog, sysOperLog } from '../db/schema/sys-admin.js';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim() ?? 'unknown';
    return normalizeIpv4Address(first) || first;
  }
  const remote = req.socket.remoteAddress ?? 'unknown';
  return normalizeIpv4Address(remote) || remote;
}

export function parseUserAgent(ua: string | undefined) {
  const raw = ua ?? '';
  let browser = 'Unknown';
  let os = 'Unknown';
  if (raw.includes('Chrome')) browser = 'Chrome';
  else if (raw.includes('Firefox')) browser = 'Firefox';
  else if (raw.includes('Safari')) browser = 'Safari';
  else if (raw.includes('Edge')) browser = 'Edge';
  if (raw.includes('Windows')) os = 'Windows';
  else if (raw.includes('Mac')) os = 'macOS';
  else if (raw.includes('Linux')) os = 'Linux';
  else if (raw.includes('Android')) os = 'Android';
  else if (raw.includes('iPhone') || raw.includes('iPad')) os = 'iOS';
  return { browser, os };
}

export async function recordLoginLog(input: {
  username: string;
  ip: string;
  browser: string;
  os: string;
  status: number;
  msg?: string;
}) {
  try {
    const db = getDb();
    await db.insert(sysLoginLog).values({
      username: input.username,
      ip: input.ip,
      browser: input.browser,
      os: input.os,
      status: input.status,
      msg: input.msg ?? null,
    });
  } catch (err) {
    console.warn('[sys-log] 登录日志写入失败:', err);
  }
}

export async function recordOperLog(input: {
  title: string;
  operName: string;
  operUrl: string;
  method: string;
  operIp: string;
  status?: number;
  errorMsg?: string;
}) {
  try {
    const db = getDb();
    await db.insert(sysOperLog).values({
      title: input.title,
      operName: input.operName,
      operUrl: input.operUrl,
      method: input.method,
      operIp: input.operIp,
      status: input.status ?? 1,
      errorMsg: input.errorMsg ?? null,
    });
  } catch (err) {
    console.warn('[sys-log] 操作日志写入失败:', err);
  }
}

export async function recordOperLogFromRequest(
  req: Request,
  title: string,
  status = 1,
  errorMsg?: string,
) {
  const operName = req.auth?.username ?? 'unknown';
  await recordOperLog({
    title,
    operName,
    operUrl: req.originalUrl,
    method: req.method,
    operIp: getClientIp(req),
    status,
    errorMsg,
  });
}

export async function recordApiLog(input: {
  operName: string;
  requestUrl: string;
  method: string;
  apiModule?: string;
  requestParams?: string | null;
  responseBody?: string | null;
  statusCode: number;
  operIp: string;
  costTime: number;
  status?: number;
  errorMsg?: string;
  traceId?: string;
}) {
  try {
    const db = getDb();
    await db.insert(sysApiLog).values({
      traceId: input.traceId ?? null,
      operName: input.operName,
      apiModule: input.apiModule ?? null,
      requestUrl: input.requestUrl,
      method: input.method,
      requestParams: input.requestParams ?? null,
      responseBody: input.responseBody ?? null,
      statusCode: input.statusCode,
      operIp: input.operIp,
      costTime: input.costTime,
      status: input.status ?? 1,
      errorMsg: input.errorMsg ?? null,
    });
  } catch (err) {
    console.warn('[sys-log] 接口日志写入失败:', err);
  }
}
