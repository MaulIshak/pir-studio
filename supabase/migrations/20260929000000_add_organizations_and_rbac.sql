-- Migration: Add Organizations, RBAC, and Project Access Control
-- Hierarchy: Organization -> Project -> Tasks, Milestones, Assets, etc.

-- 1. Organizations Table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Organization Members Table (Leader, Co-Leader, Member)
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('leader', 'co_leader', 'member')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, user_id)
);

-- 3. Project Members Table (Explicit assignment for Members)
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

-- 4. Organization Invitations Table (For invitation links & email invites)
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_email text not null,
  invitee_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('co_leader', 'member')),
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled')) default 'pending',
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('org_invitation', 'role_changed', 'project_assigned', 'general')),
  title text not null,
  message text,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 6. Add organization_id to projects table
alter table public.projects add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- 7. Seed & Production Data Backfill (Safe migration)
do $$
declare
  v_org_id uuid;
  v_leader_id uuid;
  v_member record;
  v_project record;
begin
  -- Ensure 'Pir Berkacamata' organization exists
  select id into v_org_id from public.organizations where slug = 'pir-berkacamata';
  if v_org_id is null then
    insert into public.organizations (name, slug, description)
    values ('Pir Berkacamata', 'pir-berkacamata', 'Default organization for Pir Studio')
    returning id into v_org_id;
  end if;

  -- Identify Maulana Ishak as leader
  select id into v_leader_id from public.profiles
  where name ilike '%Maulana Ishak%' or email ilike '%maulana%'
  order by created_at asc limit 1;

  -- Fallback if no specific profile matched Maulana Ishak
  if v_leader_id is null then
    select id into v_leader_id from public.profiles order by created_at asc limit 1;
  end if;

  -- Assign Leader
  if v_leader_id is not null then
    update public.organizations set created_by = v_leader_id where id = v_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_leader_id, 'leader')
    on conflict (organization_id, user_id) do update set role = 'leader';
  end if;

  -- Add all other existing users as member
  for v_member in select id from public.profiles where v_leader_id is null or id != v_leader_id loop
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_member.id, 'member')
    on conflict (organization_id, user_id) do nothing;
  end loop;

  -- Set organization_id on all existing projects
  update public.projects set organization_id = v_org_id where organization_id is null;

  -- Link all members to existing projects in project_members so access is fully preserved
  for v_project in select id from public.projects where organization_id = v_org_id loop
    for v_member in select user_id from public.organization_members where organization_id = v_org_id loop
      insert into public.project_members (project_id, user_id)
      values (v_project.id, v_member.user_id)
      on conflict (project_id, user_id) do nothing;
    end loop;
  end loop;
end $$;

-- 8. Enable Row Level Security (RLS)
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.project_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.notifications enable row level security;

-- Permissive RLS Policies for authenticated users
create policy "Allow all authenticated users read organizations"
  on public.organizations for select to authenticated using (true);
create policy "Allow authenticated users insert organizations"
  on public.organizations for insert to authenticated with check (true);
create policy "Allow authenticated users update organizations"
  on public.organizations for update to authenticated using (true);
create policy "Allow authenticated users delete organizations"
  on public.organizations for delete to authenticated using (true);

create policy "Allow all authenticated users read organization_members"
  on public.organization_members for select to authenticated using (true);
create policy "Allow authenticated users insert organization_members"
  on public.organization_members for insert to authenticated with check (true);
create policy "Allow authenticated users update organization_members"
  on public.organization_members for update to authenticated using (true);
create policy "Allow authenticated users delete organization_members"
  on public.organization_members for delete to authenticated using (true);

create policy "Allow all authenticated users read project_members"
  on public.project_members for select to authenticated using (true);
create policy "Allow authenticated users insert project_members"
  on public.project_members for insert to authenticated with check (true);
create policy "Allow authenticated users delete project_members"
  on public.project_members for delete to authenticated using (true);

create policy "Allow all authenticated users read organization_invitations"
  on public.organization_invitations for select to authenticated using (true);
create policy "Allow authenticated users insert organization_invitations"
  on public.organization_invitations for insert to authenticated with check (true);
create policy "Allow authenticated users update organization_invitations"
  on public.organization_invitations for update to authenticated using (true);
create policy "Allow authenticated users delete organization_invitations"
  on public.organization_invitations for delete to authenticated using (true);

create policy "Users can view their notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Allow authenticated users insert notifications"
  on public.notifications for insert to authenticated with check (true);
create policy "Users can update their notifications"
  on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete their notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- Enable Realtime
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.organization_members;
