import mysql from 'mysql2/promise';
import { parseDatabaseUrl } from './parse-database-url.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 等待 MySQL 可接受连接（Docker 启动后宿主机端口可能晚几秒才就绪） */
export async function waitForDatabase(url: string, maxAttempts = 30) {
  const { host, port, user, password } = parseDatabaseUrl(url);

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 5000,
      });
      await connection.ping();
      await connection.end();
      console.log(`[db] MySQL ready at ${host}:${port}`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[db] Waiting for MySQL (${i}/${maxAttempts}): ${msg}`);
      await sleep(2000);
    }
  }

  throw new Error(`MySQL not ready at ${host}:${port}`);
}

/** 若库不存在则自动创建 */
export async function ensureDatabase(url: string) {
  const { host, port, user, password, database } = parseDatabaseUrl(url);
  if (!database) return;

  await waitForDatabase(url);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    connectTimeout: 10000,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
  console.log(`[db] Database ensured: ${database}`);
}
