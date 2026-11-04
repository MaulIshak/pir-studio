-- Migration: Add Organization Milestones and Organization Milestone Members
-- Enables organization-wide roadmap and timeline milestones with optional project links and member-level visibility control

-- 1. Organization Milestones Table
create table if not exists public.organization_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  start_date date,
  due_date date,
  status text not null check (status in ('not_started', 'in_progress', 'done')) default 'not_started',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Organization Milestone Members Table (For non-project milestone visibility & involvement)
create table if not exists public.organization_milestone_members (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.organization_milestones(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (milestone_id, user_id)
);

-- 3. Indexes for performance
create index if not exists idx_org_milestones_org_id on public.organization_milestones(organization_id);
create index if not exists idx_org_milestones_project_id on public.organization_milestones(project_id);
create index if not exists idx_org_milestone_members_milestone_id on public.organization_milestone_members(milestone_id);
create index if not exists idx_org_milestone_members_user_id on public.organization_milestone_members(user_id);

-- 4. Enable Row Level Security (RLS)
alter table public.organization_milestones enable row level security;
alter table public.organization_milestone_members enable row level security;

-- Permissive RLS Policies for authenticated users (enforced with business logic in server actions)
create policy "Allow all authenticated users read organization_milestones"
  on public.organization_milestones for select to authenticated using (true);
create policy "Allow authenticated users insert organization_milestones"
  on public.organization_milestones for insert to authenticated with check (true);
create policy "Allow authenticated users update organization_milestones"
  on public.organization_milestones for update to authenticated using (true);
create policy "Allow authenticated users delete organization_milestones"
  on public.organization_milestones for delete to authenticated using (true);

create policy "Allow all authenticated users read organization_milestone_members"
  on public.organization_milestone_members for select to authenticated using (true);
create policy "Allow authenticated users insert organization_milestone_members"
  on public.organization_milestone_members for insert to authenticated with check (true);
create policy "Allow authenticated users update organization_milestone_members"
  on public.organization_milestone_members for update to authenticated using (true);
create policy "Allow authenticated users delete organization_milestone_members"
  on public.organization_milestone_members for delete to authenticated using (true);
