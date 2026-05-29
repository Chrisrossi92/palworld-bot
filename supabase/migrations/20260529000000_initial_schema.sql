-- Initial Supabase schema for the Palworld Discord bot SaaS foundation.
-- Runtime still uses JSON storage. This migration is not applied by the app.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.discord_users (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  username text,
  global_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discord_guilds (
  id uuid primary key default gen_random_uuid(),
  discord_guild_id text not null unique,
  name text,
  icon_url text,
  owner_discord_user_id text,
  member_count integer check (member_count is null or member_count >= 0),
  installed_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guild_memberships (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  user_id uuid not null references public.discord_users(id) on delete cascade,
  discord_user_id text not null,
  role text not null default 'member',
  can_manage_guild boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_memberships_role_check check (role in ('owner', 'admin', 'member')),
  constraint guild_memberships_guild_user_unique unique (guild_id, user_id)
);

create table public.guild_settings (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null unique references public.discord_guilds(id) on delete cascade,
  spawn_channel_discord_id text,
  auto_spawn_enabled boolean not null default false,
  auto_spawn_interval_minutes integer not null default 60,
  command_channel_discord_ids text[],
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_settings_auto_spawn_interval_check check (auto_spawn_interval_minutes > 0)
);

create table public.pal_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  rarity text not null,
  unlock_level integer not null,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pal_catalog_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  constraint pal_catalog_unlock_level_check check (unlock_level >= 1)
);

create table public.guild_players (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  user_id uuid not null references public.discord_users(id) on delete cascade,
  xp integer not null default 0,
  coins integer not null default 100,
  level integer not null default 1,
  captures integer not null default 0,
  failed_captures integer not null default 0,
  streak integer not null default 0,
  starter_claimed boolean not null default false,
  last_daily_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_players_guild_user_unique unique (guild_id, user_id),
  constraint guild_players_xp_check check (xp >= 0),
  constraint guild_players_coins_check check (coins >= 0),
  constraint guild_players_level_check check (level >= 1),
  constraint guild_players_captures_check check (captures >= 0),
  constraint guild_players_failed_captures_check check (failed_captures >= 0),
  constraint guild_players_streak_check check (streak >= 0)
);

create table public.player_sphere_inventory (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  sphere_type text not null,
  quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_sphere_inventory_player_sphere_unique unique (player_id, sphere_type),
  constraint player_sphere_inventory_sphere_type_check check (sphere_type in ('basic', 'mega', 'giga', 'hyper', 'ultra', 'legendary')),
  constraint player_sphere_inventory_quantity_check check (quantity >= 0)
);

create table public.player_owned_pals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  pal_id uuid not null references public.pal_catalog(id),
  level integer not null default 1,
  rarity text not null,
  is_shiny boolean not null default false,
  image_url text,
  stars integer not null default 0,
  essence integer not null default 0,
  extra_essence integer not null default 0,
  first_caught_at timestamptz,
  last_caught_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_owned_pals_player_pal_unique unique (player_id, pal_id),
  constraint player_owned_pals_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  constraint player_owned_pals_level_check check (level >= 1),
  constraint player_owned_pals_stars_check check (stars between 0 and 4),
  constraint player_owned_pals_essence_check check (essence >= 0),
  constraint player_owned_pals_extra_essence_check check (extra_essence >= 0)
);

create table public.capture_history (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  player_id uuid not null references public.guild_players(id) on delete cascade,
  pal_id uuid references public.pal_catalog(id),
  pal_name text not null,
  encounter_level integer,
  rarity text not null,
  is_shiny boolean not null default false,
  sphere_type text not null,
  capture_chance integer not null,
  success boolean not null,
  xp_gained integer not null default 0,
  coins_gained integer not null default 0,
  collection_outcome text,
  created_at timestamptz not null default now(),
  constraint capture_history_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  constraint capture_history_sphere_type_check check (sphere_type in ('basic', 'mega', 'giga', 'hyper', 'ultra', 'legendary')),
  constraint capture_history_capture_chance_check check (capture_chance between 0 and 100),
  constraint capture_history_xp_gained_check check (xp_gained >= 0),
  constraint capture_history_coins_gained_check check (coins_gained >= 0),
  constraint capture_history_encounter_level_check check (encounter_level is null or encounter_level >= 1),
  constraint capture_history_collection_outcome_check check (collection_outcome is null or collection_outcome in ('new', 'duplicate', 'none'))
);

create table public.daily_reward_claims (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  claim_date date not null,
  coins_gained integer not null default 0,
  xp_gained integer not null default 0,
  sphere_rewards jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  constraint daily_reward_claims_player_date_unique unique (player_id, claim_date),
  constraint daily_reward_claims_coins_gained_check check (coins_gained >= 0),
  constraint daily_reward_claims_xp_gained_check check (xp_gained >= 0)
);

create table public.player_daily_quests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  quest_date date not null,
  capture_attempts integer not null default 0,
  successful_captures integer not null default 0,
  claimed boolean not null default false,
  claimed_at timestamptz,
  reward_coins integer not null default 0,
  reward_xp integer not null default 0,
  reward_spheres jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_daily_quests_player_date_unique unique (player_id, quest_date),
  constraint player_daily_quests_capture_attempts_check check (capture_attempts >= 0),
  constraint player_daily_quests_successful_captures_check check (successful_captures >= 0),
  constraint player_daily_quests_reward_coins_check check (reward_coins >= 0),
  constraint player_daily_quests_reward_xp_check check (reward_xp >= 0)
);

