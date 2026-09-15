-- Migration: Add slug column to projects table

-- 1. Add slug column as nullable initially
alter table public.projects add column if not exists slug text;

-- 2. Populate existing projects with slugs based on name
update public.projects
set slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
where slug is null or slug = '';

-- In case any row still has empty slug (e.g. empty name), fallback to id prefix
update public.projects
set slug = 'project-' || substr(id::text, 1, 8)
where slug is null or slug = '';

-- 3. Set not null
alter table public.projects alter column slug set not null;

-- 4. Unique constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_slug_key'
  ) then
    alter table public.projects add constraint projects_slug_key unique (slug);
  end if;
end $$;

-- 5. Reserved words check constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_slug_not_reserved'
  ) then
    alter table public.projects add constraint projects_slug_not_reserved check (slug not in ('new'));
  end if;
end $$;
