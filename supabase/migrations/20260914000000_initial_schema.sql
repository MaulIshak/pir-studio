-- 1. Profiles Table (Synced from auth.users on first sign in)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. OAuth Tokens Table (Stores Google OAuth tokens in DB for Vercel read-only runtime compatibility)
create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  provider text not null default 'google',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

-- 3. Projects Table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('jam', 'competition', 'internal')),
  start_date date,
  deadline date,
  status text check (status in ('active', 'completed', 'archived')) default 'active',
  description text,
  drive_folder_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 4. Milestones Table
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  status text check (status in ('not_started', 'in_progress', 'done')) default 'not_started',
  created_at timestamptz default now()
);

-- 5. Tasks Table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text check (status in ('todo', 'in_progress', 'review', 'done')) default 'todo',
  due_date date,
  created_at timestamptz default now()
);

-- 6. Assets Table
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  type text check (type in ('sprite', 'audio', '3d_model', 'font', 'vfx', 'other')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  drive_file_id text,
  status text check (status in ('received', 'review', 'integrated', 'rejected')) default 'received',
  needs_credit boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- 7. Credits Table
create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  source_name text not null,
  author text,
  license text check (license in ('cc0', 'cc_by', 'royalty_free', 'proprietary', 'other')),
  source_url text,
  notes text,
  created_at timestamptz default now()
);

-- 8. Artifact Links Table
create table if not exists public.artifact_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  label text not null,
  type text check (type in ('figma', 'figjam', 'gdd', 'build', 'other')),
  url text not null,
  notes text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.assets enable row level security;
alter table public.credits enable row level security;
alter table public.artifact_links enable row level security;

-- Permissive RLS Policies for Team Members (anon + authenticated)
-- profiles
create policy "Enable read access for all users" on public.profiles for select using (true);
create policy "Enable insert access for all users" on public.profiles for insert with check (true);
create policy "Enable update access for all users" on public.profiles for update using (true);

-- oauth_tokens
create policy "Users can view their oauth_tokens" on public.oauth_tokens for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert their oauth_tokens" on public.oauth_tokens for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their oauth_tokens" on public.oauth_tokens for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete their oauth_tokens" on public.oauth_tokens for delete to authenticated using (auth.uid() = user_id);

-- projects
create policy "Enable read access for all users" on public.projects for select using (true);
create policy "Enable insert access for all users" on public.projects for insert with check (true);
create policy "Enable update access for all users" on public.projects for update using (true);
create policy "Enable delete access for all users" on public.projects for delete using (true);

-- milestones
create policy "Enable read access for all users" on public.milestones for select using (true);
create policy "Enable insert access for all users" on public.milestones for insert with check (true);
create policy "Enable update access for all users" on public.milestones for update using (true);
create policy "Enable delete access for all users" on public.milestones for delete using (true);

-- tasks
create policy "Enable read access for all users" on public.tasks for select using (true);
create policy "Enable insert access for all users" on public.tasks for insert with check (true);
create policy "Enable update access for all users" on public.tasks for update using (true);
create policy "Enable delete access for all users" on public.tasks for delete using (true);

-- assets
create policy "Enable read access for all users" on public.assets for select using (true);
create policy "Enable insert access for all users" on public.assets for insert with check (true);
create policy "Enable update access for all users" on public.assets for update using (true);
create policy "Enable delete access for all users" on public.assets for delete using (true);

-- credits
create policy "Enable read access for all users" on public.credits for select using (true);
create policy "Enable insert access for all users" on public.credits for insert with check (true);
create policy "Enable update access for all users" on public.credits for update using (true);
create policy "Enable delete access for all users" on public.credits for delete using (true);

-- artifact_links
create policy "Enable read access for all users" on public.artifact_links for select using (true);
create policy "Enable insert access for all users" on public.artifact_links for insert with check (true);
create policy "Enable update access for all users" on public.artifact_links for update using (true);
create policy "Enable delete access for all users" on public.artifact_links for delete using (true);

-- Profile Sync Trigger from auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- Enable Realtime publication specifically on tasks table
alter publication supabase_realtime add table public.tasks;
