# Alpha 0.3 Deployment Checklist

This checklist covers the Journal and Daily Research deployment package.

## Migration Order

Apply these migrations to Supabase before restarting a Supabase-backed bot:

1. `supabase/migrations/20260608000000_player_journal_entries.sql`
2. `supabase/migrations/20260608010000_player_daily_research.sql`

Confirm both tables exist:

```sql
select to_regclass('public.player_journal_entries');
select to_regclass('public.player_daily_research');
```

## Pre-Restart Validation

Run from the deployed checkout after environment variables are loaded:

```sh
npm test
rg --files -g '*.js' src dashboard scripts test | xargs -n 1 node --check
npm run dashboard:check
node scripts/importJsonToSupabase.js --check-db
node scripts/validateSupabaseStorageV2ReadOnly.js
node scripts/validateSupabaseStorageV2WriteDryRun.js
```

The Supabase commands require `SUPABASE_DB_URL` and network access. They should
pass only after both migrations above are applied.

## Restart

Restart the bot process after migrations and validation pass:

```sh
pm2 restart palworld-bot
pm2 logs palworld-bot --lines 200
```

Restart the dashboard only if dashboard files or environment changed:

```sh
pm2 restart palworld-dashboard
pm2 logs palworld-dashboard --lines 200
```

Confirm there is only one active bot process using the Discord token:

```sh
pm2 list
```

## Smoke Tests

Use a test account/guild where reward mutations are acceptable.

- `/ping`
- `/profile`
- `/capture` three times
- `/quests`
  - Confirm Daily Research shows `3/3`.
  - Claim Daily Research.
  - Confirm a second claim attempt does not grant another reward.
- `/daily`
- `/leaderboard captures`
- `/shop`
- `/buy` with a small quantity if safe
- `/mypals`

Data checks:

```sh
node scripts/printSupabaseSmokeCounts.js
git status --short data/users.json data/user-pals.json data/pals.json
```

Expected with `STORAGE_PROVIDER=supabase-v2`:

- Supabase rows update for write commands.
- Local JSON data files remain unchanged.

## Rollback

Bot rollback:

1. Stop or restart `palworld-bot` with `STORAGE_PROVIDER=json`.
2. Verify `/profile`, `/mypals`, `/capture`, and `/quests`.
3. Do not delete Supabase rows unless a specific bad write is identified.

Dashboard rollback is independent. If dashboard hosting fails, restart or stop
`palworld-dashboard`; the bot can keep running.

## Known Claim Risk

Daily Research uses a per-process claim lock plus persisted claimed state. This
prevents duplicate reward grants from repeated button clicks handled by the same
bot process. A future multi-process deployment should add a database-level atomic
claim update before running more than one bot worker for the same Discord token.
