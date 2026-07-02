# adr-extraction-analysis

Dashboard para monitorear y gestionar la extracción de PDFs a JSON estructurado
usando GenAI (ADR — auditoría médica). Next.js 16 + Postgres (Prisma), auth con
Keycloak.

Qué muestra:
- **/dashboard** — resumen de ejecuciones, métricas y gráficas (con delta vs. la
  ejecución anterior).
- **/executor** — tabla de planificación: elige un dataset, arrastra radicados,
  elige qué documentos correr y lanza la ejecución.
- **/changelog** — historial de versiones (semver `vX.Y.Z`) de la estructura del
  JSON, con incidentes de Clickup vinculados por tipo de documento.

Ver [SETUP.md](./SETUP.md) para el detalle completo (schema de datos, API routes,
estructura de `volume/datasets`, comandos de Prisma, etc).

## Cómo correr (local)

Con Docker (recomendado — levanta la app y Postgres juntos):

```bash
cp .env.example .env.local   # completa los datos del realm de Keycloak
docker compose --env-file .env.local up --build
```

Abre http://localhost:3000 (redirige a `/dashboard`).

`--env-file .env.local` es necesario para que las vars `NEXT_PUBLIC_KEYCLOAK_*`
se compilen dentro del build de Next.js (se leen de `.env.local` como build args).

Sin Docker (Postgres sí corre en contenedor):

```bash
pnpm install
docker compose up -d postgres
pnpm prisma db push
pnpm dev
```

Producción local (un solo proceso sirviendo el build):

```bash
pnpm build
pnpm start          # http://localhost:3000
```

## Deploy en el bastion (flujo habitual ante un cambio)

Corre en `adr-test-medicalaudit-bastioninstance` (`i-07eb9e02496576639`, cuenta
`276553701208`, `us-east-1`), la misma máquina que `fp-fn-analysis`. CloudFront
apunta directo a esa instancia por un VPC Origin (sin load balancer), puerto
3000 → `https://d1xn7ji2z2yz1l.cloudfront.net`.

El bastion corre el contenedor de la app (`nextjs`) desde una imagen en ECR; el
servicio `postgres` sigue corriendo localmente en el bastion vía Docker Compose
(no se publica en ECR). Los datos (`db`, `datasets`, `executions`, `changelog`,
`ground-truth`) persisten en `/home/ubuntu/data/extraction-analysis` — el disco
grande (`nvme1n1`, 2TB), no en `./volume` relativo al repo — mismo patrón que
`/home/ubuntu/data/fp-fn-analysis`.

### 1. Build + push de la imagen (desde tu máquina local)

```bash
ECR=276553701208.dkr.ecr.us-east-1.amazonaws.com
REPO=adr-test-medicalaudit-extraction-ecr

# Login al registry (requiere AWS CLI configurado)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin $ECR

# Build para linux/amd64 (arquitectura del bastion) con los NEXT_PUBLIC_* del .env.local
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_KEYCLOAK_URL=$(grep ^NEXT_PUBLIC_KEYCLOAK_URL .env.local | cut -d= -f2) \
  --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=$(grep ^NEXT_PUBLIC_KEYCLOAK_REALM .env.local | cut -d= -f2) \
  --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$(grep ^NEXT_PUBLIC_KEYCLOAK_CLIENT_ID .env.local | cut -d= -f2) \
  -t $ECR/$REPO:latest .

docker push $ECR/$REPO:latest
```

### 2. Pull + reload en el bastion

`/opt/adr-extraction-analysis` usa **`docker-compose.prod.yml`** (no
`docker-compose.yml` — ese es solo para local/build). Ese archivo apunta
`nextjs` directo a la imagen de ECR y carga las vars runtime
(`KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, etc.) desde
un **`.env`** en esa misma carpeta — `.env`, no `.env.local`; ese archivo no
viene del repo (está en `.gitignore`), se crea a mano una sola vez.

Entra al bastion (SSM o SSH según corresponda), cambia al usuario `app` y ejecuta:

```bash
sudo su - app
cd /opt/adr-extraction-analysis

# Login al registry desde la instancia (usa el rol IAM, no necesita credenciales)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    276553701208.dkr.ecr.us-east-1.amazonaws.com

# Bajar la nueva imagen del servicio nextjs
docker compose -f docker-compose.prod.yml pull nextjs

# Recrear el contenedor con la imagen nueva (sin tocar postgres ni el volume de datos)
docker compose -f docker-compose.prod.yml up -d
```

Los datos quedan intactos entre reinicios porque viven en el bind mount de
`./volume` (o la ruta absoluta que se configure en el host, p. ej.
`/home/ubuntu/data/adr-extraction-analysis`).

## Estructura

```
app/                    App Router — páginas (/dashboard, /executor, /changelog) y API routes
components/             UI (shadcn/ui)
lib/                    config, lógica de negocio, cliente Keycloak
db/                     cliente Postgres (pg pool) usado en runtime
prisma/                 schema.prisma + init.sql
docker-entrypoint.sh    aplica `prisma db push` + índice único al arrancar el contenedor
volume/                 datos persistentes: db, datasets, executions, changelog, ground-truth
```
