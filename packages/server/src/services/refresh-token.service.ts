import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { refreshTokens } from '../db/schema/refresh-tokens.js';

const REFRESH_TOKEN_BYTES = 32;

/**
 * 解析 `15m` / `7d` 等时长字符串为秒数。
 *
 * @param input - JWT 风格时长；无法解析时返回 `undefined`
 * @returns 秒数；无效格式时为 `undefined`
 */
export function parseDurationToSeconds(input: string): number | undefined {
  const match = /^(\d+)([smhd])$/i.exec(input.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86400;
    default:
      return undefined;
  }
}

/**
 * 读取 Access Token 有效期（秒）。
 *
 * @returns 秒数；默认 900（15 分钟）
 */
export function getAccessTokenExpiresInSeconds(): number {
  const raw =
    process.env.JWT_ACCESS_EXPIRES_IN ||
    process.env.JWT_EXPIRES_IN ||
    '15m';
  return parseDurationToSeconds(raw) ?? 900;
}

/**
 * 读取 Refresh Token 有效期（毫秒）。
 *
 * @returns 毫秒数；默认 30 天
 */
function getRefreshTokenExpiresMs(): number {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const seconds = parseDurationToSeconds(raw) ?? 30 * 86400;
  return seconds * 1000;
}

/**
 * 对 refresh token 明文做 SHA-256 哈希（十六进制）。
 *
 * @param rawToken - 客户端持有的 refresh token 明文
 * @returns 64 字符十六进制摘要
 */
export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * 生成新的 refresh token 明文（base64url）。
 *
 * @returns 随机 token 字符串
 */
export function generateRefreshTokenRaw(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export interface IssueRefreshTokenMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * 为用户签发新的 refresh token 并写入数据库。
 *
 * @param userId - 用户 ID
 * @param meta - 可选客户端元数据
 * @returns 明文 refresh token（仅此次返回给客户端）
 */
export async function issueRefreshToken(
  userId: number,
  meta?: IssueRefreshTokenMeta,
): Promise<string> {
  const raw = generateRefreshTokenRaw();
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + getRefreshTokenExpiresMs());
  const db = getDb();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent: meta?.userAgent?.slice(0, 512),
    ip: meta?.ip?.slice(0, 64),
  });

  return raw;
}

/**
 * 校验 refresh token 并轮换：吊销旧 token、签发新 token。
 *
 * @param rawToken - 客户端提交的 refresh token 明文
 * @returns 用户 ID 与新 refresh token；无效或已过期时为 `null`
 */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ userId: number; newRawToken: string } | null> {
  const tokenHash = hashRefreshToken(rawToken);
  const db = getDb();
  const now = new Date();

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, now),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(eq(refreshTokens.id, row.id));

  const newRawToken = await issueRefreshToken(row.userId, {
    userAgent: row.userAgent ?? undefined,
    ip: row.ip ?? undefined,
  });

  return { userId: row.userId, newRawToken };
}

/**
 * 吊销指定 refresh token（登出）。
 *
 * @param rawToken - refresh token 明文；为空时不执行
 * @returns 是否成功吊销至少一条记录
 */
export async function revokeRefreshToken(rawToken: string | undefined): Promise<boolean> {
  if (!rawToken?.trim()) return false;

  const tokenHash = hashRefreshToken(rawToken.trim());
  const db = getDb();
  const now = new Date();

  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
      ),
    );

  return true;
}
