# Pocket Agent

A lightweight Node.js/Express backend for managing AI agents. Provides a RESTful CRUD API for creating, reading, updating, and deleting agents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`, proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle via `artifacts/api-server/build.mjs`)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `artifacts/api-server/src/routes/` — Express route handlers
  - `health.ts` — `GET /api/healthz`
  - `agents.ts` — `GET|POST /api/agents`, `GET|PATCH|DELETE /api/agents/:id`
- `lib/api-zod/src/generated/` — Zod schemas generated from OpenAPI spec
- `lib/api-client-react/src/generated/` — React Query hooks generated from OpenAPI spec

## Architecture decisions

- In-memory store for agents (Map keyed by UUID) — no database required for the initial backend.
- Zod `safeParse` used in all routes for explicit validation error handling.
- All routes mounted under `/api` prefix via Express router in `routes/index.ts`.
- OpenAPI spec is the single source of truth; never edit generated files directly.

## Product

Pocket Agent exposes a REST API to manage a collection of agents. Each agent has a name, optional description, and a status (`active`, `inactive`, or `paused`). Agents are created with `POST /api/agents` and can be listed, fetched by ID, updated, or deleted.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Do not run `pnpm dev` at the workspace root — use the workflow or `pnpm --filter @workspace/api-server run dev`.
- The in-memory agent store resets on every server restart.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