create table public.spawn_configs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null unique references public.discord_guilds(id) on delete cascade,
  channel_discord_id text,
  enabled boolean not null default false,
  interval_minutes integer not null default 60,
  next_spawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spawn_configs_interval_minutes_check check (interval_minutes > 0)
);

create table public.spawn_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  channel_discord_id text not null,
  message_discord_id text,
  pal_id uuid references public.pal_catalog(id),
  pal_name text not null,
  rarity text not null,
  is_shiny boolean not null default false,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_player_id uuid references public.guild_players(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spawn_events_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  constraint spawn_events_status_check check (status in ('active', 'captured', 'escaped', 'expired', 'error'))
);

create table public.guild_subscriptions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null unique references public.discord_guilds(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  plan_key text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_subscriptions_status_check check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'))
);

create table public.dashboard_access_grants (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  user_id uuid not null references public.discord_users(id) on delete cascade,
  access_level text not null default 'admin',
  granted_by_user_id uuid references public.discord_users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_access_grants_guild_user_unique unique (guild_id, user_id),
  constraint dashboard_access_grants_access_level_check check (access_level in ('owner', 'admin', 'viewer'))
);

create index discord_guilds_removed_at_idx on public.discord_guilds(removed_at);

create index guild_memberships_guild_id_idx on public.guild_memberships(guild_id);
create index guild_memberships_user_id_idx on public.guild_memberships(user_id);
create index guild_memberships_guild_manage_idx on public.guild_memberships(guild_id, can_manage_guild);

create index guild_settings_spawn_channel_idx on public.guild_settings(spawn_channel_discord_id);

create index pal_catalog_rarity_idx on public.pal_catalog(rarity);
create index pal_catalog_unlock_level_idx on public.pal_catalog(unlock_level);

create index guild_players_level_idx on public.guild_players(guild_id, level desc, xp desc);
create index guild_players_coins_idx on public.guild_players(guild_id, coins desc);
create index guild_players_captures_idx on public.guild_players(guild_id, captures desc);

create index player_owned_pals_last_caught_idx on public.player_owned_pals(player_id, last_caught_at desc);
create index player_owned_pals_shiny_idx on public.player_owned_pals(player_id, is_shiny);
create index player_owned_pals_stars_idx on public.player_owned_pals(player_id, stars desc);
create index player_owned_pals_pal_id_idx on public.player_owned_pals(pal_id);

create index capture_history_guild_created_idx on public.capture_history(guild_id, created_at desc);
create index capture_history_player_created_idx on public.capture_history(player_id, created_at desc);
create index capture_history_guild_success_created_idx on public.capture_history(guild_id, success, created_at desc);
create index capture_history_guild_shiny_created_idx on public.capture_history(guild_id, is_shiny, created_at desc);

create index daily_reward_claims_claim_date_idx on public.daily_reward_claims(claim_date);

create index player_daily_quests_quest_date_idx on public.player_daily_quests(quest_date);
create index player_daily_quests_player_claimed_idx on public.player_daily_quests(player_id, claimed);

create index spawn_configs_enabled_next_spawn_idx on public.spawn_configs(enabled, next_spawn_at);
create index spawn_configs_channel_idx on public.spawn_configs(channel_discord_id);

create index spawn_events_guild_started_idx on public.spawn_events(guild_id, started_at desc);
create index spawn_events_guild_status_idx on public.spawn_events(guild_id, status);
create index spawn_events_message_idx on public.spawn_events(message_discord_id);
create unique index spawn_events_one_active_per_channel_idx
  on public.spawn_events(guild_id, channel_discord_id)
  where status = 'active';

create index guild_subscriptions_status_idx on public.guild_subscriptions(status);
create index guild_subscriptions_current_period_end_idx on public.guild_subscriptions(current_period_end);

create index dashboard_access_grants_user_id_idx on public.dashboard_access_grants(user_id);
create index dashboard_access_grants_guild_revoked_idx on public.dashboard_access_grants(guild_id, revoked_at);

create trigger set_discord_users_updated_at
before update on public.discord_users
for each row execute function public.set_updated_at();

create trigger set_discord_guilds_updated_at
before update on public.discord_guilds
for each row execute function public.set_updated_at();

create trigger set_guild_memberships_updated_at
before update on public.guild_memberships
for each row execute function public.set_updated_at();

create trigger set_guild_settings_updated_at
before update on public.guild_settings
for each row execute function public.set_updated_at();

create trigger set_pal_catalog_updated_at
before update on public.pal_catalog
for each row execute function public.set_updated_at();

create trigger set_guild_players_updated_at
before update on public.guild_players
for each row execute function public.set_updated_at();

create trigger set_player_sphere_inventory_updated_at
before update on public.player_sphere_inventory
for each row execute function public.set_updated_at();

create trigger set_player_owned_pals_updated_at
before update on public.player_owned_pals
for each row execute function public.set_updated_at();

create trigger set_player_daily_quests_updated_at
before update on public.player_daily_quests
for each row execute function public.set_updated_at();

create trigger set_spawn_configs_updated_at
before update on public.spawn_configs
for each row execute function public.set_updated_at();

create trigger set_spawn_events_updated_at
before update on public.spawn_events
for each row execute function public.set_updated_at();

create trigger set_guild_subscriptions_updated_at
before update on public.guild_subscriptions
for each row execute function public.set_updated_at();

create trigger set_dashboard_access_grants_updated_at
before update on public.dashboard_access_grants
for each row execute function public.set_updated_at();

-- RLS status:
-- Row level security is intentionally not implemented in this migration.
-- Future dashboard work should add policies that scope dashboard users to
-- guilds they manage, while trusted bot/backend code uses service-role access.
