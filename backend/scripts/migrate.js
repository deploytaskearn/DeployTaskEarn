const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/manual_migration.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Tables already exist — skipping');
    } else {
      console.error('Migration error:', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrate();
