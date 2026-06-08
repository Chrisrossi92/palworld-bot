-- Weekly guild-wide goals for PalMaster Alpha 0.6.
-- One capture goal per guild per UTC week.

create table public.guild_weekly_goals (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  week_start_date date not null,
  goal_key text not null,
  progress integer not null default 0,
  target integer not null default 100,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_weekly_goals_guild_week_goal_unique unique (guild_id, week_start_date, goal_key),
  constraint guild_weekly_goals_goal_key_check check (length(trim(goal_key)) > 0),
  constraint guild_weekly_goals_progress_check check (progress >= 0),
  constraint guild_weekly_goals_target_check check (target > 0)
);

create index guild_weekly_goals_week_start_date_idx
  on public.guild_weekly_goals(week_start_date);

create index guild_weekly_goals_guild_complete_idx
  on public.guild_weekly_goals(guild_id, completed_at);

create trigger set_guild_weekly_goals_updated_at
before update on public.guild_weekly_goals
for each row execute function public.set_updated_at();
