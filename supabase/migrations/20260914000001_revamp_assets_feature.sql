-- Migration: Revamp Assets Feature
-- 1. Create asset_bundles table (for texture atlases, sprite sheets, multi-asset bundles)
create table if not exists public.asset_bundles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  drive_file_id text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS on asset_bundles
alter table public.asset_bundles enable row level security;

create policy "Enable read access for all users" on public.asset_bundles for select using (true);
create policy "Enable insert access for all users" on public.asset_bundles for insert with check (true);
create policy "Enable update access for all users" on public.asset_bundles for update using (true);
create policy "Enable delete access for all users" on public.asset_bundles for delete using (true);

-- 2. Create asset_references table (for multiple visual reference images per asset)
create table if not exists public.asset_references (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade,
  drive_file_id text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS on asset_references
alter table public.asset_references enable row level security;

create policy "Enable read access for all users" on public.asset_references for select using (true);
create policy "Enable insert access for all users" on public.asset_references for insert with check (true);
create policy "Enable update access for all users" on public.asset_references for update using (true);
create policy "Enable delete access for all users" on public.asset_references for delete using (true);

-- 3. Alter assets table
alter table public.assets add column if not exists task_id uuid references public.tasks(id) on delete set null;
alter table public.assets add column if not exists bundle_id uuid references public.asset_bundles(id) on delete set null;
alter table public.assets add column if not exists file_name text;

-- 4. Drop old constraint first so status can be updated
alter table public.assets drop constraint if exists assets_status_check;

-- 5. Migrate existing status values
update public.assets
set status = case
  when status = 'received' then 'todo'
  when status = 'review' then 'in_progress'
  when status = 'integrated' then 'implemented'
  when status = 'rejected' then 'todo'
  else 'todo'
end;

-- 6. Add new check constraint on assets status
alter table public.assets add constraint assets_status_check check (status in ('todo', 'in_progress', 'done', 'implemented'));
alter table public.assets alter column status set default 'todo';
