-- Migration: Add subtasks table for hierarchical tasks structure

-- 1. Create subtasks table
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  status text check (status in ('todo', 'done')) default 'todo',
  position integer default 0,
  created_at timestamptz default now()
);

-- 2. Index on task_id for efficient retrieval
create index if not exists subtasks_task_id_idx on public.subtasks(task_id);

-- 3. Enable Row Level Security
alter table public.subtasks enable row level security;

-- 4. Permissive RLS Policies (consistent with other tables in GameDev Project Manager)
create policy "Enable read access for all users" on public.subtasks for select using (true);
create policy "Enable insert access for all users" on public.subtasks for insert with check (true);
create policy "Enable update access for all users" on public.subtasks for update using (true);
create policy "Enable delete access for all users" on public.subtasks for delete using (true);

-- 5. Enable Realtime for subtasks
alter publication supabase_realtime add table public.subtasks;
