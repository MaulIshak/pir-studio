-- Migration: Add Realtime Collaborative Whiteboards
-- Hierarchy: Organization -> Project -> Boards (with Yjs snapshots, Garage image assets, Task links, and Templates)

-- 1. Helper permission functions (single source of truth matching lib/auth/permissions.ts)
create or replace function public.user_has_project_access(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = p_user_id
    where p.id = p_project_id
      and (
        om.role in ('leader', 'co_leader')
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.user_is_org_admin(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = p_user_id
      and om.role in ('leader', 'co_leader')
  );
$$;

create or replace function public.user_is_project_admin(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = p_user_id
    where p.id = p_project_id
      and om.role in ('leader', 'co_leader')
  );
$$;

-- 2. Boards Table (owned by a Project; permissions inherited from Project)
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null check (status in ('active', 'archived')) default 'active',
  is_locked boolean not null default false,
  thumbnail_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Board Snapshots Table (Yjs binary state; server-only via service_role)
create table if not exists public.board_snapshots (
  board_id uuid primary key references public.boards(id) on delete cascade,
  state bytea not null,
  version bigint not null default 1,
  element_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 4. Board Assets Table (metadata for images uploaded to Garage via presigned URLs)
create table if not exists public.board_assets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  file_id text not null,
  storage_key text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  status text not null check (status in ('pending', 'ready')) default 'pending',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (board_id, file_id)
);

-- 5. Board-Task Links Table (many-to-many between Boards and Tasks with optional Excalidraw element_id)
create table if not exists public.board_task_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  element_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Unique constraint supporting nullable element_id
create unique index if not exists idx_board_task_links_unique
  on public.board_task_links (board_id, task_id, coalesce(element_id, ''));

-- 6. Board Templates Table (organization-level or system-level starter templates)
create table if not exists public.board_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text,
  title text not null,
  category text not null check (category in ('brainstorm', 'gameplay', 'scope', 'level', 'ui', 'custom')) default 'custom',
  description text,
  content jsonb not null default '{"elements": []}'::jsonb,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_system = true and organization_id is null) or (is_system = false and organization_id is not null))
);

create unique index if not exists idx_board_templates_system_slug
  on public.board_templates (slug)
  where is_system = true and slug is not null;

-- 7. Performance Indexes
create index if not exists idx_boards_project_status_updated
  on public.boards (project_id, status, updated_at desc);
create index if not exists idx_board_assets_board_file
  on public.board_assets (board_id, file_id);
create index if not exists idx_board_task_links_board_id
  on public.board_task_links (board_id);
create index if not exists idx_board_task_links_task_id
  on public.board_task_links (task_id);
create index if not exists idx_board_templates_org_id
  on public.board_templates (organization_id);

-- 8. Guard trigger: only leader/co_leader may change boards.status or boards.is_locked
create or replace function public.enforce_board_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service_role (auth.uid() is null) to manage freely
  if auth.uid() is null then
    return new;
  end if;

  if (new.status is distinct from old.status or new.is_locked is distinct from old.is_locked) then
    if not public.user_is_project_admin(old.project_id, auth.uid()) then
      raise exception 'Only leaders and co-leaders can lock or archive boards';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_board_admin_fields on public.boards;
create trigger trg_enforce_board_admin_fields
  before update on public.boards
  for each row
  execute function public.enforce_board_admin_fields();

-- 9. Enable Row Level Security (RLS) on all tables
alter table public.boards enable row level security;
alter table public.board_snapshots enable row level security;
alter table public.board_assets enable row level security;
alter table public.board_task_links enable row level security;
alter table public.board_templates enable row level security;

-- 9a. board_snapshots: NO policies for anon or authenticated.
-- Only service_role (Hocuspocus server & server-side template seeding) can access snapshots.

-- 9b. boards policies (inherited from project membership)
create policy "Project members can view boards"
  on public.boards for select to authenticated
  using (public.user_has_project_access(project_id, auth.uid()));

create policy "Project members can create boards"
  on public.boards for insert to authenticated
  with check (public.user_has_project_access(project_id, auth.uid()));

create policy "Project members can update boards"
  on public.boards for update to authenticated
  using (public.user_has_project_access(project_id, auth.uid()))
  with check (public.user_has_project_access(project_id, auth.uid()));

create policy "Org admins can delete boards"
  on public.boards for delete to authenticated
  using (public.user_is_project_admin(project_id, auth.uid()));

-- 9c. board_assets policies (inherited from parent board's project)
create policy "Project members can view board assets"
  on public.board_assets for select to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_assets.board_id
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

create policy "Project members can insert board assets on writable boards"
  on public.board_assets for insert to authenticated
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_assets.board_id
        and b.status = 'active'
        and b.is_locked = false
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

create policy "Project members can update board assets on writable boards"
  on public.board_assets for update to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_assets.board_id
        and b.status = 'active'
        and b.is_locked = false
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

create policy "Org admins can delete board assets"
  on public.board_assets for delete to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_assets.board_id
        and public.user_is_project_admin(b.project_id, auth.uid())
    )
  );

-- 9d. board_task_links policies (inherited from parent board's project)
create policy "Project members can view board task links"
  on public.board_task_links for select to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_task_links.board_id
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

create policy "Project members can create board task links"
  on public.board_task_links for insert to authenticated
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_task_links.board_id
        and b.status = 'active'
        and b.is_locked = false
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

create policy "Project members can delete board task links"
  on public.board_task_links for delete to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_task_links.board_id
        and public.user_has_project_access(b.project_id, auth.uid())
    )
  );

-- 9e. board_templates policies (system templates readable by all authenticated; org templates scoped to org)
create policy "Authenticated users can view system and own org templates"
  on public.board_templates for select to authenticated
  using (
    is_system = true
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = board_templates.organization_id
        and om.user_id = auth.uid()
    )
  );

create policy "Org members can create org templates"
  on public.board_templates for insert to authenticated
  with check (
    is_system = false
    and organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = board_templates.organization_id
        and om.user_id = auth.uid()
    )
  );

create policy "Org admins can update org templates"
  on public.board_templates for update to authenticated
  using (
    is_system = false
    and organization_id is not null
    and public.user_is_org_admin(organization_id, auth.uid())
  );

create policy "Org admins can delete org templates"
  on public.board_templates for delete to authenticated
  using (
    is_system = false
    and organization_id is not null
    and public.user_is_org_admin(organization_id, auth.uid())
  );

-- 10. Enable Realtime on boards and project_members so Hocuspocus can revoke/downgrade live sessions immediately
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards'
  ) then
    alter publication supabase_realtime add table public.boards;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_members'
  ) then
    alter publication supabase_realtime add table public.project_members;
  end if;
end $$;

