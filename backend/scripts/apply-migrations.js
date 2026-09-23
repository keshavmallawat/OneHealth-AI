#!/usr/bin/env node
/**
 * OneHealth AI — migration runner.
 *
 * Applies prisma/migrations/<timestamp>_<name>/migration.sql in order over a
 * plain `pg` connection. It exists because `prisma migrate deploy` needs the
 * platform-specific schema-engine binary, and a laptop that cannot download it
 * (offline, proxied, or behind a corporate firewall) would otherwise be unable
 * to set the database up at all. The SQL is the same SQL Prisma generated.
 *
 * Already-applied migrations are recorded in "_onehealth_migrations". If the
 * database was previously migrated by Prisma itself, that history is imported
 * on first run so nothing is applied twice.
 *
 *   node scripts/apply-migrations.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { Client } = require('pg');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
  } catch (error) {
    console.error(`\nCould not connect to PostgreSQL: ${error.message}`);
    console.error('Check that PostgreSQL is running and DATABASE_URL is correct.\n');
    process.exit(1);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "_onehealth_migrations" (
      "name"       TEXT PRIMARY KEY,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Import history from a database that was migrated by Prisma previously.
  const prismaHistory = await client
    .query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)
    .catch(() => ({ rows: [] }));
  for (const row of prismaHistory.rows) {
    await client.query(
      `INSERT INTO "_onehealth_migrations"("name") VALUES ($1) ON CONFLICT DO NOTHING`,
      [row.migration_name]
    );
  }

  const applied = new Set(
    (await client.query(`SELECT name FROM "_onehealth_migrations"`)).rows.map((r) => r.name)
  );

  const all = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  /*
   * Adopting a database that already has the schema.
   *
   * A database created by `prisma migrate` before this runner existed has the
   * tables but no history this runner can read (and possibly no
   * `_prisma_migrations` either, if it was set up with `db push` or by running
   * the SQL by hand). Re-running the bootstrap migration against it fails on
   * `type "Role" already exists`, which looks like a broken migration and is
   * really just a missing baseline.
   *
   * So: if there is no recorded history but the core table is already present,
   * mark the bootstrap migration as applied without running it. Every later
   * migration is written to be idempotent, so those are applied normally and
   * bring an older database up to date whatever state it was left in.
   */
  if (applied.size === 0) {
    const { rows } = await client.query(`SELECT to_regclass('public."User"') AS present`);
    if (rows[0]?.present) {
      for (const name of all) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
        const bootstraps = /CREATE TABLE\s+"User"/i.test(sql) && !/CREATE TABLE IF NOT EXISTS\s+"User"/i.test(sql);
        if (bootstraps) {
          await client.query(
            `INSERT INTO "_onehealth_migrations"("name") VALUES ($1) ON CONFLICT DO NOTHING`,
            [name]
          );
          applied.add(name);
          console.log(`Adopting an existing database: baselined ${name} (not re-run).`);
        }
      }
    }
  }

  const pending = all.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log('Database schema is up to date.');
    await client.end();
    return;
  }

  for (const name of pending) {
    const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, 'utf8');
    process.stdout.write(`Applying ${name} ... `);
    try {
      // Not wrapped in a transaction: these migrations contain statements
      // PostgreSQL refuses inside one (ALTER TYPE ... ADD VALUE), and every
      // statement is written to be idempotent so a retry is safe.
      await client.query(sql);
      await client.query(`INSERT INTO "_onehealth_migrations"("name") VALUES ($1)`, [name]);
      console.log('done');
    } catch (error) {
      console.log('FAILED');
      console.error(`\n${error.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`\nApplied ${pending.length} migration(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
