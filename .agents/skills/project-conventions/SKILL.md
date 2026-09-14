---
name: project-conventions
description: Next.js App Router project structure, coding conventions, and scope boundaries for the GameDev Project Manager app. Use this skill whenever scaffolding new pages/routes, deciding between a Server Action and an API route, adding a new component, styling with Tailwind, or when unsure whether a requested feature is in scope. Always consult this skill before proposing a different folder structure, adding a new library/dependency, or building a feature not covered by the PRD — check the "out of scope" list first.
---

# Project Conventions — GameDev Project Manager

This skill keeps generated code consistent across sessions and prevents scope creep. The app is a small internal tool for a 5-8 person game dev team, deliberately built without a complex permission system, notifications, or analytics. When in doubt, prefer the simpler option.

## Stack (do not substitute without user approval)

- **Framework**: Next.js, App Router (`app/` directory), TypeScript
- **Styling**: Tailwind CSS
- **Database/Auth**: Supabase (Postgres, Auth with Google OAuth, optional Realtime) — see the `supabase-schema` skill for schema details
- **File storage**: Google Drive API — see the `gdrive-integration` skill
- **Deployment**: Vercel (frontend), Supabase Cloud (backend)
- **Uptime**: a scheduled GitHub Actions ping to prevent the Supabase free-tier project from pausing after 7 days of inactivity

## Folder structure

```
app/
  (dashboard)/
    page.tsx                 -- main dashboard
  projects/
    new/page.tsx              -- create project form
    [projectId]/
      page.tsx                -- project hub (tabs)
      tasks/                  -- kanban board
      milestones/
      assets/                 -- asset tracker + intake form
      credits/
      artifacts/
  actions/                    -- Server Actions grouped by domain
    projects.ts
    tasks.ts
    assets.ts
    credits.ts
    artifacts.ts
lib/
  supabase/                   -- Supabase client setup (server + client)
  gdrive/                     -- Drive API helper functions
components/
  ui/                         -- shared, reusable components
  [feature]/                  -- feature-specific components
supabase/
  migrations/                 -- SQL migration files
```

## Server Actions vs API routes

- Prefer **Server Actions** for all mutations triggered from within the app's own UI (creating a task, updating asset status, submitting the intake form, etc.). This avoids hand-rolling API routes for internal-only operations.
- Use an **API route** only when the endpoint must be called from outside the app itself (e.g. a webhook, or the GitHub Actions uptime pinger). Do not create API routes as a default pattern for internal mutations.

## Component conventions

- Default to **Server Components**; mark a component `"use client"` only when it needs interactivity (forms, drag-and-drop board, realtime subscription).
- Keep feature-specific components colocated under `components/[feature]/`, and only promote a component to `components/ui/` once it's reused in more than one feature.
- Do not introduce a component library beyond what's already used (Tailwind + hand-built components). Do not add shadcn/ui, MUI, or similar unless the user explicitly asks.

## Environment variables

- All secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, etc.) go in `.env.local` locally and in Vercel's environment variable settings for deployment — never hardcoded, never committed.
- Public/client-safe values are prefixed `NEXT_PUBLIC_` per Next.js convention; nothing Drive- or Supabase-service-role-related should ever carry that prefix.

## Scope boundaries — check before building anything not listed here

**In scope (v1 features, per PRD)**: project CRUD + Drive folder provisioning, task/milestone board, asset intake tracker, credit/reference tracker + export, artifact links, dashboard.

**Explicitly out of scope — do not build unless the user explicitly asks**:
- Granular roles/permissions (all authenticated users have equal access)
- Push/email/Slack notifications
- Automated build versioning or CI/CD integration
- Analytics/reporting dashboards beyond the simple project progress view
- Native mobile app
- In-app file preview/embedding for Drive files
- Multi-team/multi-organization support

If a request seems to fall into the "out of scope" list, flag it to the user and confirm before implementing rather than building it silently.

## Testing expectations

Before considering a feature "done," manually verify the full path, not just that the code compiles — e.g. for project creation: row appears in `projects` table AND the Drive folder tree is actually created with the correct structure. Silent partial failures (DB row written but Drive folder missing, or vice versa) are the most common failure mode in this app given the two-system nature of writes — see the `gdrive-integration` skill for how to handle this.
