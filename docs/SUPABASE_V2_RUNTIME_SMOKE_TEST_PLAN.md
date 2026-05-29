# Supabase V2 Runtime Smoke Test Plan

This plan is for a dev-only runtime smoke test with `STORAGE_PROVIDER=supabase-v2`. It does not change the default runtime provider, which remains JSON.

## Required Environment

```sh
STORAGE_PROVIDER=supabase-v2
SUPABASE_DB_URL=
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
REGISTER_COMMANDS_SCOPE=guild
DISCORD_GUILD_ID=
SPAWN_CHANNEL_ID=
```

Use a dev/test Discord server. Do not run this first in production.

## Preflight

1. Stop any running bot process.
2. Confirm JSON backups exist:
   ```sh
   ls data/users.json.smoke-backup data/user-pals.json.smoke-backup data/pals.json.smoke-backup
   ```
3. Run database preflight:
   ```sh
   node scripts/importJsonToSupabase.js --check-db
   ```
4. Run Supabase V2 read validation:
   ```sh
   node scripts/validateSupabaseStorageV2ReadOnly.js
   ```
5. Run Supabase V2 write validation:
   ```sh
   node scripts/validateSupabaseStorageV2WriteDryRun.js
   ```
6. Record pre-test Supabase counts:
   ```sh
   node scripts/printSupabaseSmokeCounts.js
   ```
7. Confirm JSON data files are clean before starting:
   ```sh
   git status --short data/users.json data/user-pals.json data/pals.json
   ```

## Start Command

```sh
STORAGE_PROVIDER=supabase-v2 npm start
```

## Test Order

1. `/ping`
2. `/profile`
3. `/mypals`
4. `/shop`
5. `/leaderboard`
6. `/inspect`
7. `/buy` with a small quantity
8. `/capture` once

Run only one tester through the mutation commands unless intentionally testing concurrency.

## Verification

After the command sequence:

1. Record post-test Supabase counts:
   ```sh
   node scripts/printSupabaseSmokeCounts.js
   ```
2. Verify expected Supabase values changed for the test guild/user:
   - Coins changed after `/buy`.
   - Sphere inventory changed after `/buy` and `/capture`.
   - Owned Pal state changed only if `/capture` succeeded.
   - Player progression changed after `/capture`.
3. Verify JSON files remain unchanged:
   ```sh
   git status --short data/users.json data/user-pals.json data/pals.json
   ```
4. Check bot logs for:
   - No interaction acknowledgement errors.
   - No unhandled Promise errors.
   - No database connection or transaction errors.
   - No command timeouts.

## Rollback

1. Stop the bot.
2. Restart with JSON storage:
   ```sh
   STORAGE_PROVIDER=json npm start
   ```
3. Verify `/profile`, `/mypals`, and `/capture` still work from JSON.

Do not attempt manual Supabase row rollback unless a specific bad write is identified.

## Stop Criteria

Stop the test immediately if any of these occur:

- Any command crashes.
- Any double acknowledgement error appears.
- JSON files mutate unexpectedly.
- Supabase writes target the wrong guild or user.
- A command response takes too long for Discord interaction timing.
- Any unhandled Promise rejection appears in logs.
