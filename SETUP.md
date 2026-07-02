# ADR Extraction Analysis - Setup Guide

## Project Structure

This is a Next.js 16 dashboard for monitoring and managing PDF extraction to structured JSON using GenAI.

**3 Pages:**
1. **/dashboard** - Execution overview with metrics and charts
2. **/executor** - Wizard to launch new extractions
3. **/changelog** - Version history with incident tracking

## Prerequisites

- Node.js 18+ / pnpm
- Docker & Docker Compose
- Datasets folder at `@datasets/prod234` (specified in env vars)

## Local Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Or set it manually:
```
DATABASE_URL="postgresql://adr_user:adr_password_dev@localhost:5432/adr_extraction"
NODE_ENV=development
CHANGELOG_PATH=./data/changelog
```

### 2. Run the full stack with Docker

`docker-compose.yml` deploys exactly two services: `postgres` and `nextjs`. The
`nextjs` container applies the Prisma schema (`prisma db push`) automatically on
startup, before starting the app — there is no separate `db-init` service anymore.

```bash
# Option A: Docker Compose directly
docker compose --env-file .env.local up --build

# Option B: Quick start with shell script
bash scripts/docker-init-db.sh
```

`--env-file .env.local` is required so the public `NEXT_PUBLIC_KEYCLOAK_*` vars get
baked into the Next.js build (they're read from `.env.local` for the build args).
The full `.env.local` (including `KEYCLOAK_CLIENT_SECRET`) is also injected into the
running `nextjs` container at runtime via `env_file`.

This creates:
- PostgreSQL 16 on `localhost:5432`
- Next.js on `localhost:3000`, with the Prisma schema applied automatically
- Volumes mounted into the `nextjs` container:
  - `./datasets` → `/app/datasets` (readonly)
  - `./data/changelog` → `/app/data/changelog`
  - `./executions` → `/app/executions`

Database credentials:
- User: `adr_user`
- Password: `adr_password_dev`
- Database: `adr_extraction`

Note: the app connects to Postgres at runtime using discrete `DB_HOST`/`DB_PORT`/
`DB_USER`/`DB_PASSWORD`/`DB_NAME` vars (raw `pg` pool, see `db/postgres.ts`) — not
`DATABASE_URL`. `DATABASE_URL` is only used by the Prisma CLI for `db push`. Both
are set in `docker-compose.yml`.

### 3. Local (non-Docker) development

```bash
pnpm install
docker compose up -d postgres   # just the database
pnpm prisma db push
pnpm dev
```

Open `http://localhost:3000` → redirects to `/dashboard`

Prisma's schema language has no equivalent for a partial unique index, so the
"only one open version at a time" constraint on `versions.status = 'open'`
isn't created by `prisma db push`. It's created by `docker-entrypoint.sh` for
the Docker flow; for local (non-Docker) development, create it once manually:

```bash
docker exec adr-postgres psql -U adr_user -d adr_extraction -c \
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_single_open ON versions ((status)) WHERE status = 'open';"
```

## Database with Prisma

This project uses **Prisma ORM** for database management.

### Schema Location
- `prisma/schema.prisma` - Database schema definition

### Common Commands

```bash
# Create migration (after schema changes)
pnpm prisma migrate dev --name <migration_name>

# Apply migrations
pnpm prisma db push

# Open Prisma Studio (UI for database)
pnpm prisma studio

# Reset database (⚠️ deletes data)
pnpm prisma db push --skip-generate --force-reset
```

### Environment Variables

`.env.local` should contain:
```
DATABASE_URL="postgresql://user:password@host:port/dbname"
NODE_ENV=development
CHANGELOG_PATH=./data/changelog
```

## Database Schema

Managed by Prisma. Auto-applied when the `nextjs` container starts (see `docker-entrypoint.sh`).

**Tables:**
- `executions` - All extraction runs
- `execution_metrics` - Delta tracking (vs previous execution)
- `structure_versions` - Version history of JSON structure (vX.Y.Z format)
- `incident_links` - Clickup issues linked to versions with document type tracking

**Document Types** (incident_links.document_type):
- ADM: Documentos administrativos
- PDX: Procedimientos diagnósticos
- DQX: Descripción quirúrgica
- RAN: Registro de anestesia
- CRC: Comprobante de recibido del usuario
- OPF: Orden / prescripción
- HAU: Hoja de atención de urgencias
- HAM: Hoja de administración de medicamentos
- HEV: Hoja de evolución
- EPI: Epicrisis
- TAP: Traslado asistencial de pacientes
- FMO: Factura material de osteosíntesis
- FAC: Factura / cobro aseguradora

## API Routes

- `GET /api/datasets` - List datasets from filesystem
- `GET /api/executions` - List executions with filtering
- `POST /api/executions` - Create execution record
- `POST /api/execute` - Trigger extraction
- `GET /api/execute?id=X` - Check execution status
- `GET /api/metrics` - Fetch metrics (with deltas)
- `GET /api/changelog` - Get changelog entries
- `POST /api/changelog` - Add incident link
- `DELETE /api/incidents/[id]` - Remove incident

## Datasets Structure

Expected filesystem layout:

```
datasets/
├── dataset1/
│   ├── file1.pdf
│   ├── file2.pdf
│   └── request.json    ← Contains metadata (prestadoras, etc)
├── dataset2/
│   ├── ...
```

`request.json` example:
```json
{
  "prestadoras": [
    {"nit": "800149384", "nombre": "Prestadora A"},
    {"nit": "800000001", "nombre": "Prestadora B"}
  ],
  "radicados": [...]
}
```

## Changelog

### Features
- **Timeline View**: Visual timeline showing all versions chronologically
- **Semantic Versioning**: vX.Y.Z format (Major.Minor.Patch)
- **Auto-Suggested Versions**: Modal automatically detects latest version and suggests next patch bump
- **Markdown Support**: Full markdown rendering in version descriptions
- **Incident Tracking**: Link Clickup issues to versions, organized by document type
- **Field Changes**: Track added, removed, and modified fields per version

### Storage
Markdown files stored in filesystem volume:
```
data/changelog/
├── v1.0.0.md
├── v1.0.1.md
├── v1.0.2.md
├── v1.1.0.md
```

Each file contains:
- Version number
- Timestamp
- Metrics snapshot (documents processed, success rate, errors)
- Field changes (added/removed/modified)
- Linked Clickup incidents with document type

## Development

**Add shadcn components:**
```bash
npx shadcn@latest add [component-name] --yes
```

**Code quality:**
```bash
pnpm lint
pnpm format
pnpm typecheck
```

**Build for production:**
```bash
pnpm build
pnpm start
```

## Changelog API

### Create Version
```bash
POST /api/changelog
Content-Type: application/json

{
  "version": "v1.0.1",
  "metrics": {
    "total_documents": 150,
    "success_rate": 95.5,
    "error_count": 7
  },
  "field_changes": [
    { "type": "added", "field": "new_field" },
    { "type": "modified", "field": "existing_field" }
  ]
}
```

### Link Incident to Version
```bash
POST /api/changelog
Content-Type: application/json

{
  "version_id": "uuid",
  "clickup_url": "https://clickup.com/t/abc123",
  "title": "Bug: Field parsing error",
  "document_type": "FAC"
}
```

### Get Versions
```bash
GET /api/versions
```

### Get Version Details
```bash
GET /api/versions/v1.0.1
```

Returns: `{ version, content, incidents[] }`

## TODO

- [ ] Integrate actual PDF extraction service
- [ ] Implement background jobs for executions
- [ ] Add authentication
- [ ] Create data export (CSV, JSON)
- [ ] Add custom metrics calculations
- [ ] Email notifications
- [ ] Test coverage

## Support

For questions, see `/home/daniel-castillo/.claude/plans/la-metrica-es-un-melodic-storm.md`
