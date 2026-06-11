-- Per-guild public spawn scheduling settings.
-- Defaults are disabled so newly installed guilds never receive automated
-- public spawns until an owner/admin explicitly configures a channel.

create table if not exists public.guild_spawn_settings (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null unique references public.discord_guilds(id) on delete cascade,
  enabled boolean not null default false,
  channel_id text,
  interval_minutes integer not null default 60,
  last_spawn_at timestamptz,
  next_spawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_spawn_settings_interval_minutes_check check (interval_minutes >= 30),
  constraint guild_spawn_settings_enabled_channel_check check (
    enabled = false or channel_id is not null
  )
);

create index if not exists guild_spawn_settings_enabled_next_spawn_idx
  on public.guild_spawn_settings(enabled, next_spawn_at);

create index if not exists guild_spawn_settings_channel_idx
  on public.guild_spawn_settings(channel_id);

drop trigger if exists set_guild_spawn_settings_updated_at on public.guild_spawn_settings;
create trigger set_guild_spawn_settings_updated_at
before update on public.guild_spawn_settings
for each row execute function public.set_updated_at();

insert into public.guild_spawn_settings (guild_id, enabled, interval_minutes)
select guilds.id, false, 60
from public.discord_guilds guilds
on conflict (guild_id) do nothing;
