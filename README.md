# Palworld Discord Bot

A Discord bot for Palworld-inspired collecting and progression. The bot is currently a JSON-backed, guild-aware bot and is being prepared for a hosted multi-server SaaS product.

## Current Features

- Wild Pal encounters with selectable sphere types.
- Public admin-triggered spawns.
- Palbox collection tracking with duplicate condensation into stars and essence.
- XP, level, coins, streaks, failed captures, and sphere inventory.
- Daily rewards and daily quests.
- Daily Research assignment shown in `/quests`.
- Per-guild leaderboards.
- Journal milestones for capture, collection, progression, and rare hunting goals.
- Pal catalog image support from `data/pals.json`.

## Commands

- `/ping` - Check whether the bot is online.
- `/help` - Show command help.
- `/start` - Claim starter rewards.
- `/capture` - Encounter a wild Pal and throw a sphere.
- `/spawn` - Admin-only public spawn in the current channel.
- `/daily` - Claim daily XP, coins, and sphere rewards.
- `/quests` - View and claim daily quest rewards.
- `/profile` - View your progression, stats, and inventory.
- `/mypals` - View your Palbox with filters and sorting.
- `/inspect` - Inspect one owned Pal.
- `/leaderboard` - View guild-scoped rankings.
- `/shop` - View sphere prices.
- `/buy` - Buy spheres with coins.

## Journal

The Journal is PalMaster's milestone layer for Alpha 0.2. Journal entries unlock
after relevant player actions, currently focused on:

- Discovery: total successful captures.
- Collector: unique Pal species owned.
- Progression: trainer level milestones.
- Rare Hunter: rare, epic, and legendary collection milestones.

New unlocks are shown in the `/capture` result when they happen. `/profile`
shows Journal completion, recent unlocks, and the nearest locked milestones.
Journal unlocks are scoped per Discord guild and player.

## Daily Research

Daily Research is PalMaster's Alpha 0.3 daily-return loop. Each player gets one
guild-scoped assignment per UTC date:

- Complete today's field research: try 3 captures.

Progress increments on each normal `/capture` attempt, whether the Pal is caught
or escapes. `/quests` shows Daily Research progress, reward, and claim status.
Daily Research rewards are modest coins and XP only, claimable once per UTC date.
This is separate from `/daily` and the existing daily quest reward.
Repeated claim clicks are guarded in-process and by persisted claimed state.

## Local Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a local `.env` file from `.env.example`.

3. Register slash commands:

   ```sh
   npm run register
   ```

4. Start the bot:

   ```sh
   npm start
   ```

For local development with reloads:

```sh
npm run dev
```

## Command Registration

Production SaaS installs should use global application commands:

```env
REGISTER_COMMANDS_SCOPE=global
```

Then run:

```sh
npm run register
```

For faster development iteration in one Discord server, use guild registration:

```env
REGISTER_COMMANDS_SCOPE=guild
DISCORD_GUILD_ID=your_dev_guild_id
```

Then run:

```sh
npm run register
```

Required for registration:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

`DISCORD_GUILD_ID` is only required when `REGISTER_COMMANDS_SCOPE=guild`.

## Validation

Run focused unit tests with:

```sh
npm test
```

Run syntax validation with:

```sh
find src scripts -name "*.js" -print0 | xargs -0 -n 1 node --check
```

## Storage Warning

Runtime storage is still local JSON under `data/`:

- `data/users.json`
- `data/user-pals.json`
- `data/pals.json`

The current shape is guild-aware, but local JSON is not safe for multi-instance hosting, concurrent writes, or durable SaaS production use. Do not delete or manually rewrite these files without backing them up.

`STORAGE_PROVIDER=json` is the default. Supabase Storage V2 is explicit opt-in only:

```env
STORAGE_PROVIDER=supabase-v2
SUPABASE_DB_URL=
```

Use `supabase-v2` only after running the Supabase validation scripts and a JSON-provider smoke test. Rollback is an environment change back to:

```env
STORAGE_PROVIDER=json
```

## Supabase

An initial SQL schema migration exists under `supabase/migrations/`. It defines the future SaaS database foundation, but the bot runtime still uses JSON storage today.

The initial migration has been applied manually to the linked Supabase project. The app does not apply migrations automatically, and runtime storage has not been switched to Supabase yet.

Run a read-only JSON import dry-run with:

```sh
node scripts/importJsonToSupabase.js
```

After setting `SUPABASE_DB_URL`, run a read-only database preflight with:

```sh
node scripts/importJsonToSupabase.js --check-db
```

The preflight verifies that required tables exist, reports row counts, and reports RLS status when available. It does not insert, update, or delete data.

Live Supabase import is guarded and must be explicitly confirmed:

```sh
node scripts/importJsonToSupabase.js --execute --confirm-import
```

Passing `--execute` by itself intentionally fails. Back up JSON files and run both the dry-run and `--check-db` before any confirmed import. The importer does not rewrite JSON files and does not switch runtime storage to Supabase.

The initial imported Supabase data has been read-validated against JSON storage. Runtime storage still defaults to JSON.

Before opting into `STORAGE_PROVIDER=supabase-v2`, run:

```sh
node scripts/importJsonToSupabase.js --check-db
node scripts/validateSupabaseStorageReadOnly.js
node scripts/validateSupabaseStorageV2ReadOnly.js
node scripts/validateSupabaseStorageV2WriteDryRun.js
```

Then smoke test in a dev/test Discord server before any production cutover.

Journal persistence for Supabase requires applying
`supabase/migrations/20260608000000_player_journal_entries.sql` before deploying
code that reads or writes Journal entries with `STORAGE_PROVIDER=supabase` or
`STORAGE_PROVIDER=supabase-v2`. JSON storage keeps Journal entries inside each
guild-scoped player record in `data/users.json`.

Daily Research persistence for Supabase requires applying
`supabase/migrations/20260608010000_player_daily_research.sql` before deploying
code that reads or writes Daily Research entries with `STORAGE_PROVIDER=supabase`
or `STORAGE_PROVIDER=supabase-v2`. JSON storage keeps Daily Research state inside
each guild-scoped player record in `data/users.json`.

For the Alpha 0.3 deployment sequence, smoke tests, and rollback notes, see
[docs/ALPHA_0_3_DEPLOYMENT_CHECKLIST.md](docs/ALPHA_0_3_DEPLOYMENT_CHECKLIST.md).

## Future SaaS Direction

The project is being prepared for:

- Supabase-backed persistence.
- Guild settings and spawn configuration.
- Admin dashboard.
- Stripe billing by Discord guild.
- Public multi-server SaaS launch.

See [docs/SUPABASE_SCHEMA_PLAN.md](docs/SUPABASE_SCHEMA_PLAN.md) and [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md).
