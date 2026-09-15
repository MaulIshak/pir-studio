-- Enable Realtime publication for projects table so changes are broadcast to subscribed clients
alter publication supabase_realtime add table public.projects;
