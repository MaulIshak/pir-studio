<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GameDev Project Manager — Agent Guide

Internal tool for 5–8 person game jam team. Single source of truth for projects, tasks, milestones, assets, credits, artifact links. Supabase Postgres is metadata source of truth, Google Drive is file storage. Every Drive file must mirror its ID in Supabase (`projects.drive_folder_id`, `assets.drive_file_id`).

Full specs: `architecture.md`, `PRD-GameDev-Project-Manager.md`, `DESIGN_GUIDE.md`, `docs/sprints/`.

## Stack

- Next.js 16 App Router + React 19 + TypeScript, Tailwind CSS 4, Vercel hosting.
- shadcn/ui preset `b7C9smijg` (`--template next --pointer`), Phosphor Icons, framer-motion, Zod + React Hook Form.
- Supabase Postgres + Auth Google OAuth + Realtime, `@supabase/ssr` + `@supabase/supabase-js`.
- Google Drive API v3 `googleapis`, scope `https://www.googleapis.com/auth/drive.file` only.
- `next.config.ts`: `serverActions.bodySizeLimit: 500mb`.

Commands: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`, `npm run format`.

Env in `.env.local` and Vercel settings, never commit:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Structure

```text
app/page.tsx                    # Dashboard, deadline sorted, Due Soon < 3 days
app/projects/new/page.tsx       # Create project
app/projects/[slug]/{page,tasks,milestones,assets,credits,artifacts}/
app/api/auth/callback/route.ts  # OAuth only
app/api/ping/route.ts           # Keepalive only
actions/{projects,tasks,milestones,assets,credits,artifacts}.ts
lib/supabase/{client,server,middleware} lib/gdrive/{client,provisioning,tokens,upload}
components/ui/                  # shadcn only, via `npx shadcn@latest add [component]`
components/{projects,tasks,milestones,assets,credits,artifacts,layout}/
supabase/migrations/            # timestamped SQL, never edit applied files
proxy.ts                        # session refresh, do not bypass
```

## Critical Rules

1. **Server Actions vs API routes:** all UI mutations go in `actions/`. API routes only for OAuth callback, ping webhook, or other external callers.
2. **Server Components default:** add `"use client"` only for forms, drag-and-drop, Realtime subscriptions, `useState`/`useEffect`.
3. **shadcn only:** never hand-roll primitives or unstyled HTML. Feature components are compositions of shadcn `Card`, `Button`, `Dialog`, `Table`, `Badge`, `Select`, `Skeleton`, `Alert`.
4. **4 UI states mandatory:** `Skeleton` loading, `Card` empty with contextual dialog, `Alert variant="destructive"` error with retry, populated responsive view. Empty actions must open own dialog, never hardcode to `/projects/new`.
5. **Copy:** English only, 1–2 word labels, zero parentheticals. Select trigger label must equal item label. Never leak UUIDs or snake_case enums.
6. **Vercel read-only:** OAuth `access_token`, `refresh_token`, `expires_at` in `oauth_tokens` table only. Never write tokens to disk.
7. **Drive dual-write:** DB write, then Drive provision or upload, then store returned ID. Drive failure keeps DB row visible with error plus Retry. Never claim Drive file exists when it does not. Provision `/GameDev Team/[Project]/{Assets,Builds,GDD,Design,Credits}/`, reuse root folder.
8. **No hardcoded secrets, hex colors, or broadened Drive scope.** Use semantic tokens. Flag instead of silently widening.

## Data

11 tables with RLS full access for authenticated users: `profiles`, `oauth_tokens`, `projects` with unique `slug`, `milestones`, `tasks` + `subtasks`, `asset_bundles`, `assets`, `asset_references` hard-delete, `credits` nullable `asset_id on delete set null`, `artifact_links`. Realtime only on `tasks`, `subtasks`, `projects`. See `.agents/skills/supabase-schema/SKILL.md` before any schema change. Child rows cascade on project delete except credit history and task assignee links which use `set null`.

## Scope

In scope v1: project CRUD + Drive provisioning, task kanban + subtasks, milestones + progress, asset intake + bundles + references gallery, credits + export, artifacts, dashboard.

Out of scope, confirm before building: granular roles, notifications, build versioning or CI, analytics beyond progress, native mobile, Drive preview embed, multi-team support.

## Skills

Load before coding:

- `project-conventions` — structure, Server Action choice, scope guard.
- `supabase-schema` — canonical tables, RLS, migrations, Realtime.
- `gdrive-integration` — scope, provisioning tree, upload flow, token refresh.
- `ui-design-system` + `ui-styling` — shadcn preset, tokens, motion `0.15–0.25s`.
- `ui-copy-conventions` — English microcopy, no parentheticals.

## Done

1. `npm run typecheck`, `npm run lint`, `npm run build` pass with zero errors.
2. Dual-system verify: row in Supabase AND folder or file in Drive.
3. UI checklist in `DESIGN_GUIDE.md` section 7 passes.
