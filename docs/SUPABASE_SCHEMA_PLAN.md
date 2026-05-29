# Supabase Schema Plan

This plan describes the target database model for replacing the current JSON files while keeping the bot ready for multi-server SaaS features. It is intentionally a planning document only: no runtime Supabase integration, package install, or applied migration is included in this slice.

## Goals

- Scope player progression by Discord guild and Discord user.
- Keep Discord IDs as text fields while using UUID primary keys internally.
- Support current bot features: capture, XP, levels, economy, inventory, daily rewards, quests, public spawns, and palbox.
- Leave room for future dashboard access, guild settings, billing, and subscriptions.
- Preserve enough event history to audit player progression and debug support issues.

## Recommended Extensions

Future SQL migrations should enable:

- `pgcrypto` for `gen_random_uuid()`.

## Tables

### discord_users

Global Discord user identity. A user can belong to many guilds.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `discord_user_id text not null unique`
- `username text`
- `global_name text`
- `avatar_url text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique index on `discord_user_id`.

### discord_guilds

Discord servers where the bot has been installed.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `discord_guild_id text not null unique`
- `name text`
- `icon_url text`
- `owner_discord_user_id text`
- `member_count integer`
- `installed_at timestamptz not null default now()`
- `removed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique index on `discord_guild_id`.
- Index on `removed_at` for active/removed install filters.

### guild_memberships

Join table connecting Discord users to guilds. This is also the future place to store guild-level roles and dashboard permissions.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null references discord_guilds(id) on delete cascade`
- `user_id uuid not null references discord_users(id) on delete cascade`
- `discord_user_id text not null`
- `role text not null default 'member'`
- `can_manage_guild boolean not null default false`
- `joined_at timestamptz`
- `left_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `guild_id, user_id`.
- `role` should eventually be constrained to known values such as `owner`, `admin`, `member`.

Indexes:

- Index on `guild_id`.
- Index on `user_id`.
- Index on `guild_id, can_manage_guild`.

### guild_settings

One settings row per guild for bot behavior and future dashboard-configurable options.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null unique references discord_guilds(id) on delete cascade`
- `spawn_channel_discord_id text`
- `auto_spawn_enabled boolean not null default false`
- `auto_spawn_interval_minutes integer not null default 60`
- `command_channel_discord_ids text[]`
- `timezone text not null default 'UTC'`
- `settings jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique index on `guild_id`.
- Index on `spawn_channel_discord_id`.

### pal_catalog

Global Pal catalog. This replaces `data/pals.json`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `slug text not null unique`
- `name text not null unique`
- `rarity text not null`
- `unlock_level integer not null`
- `image_url text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `unlock_level >= 1`.
- `rarity` should eventually be constrained to `common`, `uncommon`, `rare`, `epic`, `legendary`.

Indexes:

- Unique index on `slug`.
- Unique index on `name`.
- Index on `rarity`.
- Index on `unlock_level`.

### guild_players

Guild-scoped player progression. This replaces each record in `users[guild_id][user_id]`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null references discord_guilds(id) on delete cascade`
- `user_id uuid not null references discord_users(id) on delete cascade`
- `xp integer not null default 0`
- `coins integer not null default 100`
- `level integer not null default 1`
- `captures integer not null default 0`
- `failed_captures integer not null default 0`
- `streak integer not null default 0`
- `starter_claimed boolean not null default false`
- `last_daily_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `guild_id, user_id`.
- Non-negative checks for XP, coins, captures, failed captures, and streak.
- `level >= 1`.

Indexes:

- Unique index on `guild_id, user_id`.
- Index on `guild_id, level desc, xp desc`.
- Index on `guild_id, coins desc`.
- Index on `guild_id, captures desc`.

### player_sphere_inventory

Current sphere inventory per guild-scoped player.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `player_id uuid not null references guild_players(id) on delete cascade`
- `sphere_type text not null`
- `quantity integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `player_id, sphere_type`.
- `quantity >= 0`.
- `sphere_type` should eventually be constrained to `basic`, `mega`, `giga`, `hyper`, `ultra`, `legendary`.

Indexes:

- Unique index on `player_id, sphere_type`.

### player_owned_pals

