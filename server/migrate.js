const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('./src/config/env');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsDirectory = path.join(__dirname, '../db/migrations');
const migrationLockKey = 21068;

const migrate = async () => {
  const client = await pool.connect();
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockKey]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS roadlifter_schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFiles = (await fs.promises.readdir(migrationsDirectory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();

    for (const migrationName of migrationFiles) {
      const migrationPath = path.join(migrationsDirectory, migrationName);
      const sql = await fs.promises.readFile(migrationPath, 'utf8');
      if (!sql.trim()) {
        console.log(`Skipping empty migration: ${migrationName}`);
        continue;
      }

      const applied = await client.query(
        'SELECT 1 FROM roadlifter_schema_migrations WHERE migration_name = $1',
        [migrationName]
      );
      if (applied.rowCount > 0) {
        console.log(`Already applied: ${migrationName}`);
        continue;
      }

      console.log(`Applying migration: ${migrationName}`);
      await client.query('BEGIN');
      transactionStarted = true;
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO roadlifter_schema_migrations (migration_name) VALUES ($1)',
          [migrationName]
        );
        await client.query('COMMIT');
        transactionStarted = false;
      } catch (error) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        throw error;
      }
    }

    console.log('Database migrations are up to date');
  } finally {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [migrationLockKey]);
    }
    client.release();
    await pool.end();
  }
};

migrate().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
