-- Add start_date to milestones table for date range scheduling and Gantt charts
alter table public.milestones add column if not exists start_date date;
