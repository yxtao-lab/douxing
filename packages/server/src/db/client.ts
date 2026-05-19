import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema/index.js';
import { parseDatabaseUrl } from './parse-database-url.js';

let pool: mysql.Pool | undefined;
let db: MySql2Database<typeof schema> | undefined;

export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');

    const { host, port, user, password, database } = parseDatabaseUrl(url);
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: database || undefined,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 10000,
      enableKeepAlive: true,
    });
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema, mode: 'default' });
  }
  return db;
}
