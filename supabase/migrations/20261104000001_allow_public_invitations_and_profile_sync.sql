-- Migration: Allow public shareable invitation links and enhance profile sync
-- Description:
-- 1. Drops NOT NULL constraint on organization_invitations.invitee_email so public shareable links can be created without knowing recipient email.
-- 2. Updates handle_new_user trigger to preserve user's custom name in public.profiles.
-- 3. Adds lookup index for organization invitations by organization, role, and status.

-- 1. Make invitee_email nullable for public shareable links
alter table public.organization_invitations alter column invitee_email drop not null;

-- 2. Index for active shareable links lookup
create index if not exists idx_org_invitations_org_role_status
  on public.organization_invitations (organization_id, role, status);

-- 3. Preserve custom profile name in handle_new_user trigger
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
    name = coalesce(public.profiles.name, excluded.name),
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$ language plpgsql security definer;
