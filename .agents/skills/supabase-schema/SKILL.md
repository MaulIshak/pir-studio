---
name: supabase-schema
description: Canonical Supabase Postgres schema, naming conventions, and Row Level Security (RLS) policies for the GameDev Project Manager app. Use this skill whenever writing or modifying any SQL migration, adding a new table or column, writing a Supabase query/mutation from the Next.js app, or touching anything related to `projects`, `milestones`, `tasks`, `assets`, `credits`, `artifact_links`, or `profiles`. Always consult this skill before proposing a new table, changing a column, or writing an RLS policy — do not invent a different schema from scratch.
---

# Supabase Schema & Conventions

This skill defines the single source of truth for the database layer of the GameDev Project Manager app. The app is used by a small internal team (5-8 people); all authenticated members have full read/write access to all data. There is no per-user or per-team data isolation in v1.

## Core tables

Always use these exact table and column names. Do not rename, pluralize differently, or restructure without explicit user confirmation.

```sql
-- Synced automatically from Supabase Auth on first login (via trigger)
profiles (
  id uuid primary key references auth.users(id),
  name text,
  email text,
  avatar_url text,
  created_at timestamptz default now()
)

-- Storing OAuth tokens in DB (essential for Vercel deployment where filesystem is read-only)
oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  provider text not null default 'google',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text check (type in ('jam','competition','internal')),
  start_date date,
  deadline date,
  status text check (status in ('active','completed','archived')) default 'active',
  description text,
  drive_folder_id text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  start_date date,
  due_date date,
  status text check (status in ('not_started','in_progress','done')) default 'not_started'
)

tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references profiles(id),
  status text check (status in ('todo','in_progress','review','done')) default 'todo',
  due_date date,
  created_at timestamptz default now()
)

subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  title text not null,
  status text check (status in ('todo','done')) default 'todo',
  position integer default 0,
  created_at timestamptz default now()
)

asset_bundles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  drive_file_id text not null,
  file_name text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
)

assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  name text not null,
  type text check (type in ('sprite','audio','3d_model','font','vfx','other')),
  uploaded_by uuid references profiles(id),
  drive_file_id text,
  bundle_id uuid references asset_bundles(id) on delete set null,
  file_name text,
  status text check (status in ('todo','in_progress','done','implemented')) default 'todo',
  needs_credit boolean default false,
  notes text,
  created_at timestamptz default now()
)

asset_references (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  drive_file_id text not null,
  file_name text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
)

credits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  source_name text not null,
  author text,
  license text check (license in ('cc0','cc_by','royalty_free','proprietary','other')),
  source_url text,
  notes text,
  created_at timestamptz default now()
)

artifact_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  label text not null,
  type text check (type in ('figma','figjam','gdd','build','other')),
  url text not null,
  notes text,
  created_at timestamptz default now()
)
```

## Design rules to preserve

- `milestone_id` on `tasks` is nullable — a task does not have to belong to a milestone.
- `asset_id` on `credits` is nullable and `on delete set null` — a credit entry must survive even if the underlying asset row is deleted. Never make this cascade-delete.
- All child tables cascade-delete when their parent `project` is deleted, except `credits.asset_id` and `tasks.assignee_id`/`milestone_id`, which use `set null`.
- Do not add a `teams` or `organizations` table in v1 unless the user explicitly asks for multi-team support — this is out of scope per the PRD.
- Do not add role/permission columns (e.g. `role`, `is_admin`) unless explicitly requested. All authenticated users are equal.

## Row Level Security (RLS) policy pattern

RLS must be enabled on every table, but kept deliberately simple: any authenticated user can read and write any row. Do not write per-user restrictive policies unless the user asks for it.

```sql
alter table projects enable row level security;

create policy "Authenticated users can view all projects"
  on projects for select
  to authenticated
  using (true);

create policy "Authenticated users can insert projects"
  on projects for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update projects"
  on projects for update
  to authenticated
  using (true);
```

Apply the same three-policy pattern (`select`, `insert`, `update`) to every table listed above. Add a `delete` policy only for tables where hard deletion is expected in the UI (e.g. `artifact_links`, `credits`); prefer soft-delete (`status = 'archived'`) for `projects`.

**Common mistake to avoid**: forgetting `alter table ... enable row level security;` before writing policies — Supabase blocks all access by default once RLS is enabled but no policy exists, which silently breaks the app (queries return empty instead of erroring).

## Migrations

- Store all schema changes as timestamped SQL files under `/supabase/migrations/`.
- Never edit an already-applied migration file — always create a new migration for schema changes.
- When adding a new table or column, update this skill file afterward so future sessions stay in sync with the real schema.

## Realtime

Enable Supabase Realtime only on `tasks` and `subtasks` (for the live kanban board). Do not enable it broadly on all tables — unnecessary realtime subscriptions add complexity without a corresponding feature need in this app.
