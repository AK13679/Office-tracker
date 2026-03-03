const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      visit_date DATE NOT NULL,
      note TEXT DEFAULT '',
      UNIQUE(member_id, visit_date)
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );

    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS time_from TIME;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS time_to TIME;
  `);
  console.log('Database initialized');
}

module.exports = { pool, initDB };