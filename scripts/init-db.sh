#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -U adr_user -d adr_extraction; do
  sleep 1
done

echo "PostgreSQL is ready. Running Prisma migrations..."

# Check if node_modules exists and install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Run Prisma migrations
pnpm prisma db push --skip-generate

echo "Database initialization complete!"
