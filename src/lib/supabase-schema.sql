-- Supabase Database Schema for Apple Mail Task Manager
-- Run this in Supabase SQL Editor to create all tables

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ===================
-- PROFILES TABLE
-- ===================
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  full_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id)
);

-- ===================
-- CATEGORIES TABLE
-- ===================
create table if not exists categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  color text default '#3B82F6',
  icon text,
  parent_id uuid references categories(id) on delete cascade,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id, name)
);

-- ===================
-- EMAILS TABLE
-- ===================
create table if not exists emails (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  apple_mail_id text,
  subject text,
  sender text,
  recipient text,
  content text,
  html_content text,
  date_received timestamp with time zone,
  date_sent timestamp with time zone,
  is_read boolean default false,
  is_flagged boolean default false,
  folder text default 'inbox',
  labels text[] default array[]::text[],
  attachments jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ===================
-- TASKS TABLE
-- ===================
create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email_id uuid references emails(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  title text not null,
  description text,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'archived', 'cancelled')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  tags text[] default array[]::text[],
  assignee text,
  estimated_hours numeric(5,2),
  actual_hours numeric(5,2),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ===================
-- DRAFTS TABLE
-- ===================
create table if not exists drafts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email_id uuid references emails(id) on delete set null,
  subject text,
  recipient text,
  cc text,
  bcc text,
  content text,
  html_content text,
  attachments jsonb default '[]'::jsonb,
  is_reply boolean default false,
  reply_to_id uuid references emails(id) on delete set null,
  scheduled_at timestamp with time zone,
  template_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ===================
-- AI INTERACTIONS TABLE
-- ===================
create table if not exists ai_interactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email_id uuid references emails(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  interaction_type text not null check (interaction_type in (
    'email_summary', 'task_creation', 'draft_generation', 'response_suggestion',
    'content_analysis', 'spam_detection', 'sentiment_analysis', 'action_extraction',
    'priority_assessment', 'category_suggestion'
  )),
  prompt text,
  response text,
  model text,
  tokens_used integer,
  cost numeric(10,4),
  duration_ms integer,
  success boolean default true,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ===================
-- EMAIL RULES TABLE
-- ===================
create table if not exists email_rules (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  conditions jsonb not null,
  actions jsonb not null,
  is_active boolean default true,
  priority integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id, name)
);

-- ===================
-- TEMPLATES TABLE
-- ===================
create table if not exists templates (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  type text default 'email' check (type in ('email', 'task', 'response', 'signature')),
  subject_template text,
  content_template text not null,
  html_template text,
  variables text[] default array[]::text[],
  is_shared boolean default false,
  usage_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id, name, type)
);

-- ===================
-- INDEXES FOR PERFORMANCE
-- ===================

-- Emails indexes
create index if not exists idx_emails_user_id on emails(user_id);
create index if not exists idx_emails_date_received on emails(date_received desc);
create index if not exists idx_emails_folder on emails(folder);
create index if not exists idx_emails_is_read on emails(is_read);
create index if not exists idx_emails_sender on emails(sender);
create index if not exists idx_emails_subject on emails using gin(to_tsvector('english', subject));
create index if not exists idx_emails_content on emails using gin(to_tsvector('english', content));

-- Tasks indexes
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_created_at on tasks(created_at desc);
create index if not exists idx_tasks_email_id on tasks(email_id);
create index if not exists idx_tasks_category_id on tasks(category_id);

-- AI interactions indexes
create index if not exists idx_ai_interactions_user_id on ai_interactions(user_id);
create index if not exists idx_ai_interactions_type on ai_interactions(interaction_type);
create index if not exists idx_ai_interactions_created_at on ai_interactions(created_at desc);

-- Categories indexes
create index if not exists idx_categories_user_id on categories(user_id);
create index if not exists idx_categories_parent_id on categories(parent_id);
create index if not exists idx_categories_sort_order on categories(sort_order);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table emails enable row level security;
alter table tasks enable row level security;
alter table categories enable row level security;
alter table drafts enable row level security;
alter table ai_interactions enable row level security;
alter table email_rules enable row level security;
alter table templates enable row level security;

-- Profiles policies
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = user_id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = user_id);
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = user_id);

-- Emails policies
create policy "Users can view own emails" on emails
  for select using (auth.uid() = user_id);
create policy "Users can insert own emails" on emails
  for insert with check (auth.uid() = user_id);
create policy "Users can update own emails" on emails
  for update using (auth.uid() = user_id);
create policy "Users can delete own emails" on emails
  for delete using (auth.uid() = user_id);

-- Tasks policies
create policy "Users can view own tasks" on tasks
  for select using (auth.uid() = user_id);
create policy "Users can insert own tasks" on tasks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks" on tasks
  for update using (auth.uid() = user_id);
create policy "Users can delete own tasks" on tasks
  for delete using (auth.uid() = user_id);

-- Categories policies
create policy "Users can view own categories" on categories
  for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on categories
  for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on categories
  for delete using (auth.uid() = user_id);

-- Drafts policies
create policy "Users can view own drafts" on drafts
  for select using (auth.uid() = user_id);
