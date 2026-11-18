<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GameDev Project Manager — Agent Guide

Internal tool for 5–8 person game jam team. Single source of truth for projects, tasks, milestones, assets, credits, artifact links. Supabase Postgres is metadata source of truth, S3-compatible object storage (Garage) is file storage. Every stored file must mirror its object key in Supabase (`assets.storage_key`, `asset_bundles.storage_key`, `asset_references.storage_key`, or `/api/storage/file?key=...` in `artifact_links.url`).

Full specs: `architecture.md`, `PRD-GameDev-Project-Manager.md`, `DESIGN_GUIDE.md`, `docs/sprints/`.

## Stack

- Next.js 16 App Router + React 19 + TypeScript, Tailwind CSS 4, self-hosted standalone hosting.
- shadcn/ui preset `b7C9smijg` (`--template next --pointer`), Phosphor Icons, framer-motion, Zod + React Hook Form.
- Supabase Postgres + Auth Google OAuth + Realtime, `@supabase/ssr` + `@supabase/supabase-js`.
- S3-compatible object storage (`@aws-sdk/client-s3`), authenticated streaming via `/api/storage/file`.
- `next.config.ts`: `serverActions.bodySizeLimit: 500mb`.

Commands: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`, `npm run format`.

Env in `.env.local`, never commit:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
S3_ENDPOINT=...
S3_REGION=garage
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```

## Structure

```text
app/page.tsx                    # Dashboard, deadline sorted, Due Soon < 3 days
app/projects/new/page.tsx       # Create project
app/projects/[slug]/{page,tasks,milestones,assets,credits,artifacts}/
app/api/auth/callback/route.ts  # OAuth only
app/api/storage/file/route.ts   # Authenticated S3 file streaming
app/api/ping/route.ts           # Keepalive only
actions/{projects,tasks,milestones,assets,credits,artifacts}.ts
lib/supabase/{client,server,middleware} lib/storage/{s3,urls}
components/ui/                  # shadcn only, via `npx shadcn@latest add [component]`
components/{projects,tasks,milestones,assets,credits,artifacts,layout}/
supabase/migrations/            # timestamped SQL, never edit applied files
proxy.ts                        # session refresh, do not bypass
```

## Critical Rules

1. **Server Actions vs API routes:** all UI mutations go in `actions/`. API routes only for OAuth callback, authenticated storage file streaming, ping webhook, or other external callers.
2. **Server Components default:** add `"use client"` only for forms, drag-and-drop, Realtime subscriptions, `useState`/`useEffect`.
3. **shadcn only:** never hand-roll primitives or unstyled HTML. Feature components are compositions of shadcn `Card`, `Button`, `Dialog`, `Table`, `Badge`, `Select`, `Skeleton`, `Alert`.
4. **4 UI states mandatory:** `Skeleton` loading, `Card` empty with contextual dialog, `Alert variant="destructive"` error with retry, populated responsive view. Empty actions must open own dialog, never hardcode to `/projects/new`.
5. **Copy:** English only, 1–2 word labels, zero parentheticals. Select trigger label must equal item label. Never leak UUIDs or snake_case enums.
6. **Storage dual-write:** upload file to S3 under `projects/{projectId}/{assets,design,builds,gdd}/`, then store returned `storage_key` (or `/api/storage/file?key=...`) in Supabase. Clean up orphaned S3 objects on failure or delete.
7. **No hardcoded secrets or hex colors.** Use semantic tokens.

## Data

16 tables with RLS and organization-level RBAC: `organizations`, `organization_members` (`leader`, `co_leader`, `member`), `project_members`, `organization_invitations`, `notifications`, `profiles`, `projects` with `organization_id` and unique `slug`, `milestones`, `tasks` + `subtasks`, `asset_bundles`, `assets`, `asset_references` hard-delete, `credits` nullable `asset_id on delete set null`, `artifact_links`, `mcp_tokens`. Realtime on `tasks`, `subtasks`, `projects`, `notifications`, `organization_members`. See `.agents/skills/supabase-schema/SKILL.md` before any schema change. Child rows cascade on project delete except credit history and task assignee links which use `set null`.

## Scope

In scope: multi-tenant organizations + RBAC (`leader`, `co_leader`, `member`), project CRUD, task kanban + subtasks, milestones + progress, asset intake + bundles + references gallery, credits + export, artifacts, notifications + invitation links, personal dashboard with quick actions, S3 file storage.

Out of scope, confirm before building: granular custom permissions beyond the 3 roles, build versioning or CI, native mobile.

## Skills

Load before coding:

- `project-conventions` — structure, Server Action choice, scope guard.
- `supabase-schema` — canonical tables, RLS, migrations, Realtime.
- `ui-design-system` + `ui-styling` — shadcn preset, tokens, motion `0.15–0.25s`.
- `ui-copy-conventions` — English microcopy, no parentheticals.

## Done

1. `npm run typecheck`, `npm run lint`, `npm run build` pass with zero errors.
2. Dual-system verify: row in Supabase AND object in S3 storage.
3. UI checklist in `DESIGN_GUIDE.md` section 7 passes.
