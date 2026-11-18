-- Migrate file storage from Google Drive to S3-compatible object storage

-- 1. Drop Google OAuth token storage
drop policy if exists "Users can view their oauth_tokens" on public.oauth_tokens;
drop policy if exists "Users can insert their oauth_tokens" on public.oauth_tokens;
drop policy if exists "Users can update their oauth_tokens" on public.oauth_tokens;
drop policy if exists "Users can delete their oauth_tokens" on public.oauth_tokens;
drop table if exists public.oauth_tokens;

-- 2. Remove Drive folder provisioning column from projects
alter table public.projects drop column if exists drive_folder_id;

-- 3. Rename drive_file_id to storage_key across asset tables
alter table public.assets rename column drive_file_id to storage_key;
alter table public.asset_bundles rename column drive_file_id to storage_key;
alter table public.asset_references rename column drive_file_id to storage_key;

