import '../config/env.js';
import { waitForDatabase } from './ensure-database.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

await waitForDatabase(url);
