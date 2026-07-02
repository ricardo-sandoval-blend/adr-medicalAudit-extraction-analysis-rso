#!/bin/bash

# Script to build and start the full stack (Postgres + Next.js).
# The Next.js container applies the Prisma schema (`prisma db push`) automatically
# on startup — there is no separate db-init step anymore.

set -e

echo "Building and starting postgres + nextjs..."
docker compose --env-file .env.local up --build -d

echo "Waiting for PostgreSQL to be ready..."
until docker compose exec postgres pg_isready -U adr_user -d adr_extraction > /dev/null 2>&1; do
  sleep 1
done

echo "✅ Stack started. The nextjs container will run 'prisma db push' on boot."
echo ""
echo "Follow logs with:"
echo "  docker compose logs -f nextjs"
echo ""
echo "App available at http://localhost:3000"