create policy "Users can insert own drafts" on drafts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own drafts" on drafts
  for update using (auth.uid() = user_id);
create policy "Users can delete own drafts" on drafts
  for delete using (auth.uid() = user_id);

-- AI interactions policies
create policy "Users can view own ai interactions" on ai_interactions
  for select using (auth.uid() = user_id);
create policy "Users can insert own ai interactions" on ai_interactions
  for insert with check (auth.uid() = user_id);

-- Email rules policies
create policy "Users can manage own email rules" on email_rules
  for all using (auth.uid() = user_id);

-- Templates policies
create policy "Users can view own templates" on templates
  for select using (auth.uid() = user_id);
create policy "Users can view shared templates" on templates
  for select using (is_shared = true);
create policy "Users can manage own templates" on templates
  for all using (auth.uid() = user_id);

-- ===================
-- FUNCTIONS AND TRIGGERS
-- ===================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_profiles_updated_at before update on profiles
  for each row execute function update_updated_at_column();
create trigger update_emails_updated_at before update on emails
  for each row execute function update_updated_at_column();
create trigger update_tasks_updated_at before update on tasks
  for each row execute function update_updated_at_column();
create trigger update_categories_updated_at before update on categories
  for each row execute function update_updated_at_column();
create trigger update_drafts_updated_at before update on drafts
  for each row execute function update_updated_at_column();
create trigger update_email_rules_updated_at before update on email_rules
  for each row execute function update_updated_at_column();
create trigger update_templates_updated_at before update on templates
  for each row execute function update_updated_at_column();

-- ===================
-- USEFUL VIEWS
-- ===================

-- Task summary view
create or replace view task_summary as
select 
  user_id,
  count(*) as total_tasks,
  count(*) filter (where status = 'completed') as completed_tasks,
  count(*) filter (where status = 'pending') as pending_tasks,
  count(*) filter (where due_date < now() and status != 'completed') as overdue_tasks
from tasks
group by user_id;

-- Email stats view
create or replace view email_stats as
select 
  user_id,
  count(*) as total_emails,
  count(*) filter (where not is_read) as unread_emails,
  count(*) filter (where is_flagged) as flagged_emails,
  count(*) filter (where date_received > now() - interval '7 days') as recent_emails
from emails
group by user_id;

-- ===================
-- SAMPLE DATA FUNCTIONS
-- ===================

-- Function to create default categories for new users
create or replace function create_default_categories(target_user_id uuid)
returns void as $$
begin
  insert into categories (user_id, name, color, icon, sort_order) values
    (target_user_id, 'Work', '#3B82F6', '💼', 1),
    (target_user_id, 'Personal', '#10B981', '🏠', 2),
    (target_user_id, 'Urgent', '#EF4444', '🚨', 3),
    (target_user_id, 'Follow-up', '#F59E0B', '📞', 4),
    (target_user_id, 'Ideas', '#8B5CF6', '💡', 5)
  on conflict (user_id, name) do nothing;
end;
$$ language plpgsql;

-- ===================
-- PERFORMANCE MONITORING
-- ===================

-- Function to get user analytics
create or replace function get_user_analytics(
  target_user_id uuid,
  start_date timestamp with time zone default now() - interval '30 days',
  end_date timestamp with time zone default now()
)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'user_id', target_user_id,
    'date_range', json_build_object(
      'start', start_date,
      'end', end_date
    ),
    'email_stats', (
      select json_build_object(
        'total_received', count(*),
        'unread', count(*) filter (where not is_read),
        'flagged', count(*) filter (where is_flagged),
        'folders', json_object_agg(folder, folder_count)
      )
      from (
        select folder, count(*) as folder_count
        from emails 
        where user_id = target_user_id 
          and created_at between start_date and end_date
        group by folder
      ) folder_stats
      cross join emails
      where emails.user_id = target_user_id 
        and emails.created_at between start_date and end_date
    ),
    'task_stats', (
      select json_build_object(
        'total_created', count(*),
        'completed', count(*) filter (where status = 'completed'),
        'completion_rate', 
          case when count(*) > 0 
          then round((count(*) filter (where status = 'completed') * 100.0 / count(*)), 2)
          else 0 
          end,
        'by_priority', json_object_agg(priority, priority_count)
      )
      from (
        select priority, count(*) as priority_count
        from tasks 
        where user_id = target_user_id 
          and created_at between start_date and end_date
        group by priority
      ) priority_stats
      cross join tasks
      where tasks.user_id = target_user_id 
        and tasks.created_at between start_date and end_date
    ),
    'ai_usage', (
      select json_build_object(
        'total_interactions', count(*),
        'total_tokens', coalesce(sum(tokens_used), 0),
        'total_cost', coalesce(sum(cost), 0),
        'by_type', json_object_agg(interaction_type, type_count)
      )
      from (
        select interaction_type, count(*) as type_count
        from ai_interactions 
        where user_id = target_user_id 
          and created_at between start_date and end_date
        group by interaction_type
      ) type_stats
      cross join ai_interactions
      where ai_interactions.user_id = target_user_id 
        and ai_interactions.created_at between start_date and end_date
    )
  ) into result;
  
  return result;
end;
$$ language plpgsql;

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;