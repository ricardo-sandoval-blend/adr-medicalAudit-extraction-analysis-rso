#!/bin/sh
set -e

echo "Running prisma db push..."
pnpm prisma db push

# Prisma's schema language has no equivalent for a partial unique index, so
# the "only one open version at a time" guarantee (versions.status = 'open')
# is created here instead, using the pg driver already bundled as a runtime
# dependency. Safe to re-run: CREATE UNIQUE INDEX IF NOT EXISTS is idempotent.
echo "Ensuring single-open-version constraint..."
node -e "
const { Client } = require('pg');
const client = new Client({
  user: process.env.DB_USER || 'adr_user',
  password: process.env.DB_PASSWORD || 'adr_password_dev',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'adr_extraction',
});
client.connect()
  .then(() => client.query(
    \"CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_single_open ON versions ((status)) WHERE status = 'open'\"
  ))
  .then(() => client.end())
  .catch((err) => { console.error(err); process.exit(1); });
"

echo "Database schema is up to date. Starting Next.js..."
exec "$@"