Guild-scoped player palbox. This replaces `userPals[guild_id][user_id]`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `player_id uuid not null references guild_players(id) on delete cascade`
- `pal_id uuid not null references pal_catalog(id)`
- `level integer not null default 1`
- `rarity text not null`
- `is_shiny boolean not null default false`
- `image_url text`
- `stars integer not null default 0`
- `essence integer not null default 0`
- `extra_essence integer not null default 0`
- `first_caught_at timestamptz`
- `last_caught_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `player_id, pal_id`.
- `level >= 1`.
- `stars between 0 and 4`.
- Non-negative checks for `essence` and `extra_essence`.

Indexes:

- Unique index on `player_id, pal_id`.
- Index on `player_id, last_caught_at desc`.
- Index on `player_id, is_shiny`.
- Index on `player_id, stars desc`.
- Index on `pal_id`.

### capture_history

Append-only capture attempts. This supports auditability, future analytics, and dashboard activity feeds.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null references discord_guilds(id) on delete cascade`
- `player_id uuid not null references guild_players(id) on delete cascade`
- `pal_id uuid references pal_catalog(id)`
- `pal_name text not null`
- `encounter_level integer`
- `rarity text not null`
- `is_shiny boolean not null default false`
- `sphere_type text not null`
- `capture_chance integer not null`
- `success boolean not null`
- `xp_gained integer not null default 0`
- `coins_gained integer not null default 0`
- `collection_outcome text`
- `created_at timestamptz not null default now()`

Indexes:

- Index on `guild_id, created_at desc`.
- Index on `player_id, created_at desc`.
- Index on `guild_id, success, created_at desc`.
- Index on `guild_id, is_shiny, created_at desc`.

### daily_reward_claims

Daily `/daily` reward claims per player. This makes daily claim behavior explicit instead of relying only on `last_daily_at`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `player_id uuid not null references guild_players(id) on delete cascade`
- `claim_date date not null`
- `coins_gained integer not null default 0`
- `xp_gained integer not null default 0`
- `sphere_rewards jsonb not null default '{}'::jsonb`
- `claimed_at timestamptz not null default now()`

Constraints:

- Unique `player_id, claim_date`.

Indexes:

- Unique index on `player_id, claim_date`.
- Index on `claim_date`.

### player_daily_quests

Daily quest progress per player. This replaces the nested `dailyQuests` object in `users.json`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `player_id uuid not null references guild_players(id) on delete cascade`
- `quest_date date not null`
- `capture_attempts integer not null default 0`
- `successful_captures integer not null default 0`
- `claimed boolean not null default false`
- `claimed_at timestamptz`
- `reward_coins integer not null default 0`
- `reward_xp integer not null default 0`
- `reward_spheres jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `player_id, quest_date`.
- Non-negative checks for progress and rewards.

Indexes:

- Unique index on `player_id, quest_date`.
- Index on `quest_date`.
- Index on `player_id, claimed`.

### spawn_configs

Per-guild public spawn configuration. This supports replacing the single `SPAWN_CHANNEL_ID`.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null unique references discord_guilds(id) on delete cascade`
- `channel_discord_id text`
- `enabled boolean not null default false`
- `interval_minutes integer not null default 60`
- `next_spawn_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique index on `guild_id`.
- Index on `enabled, next_spawn_at`.
- Index on `channel_discord_id`.

### spawn_events

Spawn log and optional active spawn state. Use this to avoid in-memory-only active spawn tracking once the bot runs across multiple instances.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null references discord_guilds(id) on delete cascade`
- `channel_discord_id text not null`
- `message_discord_id text`
- `pal_id uuid references pal_catalog(id)`
- `pal_name text not null`
- `rarity text not null`
- `is_shiny boolean not null default false`
- `status text not null default 'active'`
- `started_at timestamptz not null default now()`
- `resolved_at timestamptz`
- `resolved_by_player_id uuid references guild_players(id)`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status` should eventually be constrained to `active`, `captured`, `escaped`, `expired`, `error`.

Indexes:

- Index on `guild_id, started_at desc`.
- Index on `guild_id, status`.
- Unique partial index on `guild_id, channel_discord_id where status = 'active'` to prevent duplicate active spawns per channel.
- Index on `message_discord_id`.

### guild_subscriptions

Future Stripe subscription state by guild. A guild may have one current subscription.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null unique references discord_guilds(id) on delete cascade`
- `stripe_customer_id text unique`
- `stripe_subscription_id text unique`
- `status text not null default 'inactive'`
- `plan_key text`
- `current_period_start timestamptz`
- `current_period_end timestamptz`
- `cancel_at_period_end boolean not null default false`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique index on `guild_id`.
- Unique index on `stripe_customer_id`.
- Unique index on `stripe_subscription_id`.
- Index on `status`.
- Index on `current_period_end`.

### dashboard_access_grants

