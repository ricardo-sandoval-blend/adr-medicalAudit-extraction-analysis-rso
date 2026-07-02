import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer supports a `url = env(...)` field inside schema.prisma's
// datasource block — the connection URL for schema/migrate commands (e.g.
// `prisma db push`) now comes from this config file instead.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
