# Local Development

This document describes how to run RAPID's backend and frontend on your machine for development. For the architecture, see the [Developer Guide](./developer-guide.md#architecture); for deploying the application, see the [README](../../README.md#deployment-methods).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Verification](#verification)
- [Database Management (Prisma Studio)](#database-management-prisma-studio)
- [Running Tests](#running-tests)
- [Building](#building)
- [Python Agent (review-item-processor)](#python-agent-review-item-processor)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js v22** (recommended; the backend requires v20 or later, and CI runs on v22)
- **Docker / Docker Compose** — runs the local MySQL database
- **AWS CLI (configured)** — used to create Cognito users and to connect optional features to your deployed stack
- **Python 3.13+ and [uv](https://docs.astral.sh/uv/)** — needed only when working on the review agent (`review-item-processor/`)
- **A deployed `RapidStack`** — the frontend signs in against the deployed Amazon Cognito User Pool (the frontend has no local auth bypass), and upload / workflow features call the deployed AWS resources

## Backend Setup

### 1. Start the local database

Run in the repository root:

```bash
docker compose -f assets/local/docker-compose.yml up -d
```

This starts a MySQL 8.0 container (the same MySQL version the deployed Aurora MySQL version 3 is compatible with) using:

- Host: `localhost` / Port: `3306`
- Database: `rapid` / User: `rapid_user` / Password: `rapid_password`

The bundled init script grants the privileges Prisma needs to create its shadow database, so `prisma migrate dev` works out of the box. To reset the data, delete the volume and start the container again:

```bash
docker compose -f assets/local/docker-compose.yml down -v
docker compose -f assets/local/docker-compose.yml up -d
```

### 2. Install dependencies and apply the schema

`DATABASE_URL` is required by both the Prisma CLI and the local server. The value matches `assets/local/docker-compose.yml`:

```bash
cd backend
npm ci
export DATABASE_URL="mysql://rapid_user:rapid_password@localhost:3306/rapid"
npm run prisma:generate
npm run prisma:migrate
```

The repository already contains the tracked `backend/prisma/.env` local-development template, and Prisma loads it automatically. Its defaults match `assets/local/docker-compose.yml`. Do not replace them with real credentials or commit secrets; for a non-local database, export `DATABASE_URL` in your shell instead.

### 3. Set environment variables

```bash
export RAPID_LOCAL_DEV=true
```

`RAPID_LOCAL_DEV=true` bypasses authentication on the local backend: every request runs as a mock **admin** user (the flag has no effect on Lambda).

Optionally, point the local backend at the resources of your deployed stack. This enables document upload / download (Amazon S3 presigned URLs), submitting checklist extraction and review jobs, ambiguity detection, and the per-item model selection list:

```bash
export AWS_REGION="<region of your RapidStack>"
export DOCUMENT_BUCKET="<document bucket name>"
export DOCUMENT_PROCESSING_STATE_MACHINE_ARN="<Checklist Processor state machine ARN>"
export REVIEW_QUEUE_URL="<review queue URL>"
export AMBIGUITY_DETECTION_QUEUE_URL="<ambiguity detection queue URL>"
export AVAILABLE_MODELS='[{"modelId":"global.anthropic.claude-sonnet-5","displayName":"Claude Sonnet 5 (Global)"}]'
```

Find the values in the AWS console of the deployed stack (Amazon S3 / Step Functions / SQS). Note that the extraction / review workflows themselves run in your AWS account and write their results to the deployed Aurora database, not to your local MySQL, so jobs submitted from the local UI will not show results locally.

### 4. Start the development server

```bash
cd backend
npm run dev
```

The backend starts at `http://localhost:3000`.

## Frontend Setup

```bash
cd frontend
npm ci
cp .env.example .env.local
```

Edit `.env.local`:

- `VITE_APP_USER_POOL_ID` / `VITE_APP_USER_POOL_CLIENT_ID` / `VITE_APP_REGION` — from the CDK deploy outputs (`RapidStack.AuthUserPoolId...` / `RapidStack.AuthUserPoolClientId...`) or the Amazon Cognito console
- `VITE_APP_API_ENDPOINT` — `http://localhost:3000` for the local backend (also the fallback when unset)

Then start the development server:

```bash
cd frontend
npm run dev
```

The frontend starts at `http://localhost:5173`. Sign in with a user of the deployed User Pool (see [Admin Initial Setup](../../README.md#admin-initial-setup)): backend authorization is bypassed by `RAPID_LOCAL_DEV`, but the frontend sign-in screen itself requires a real Cognito user.

## Verification

```bash
curl http://localhost:3000/health
```

1. Backend: the health endpoint above returns a success response.
2. Frontend: open `http://localhost:5173`, sign in, and confirm the application loads.

## Database Management (Prisma Studio)

You can browse and edit the local database visually with Prisma Studio (requires `DATABASE_URL`, as above):

```bash
cd backend
npm run prisma:studio
```

Prisma Studio starts at `http://localhost:5555`.

## Running Tests

Backend (Vitest):

```bash
cd backend
npm test
```

To run a single suite:

```bash
npm run test -- "<suite>"
```

Frontend (Vitest):

```bash
cd frontend
npm test
```

Review agent (pytest via uv). `pytest` lives in the optional `dev` extra, so it has to be synced once (a plain `uv sync` does not install optional extras):

```bash
cd review-item-processor
uv sync --extra dev
uv run pytest
```

## Building

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

After changing frontend navigation or asset handling, also verify the stage-path build used by the S3 + API Gateway delivery:

```bash
cd frontend
VITE_APP_BASE_PATH=/app/ npm run build
```

## Python Agent (review-item-processor)

The review agent is written in Python; its dependencies are managed with uv:

```bash
cd review-item-processor
uv sync
uv lock
```

To add dependencies:

```bash
uv add package-name
uv add --dev package-name
```

## Troubleshooting

**Database connection errors**

Confirm the container is running:

```bash
docker ps
```

Confirm the connection string — compare `echo $DATABASE_URL` when it is exported, or use the tracked local defaults in `backend/prisma/.env`, against the values in `assets/local/docker-compose.yml`. Do not store real credentials in the tracked template. Restart the database container if needed:

```bash
docker compose -f assets/local/docker-compose.yml restart mysql
```

For Prisma generate errors, migration issues, and other topics, see the [Developer Guide's troubleshooting section](./developer-guide.md#troubleshooting).
