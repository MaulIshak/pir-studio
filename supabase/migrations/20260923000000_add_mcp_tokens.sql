-- Per-user MCP tokens for external AI agents.
-- Only the SHA-256 hash is stored; plaintext is shown once at creation.
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  name text not null default 'Agent',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

alter table public.mcp_tokens enable row level security;

create policy "Users can view own tokens"
  on public.mcp_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own tokens"
  on public.mcp_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own tokens"
  on public.mcp_tokens for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own tokens"
  on public.mcp_tokens for delete
  to authenticated
  using (auth.uid() = user_id);
