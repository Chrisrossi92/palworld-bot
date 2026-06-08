-- Daily Research assignments for PalMaster Alpha 0.3.
-- One research assignment per player per UTC date.

create table public.player_daily_research (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  research_date date not null,
  assignment_key text not null,
  progress integer not null default 0,
  target integer not null default 3,
  claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_daily_research_player_date_unique unique (player_id, research_date),
  constraint player_daily_research_assignment_key_check check (length(trim(assignment_key)) > 0),
  constraint player_daily_research_progress_check check (progress >= 0),
  constraint player_daily_research_target_check check (target > 0)
);

create index player_daily_research_date_idx
  on public.player_daily_research(research_date);

create index player_daily_research_player_claimed_idx
  on public.player_daily_research(player_id, claimed);

create trigger set_player_daily_research_updated_at
before update on public.player_daily_research
for each row execute function public.set_updated_at();
