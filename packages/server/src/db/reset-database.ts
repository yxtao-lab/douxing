import '../config/env.js';
import mysql from 'mysql2/promise';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const parsed = new URL(url.replace(/^mysql:\/\//, 'http://'));
  const database = parsed.pathname.replace(/^\//, '');
  const connection = await mysql.createConnection({
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  console.log(`[db] Dropped database: ${database}`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
