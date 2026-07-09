# PalMaster Discord Bot

PalMaster is an early-access Discord bot for Palworld-inspired collecting,
progression, and owner visibility. It is built for public soft-launch use with
an intentionally focused scope: captures, daily rewards, quests, collections,
leaderboards, public spawns, and a server-owner dashboard.

PalMaster is an independent fan-made project and is not affiliated with
Pocketpair.

## Current Features

- Wild Pal encounters with selectable sphere types.
- Public admin-triggered spawns.
- Palbox collection tracking with duplicate condensation into stars and essence.
- XP, level, coins, streaks, failed captures, and sphere inventory.
- Daily rewards and daily quests.
- Daily Research assignment shown in `/quests`.
- Weekly server capture goal shown in `/quests`.
- Per-guild leaderboards.
- Journal milestones for capture, collection, progression, and rare hunting goals.
- Shareable `/trainer` card generated from current trainer progress.
- Dedicated `/journal` command for milestone progress.
- Dedicated `/paldeck` command and derived Paldeck completion visibility in
  `/profile` and `/mypals`.
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
- `/trainer` - Share your PalMaster trainer card.
- `/journal` - View your Journal completion, recent unlocks, and next milestones.
- `/paldeck` - View Paldeck completion, recent species, and missing species preview.
- `/mypals` - View your Palbox with filters and sorting.
- `/inspect` - Inspect one owned Pal.
- `/leaderboard` - View guild-scoped rankings.
- `/shop` - View sphere prices.
- `/buy` - Buy spheres with coins.

## Trainer Card

`/trainer` generates a public, shareable trainer card from existing progress. It
shows the Discord username, level-derived trainer title, favorite Pal, Paldeck
completion, and Journal completion. Trainer Card V1 is display-only: it uses
defaults and derived data, does not add customization writes, and does not
require a new database table.

## Journal

The Journal is PalMaster's milestone layer. Journal entries unlock
after relevant player actions, currently focused on:

- Discovery: total successful captures.
- Collector: unique Pal species owned.
- Progression: trainer level milestones.
- Rare Hunter: rare, epic, and legendary collection milestones.

New unlocks are shown in the `/capture` result when they happen. `/journal`
shows Journal completion, category progress, recent unlocks, and the nearest
locked milestones. `/profile` also includes a compact Journal summary. Journal
unlocks are scoped per Discord guild and player.

## Paldeck Completion

Paldeck completion is derived from the existing Pal catalog and each player's
owned Pal collection. It does not add new persistence or schema requirements.
`/paldeck` shows Paldeck completion, recent species, a small missing species
preview, and the nearest Collector Journal milestone when one is available.
`/profile` shows compact Paldeck completion, recent species, and the nearest
Collector Journal milestone. `/mypals` shows Paldeck completion alongside
Palbox filters and sorting.

## Daily Research

Daily Research is PalMaster's daily-return loop. Each player gets one
deterministically selected, guild-scoped assignment per UTC date. The current
assignment pool is:

- Try 3 captures.
- Try 5 captures.
- Catch 1 Pal.
- Catch 2 Pals.
- Use 3 capture attempts.

Progress increments through normal `/capture` attempts. Catch assignments only
advance when a Pal is captured. `/quests` shows Daily Research progress, reward,
and claim status. Daily Research rewards are modest coins and XP only,
claimable once per UTC date. This is separate from `/daily` and the existing
daily quest reward.
Repeated claim clicks are guarded in-process and by persisted claimed state.

## Weekly Server Goal

Weekly Server Goal is PalMaster's first shared community objective. Each guild
has one weekly capture goal:

- Together, capture 100 Pals this week.

The goal resets Monday at 00:00 UTC. Progress increments only after successful
normal `/capture` attempts. Public `/spawn` captures do not advance the weekly
goal. `/quests` shows server-wide progress, completion percentage, reset copy,
and completed state with completion time when available. When a normal
successful `/capture` completes the weekly goal, the capture result shows a
short server-wide completion message once. Weekly server goals do not grant
rewards or add a claim flow yet.

## Dashboard Retention Snapshot

The owner dashboard includes a compact Retention Snapshot that answers whether
players are returning and engaging. It shows Daily Research participation,
Weekly Server Goal progress, Journal unlock momentum, and recent collection
activity from Supabase-backed tables. The dashboard handles empty or missing
retention tables with zero-state cards instead of requiring new migrations
beyond the existing Journal, Daily Research, and Weekly Server Goal migrations.

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

Weekly Server Goal persistence for Supabase requires applying
`supabase/migrations/20260608020000_guild_weekly_goals.sql` before deploying
code that reads or writes weekly guild goals with `STORAGE_PROVIDER=supabase` or
`STORAGE_PROVIDER=supabase-v2`. JSON storage keeps weekly guild goal state in
`data/guild-weekly-goals.json`.

For the current deployment sequence, smoke tests, and rollback notes, see
[docs/EARLY_ACCESS_DEPLOYMENT_RUNBOOK.md](docs/EARLY_ACCESS_DEPLOYMENT_RUNBOOK.md)
and [docs/VPS_DEPLOYMENT_PLAN.md](docs/VPS_DEPLOYMENT_PLAN.md).

## Future SaaS Direction

The project is being prepared for:

- Supabase-backed persistence.
- Guild settings and spawn configuration.
- Admin dashboard.
- Stripe billing by Discord guild.
- Public multi-server SaaS launch.

See [docs/SUPABASE_SCHEMA_PLAN.md](docs/SUPABASE_SCHEMA_PLAN.md) and [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md).
