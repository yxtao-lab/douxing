import '../config/env.js';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabase } from './ensure-database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  await ensureDatabase(url);

  const connection = await mysql.createConnection(url);
  const db = drizzle(connection);

  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  console.log('[db] Running migrations from', migrationsFolder);

  await migrate(db, { migrationsFolder });
  await connection.end();

  console.log('[db] Migrations completed');
}

main().catch((err) => {
  console.error('[db] Migration failed:', err);
  process.exit(1);
});