Future admin dashboard access. This should be derived from Discord ownership/admin permissions where possible, but persisted grants allow explicit overrides.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `guild_id uuid not null references discord_guilds(id) on delete cascade`
- `user_id uuid not null references discord_users(id) on delete cascade`
- `access_level text not null default 'admin'`
- `granted_by_user_id uuid references discord_users(id)`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `guild_id, user_id`.
- `access_level` should eventually be constrained to `owner`, `admin`, `viewer`.

Indexes:

- Unique index on `guild_id, user_id`.
- Index on `user_id`.
- Index on `guild_id, revoked_at`.

## Relationship Notes

- `discord_users` stores a Discord identity once globally.
- `discord_guilds` stores a Discord server once globally.
- `guild_memberships` connects users to guilds and supports dashboard authorization.
- `guild_players` is the core gameplay tenant boundary. Any player progression query should start from `guild_id + user_id`.
- `player_owned_pals`, `player_sphere_inventory`, `daily_reward_claims`, and `player_daily_quests` belong to `guild_players`.
- `pal_catalog` is global and shared by every guild.
- `capture_history` is append-only and links a guild, player, and optional catalog Pal.
- `guild_settings` and `spawn_configs` are one-to-one with guilds.
- `spawn_events` can represent both active spawns and historical spawn outcomes.
- `guild_subscriptions` is one-to-one with guilds.
- `dashboard_access_grants` is guild-scoped and should be checked together with live Discord permissions when the dashboard exists.

## Future RLS Notes

Do not implement RLS in this planning slice. When Supabase Auth and the dashboard are introduced:

- Bot server-side jobs should use a service role key and bypass RLS from trusted backend code.
- Dashboard users should only read guilds where they have `guild_memberships.can_manage_guild = true` or an active `dashboard_access_grants` row.
- Dashboard users should only update `guild_settings`, `spawn_configs`, and non-sensitive guild display metadata for guilds they manage.
- Player-facing dashboard views should only expose the requesting user's own `guild_players`, `player_owned_pals`, inventory, and history unless a guild admin view is active.
- Billing tables should be readable only by guild admins/owners and writable only by trusted webhook/backend handlers.

## Migration Strategy From JSON

Current JSON files:

- `data/pals.json`
- `data/users.json`
- `data/user-pals.json`

Recommended migration flow:

1. Export a timestamped backup of all JSON files before any import.
2. Ensure the guild-aware JSON shape has already run at least once:
   - `users[guildId][userId]`
   - `userPals[guildId][userId]`
3. Import `data/pals.json` into `pal_catalog`.
   - Generate `slug` from Pal name.
   - Preserve `name`, `rarity`, `unlockLevel` as `unlock_level`, and `imageUrl` as `image_url`.
4. For each `guildId` in `users.json` and `user-pals.json`, upsert a `discord_guilds` row.
   - If only the Discord ID is known, leave name/icon/member metadata nullable until the bot sees the guild again.
5. For each `userId`, upsert a `discord_users` row.
   - Usernames can be filled opportunistically from Discord interactions later.
6. Upsert `guild_memberships` for each observed guild/user pair.
7. Upsert `guild_players` from `users[guildId][userId]`.
   - Preserve `xp`, `coins`, `level`, `captures`, `failedCaptures`, `streak`, `starterClaimed`, `lastDailyAt`, and timestamps.
8. Import each player's `spheres` object into `player_sphere_inventory`.
9. Import each player's daily quest object into `player_daily_quests` using its stored `date`.
10. Import `user-pals.json` into `player_owned_pals`.
    - Match Pal names to `pal_catalog.name`.
    - Preserve level, rarity, shiny state, image URL, caught timestamps, stars, essence, and extra essence.
11. Do not synthesize full `capture_history` for old data unless needed.
    - If desired, create one historical successful event per owned Pal using `caughtAt`, but mark it with `metadata.imported = true`.
12. Run consistency checks:
    - Count guilds.
    - Count players per guild.
    - Count owned Pals per player.
    - Compare aggregate captures and palbox counts against the JSON source.
13. Keep JSON as read-only fallback during a short verification period before removing runtime JSON writes in a later slice.

## Open Modeling Decisions

- Whether daily reset should use each guild's timezone or remain UTC.
- Whether `/daily` and `/quests` should share one reward ledger table or stay separate for clarity.
- Whether active spawns should be represented by `spawn_events.status = 'active'` only, or split into `active_spawns` plus immutable logs.
- Whether owned Pal uniqueness should remain one row per species per player, matching current condensation behavior, or eventually allow multiple copies.
- Whether dashboard access should rely entirely on live Discord OAuth guild permissions, persisted grants, or both.
- How much historical capture data to backfill from existing condensed Palbox data.
