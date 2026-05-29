# Supabase Runtime Cutover Plan

This plan prepares a controlled runtime cutover from JSON storage to Supabase Storage V2. It is a planning document only. Runtime still defaults to JSON.

## Current State

- `STORAGE_PROVIDER=json` remains the default.
- The Supabase schema has been applied to the linked `palworld-bot` project.
- Current JSON data has been imported into Supabase.
- Supabase adapter read validation passed against imported data.
- Supabase Storage V2 read validation passed.
- Supabase Storage V2 write validation passed with synthetic test records.
- Command behavior and gameplay rules are unchanged.

## Cutover Principle

- JSON remains the default provider until an explicit cutover.
- Supabase cutover must require explicit environment configuration.
- Rollback should be an environment change back to JSON, not a code revert.
- Do not delete JSON data after cutover until Supabase runtime has been stable through a defined verification window.

Recommended future provider value:

```sh
STORAGE_PROVIDER=supabase-v2
SUPABASE_DB_URL=
```

The current `src/storage/index.js` does not yet support `supabase-v2`. Add support only after async compatibility work is complete.

## Required Environment

- `STORAGE_PROVIDER=supabase-v2`
- `SUPABASE_DB_URL`
- Existing Discord runtime variables:
  - `DISCORD_TOKEN`
  - `DISCORD_CLIENT_ID`
  - optional `REGISTER_COMMANDS_SCOPE`
  - optional `DISCORD_GUILD_ID`
  - optional `SPAWN_CHANNEL_ID`

Do not log `SUPABASE_DB_URL` or derived credentials.

## Preflight Checklist

1. Back up `data/users.json`, `data/user-pals.json`, and `data/pals.json`.
2. Run database preflight:
   ```sh
   node scripts/importJsonToSupabase.js --check-db
   ```
3. Run JSON versus Supabase read validation:
   ```sh
   node scripts/validateSupabaseStorageReadOnly.js
   ```
4. Run Supabase V2 read validation:
   ```sh
   node scripts/validateSupabaseStorageV2ReadOnly.js
   ```
5. Run Supabase V2 write validation:
   ```sh
   node scripts/validateSupabaseStorageV2WriteDryRun.js
   ```
6. Confirm the bot process is stopped before changing storage provider.
7. Confirm the target Discord environment is a dev/test server first.
8. Confirm rollback access to environment variables and process restart.

## Async Compatibility Finding

Current runtime storage calls are synchronous.

Findings:

- `src/storage/jsonStorage.js` exposes synchronous methods.
- `src/storage/supabaseStorage.js` also behaves synchronously by shelling out through `spawnSync`.
- `src/storage/supabaseStorageV2.js` uses `pg` and exposes async read/write methods.
- `src/systems/captureSystem.js` calls storage methods synchronously and returns immediate values.
- Command files call `captureSystem` methods synchronously, including `/profile`, `/mypals`, `/daily`, `/buy`, `/capture`, `/spawn`, `/leaderboard`, `/inspect`, and `/quests`.

Decision gate:

- Do not cut over runtime until `captureSystem` and command handlers are audited and refactored for async storage calls, or until a safe synchronous wrapper is intentionally designed.
- `STORAGE_PROVIDER=supabase-v2` should not be added to runtime provider selection before that compatibility work is complete.

## Cutover Test Sequence

Run this sequence only after async compatibility is resolved and `supabase-v2` provider support is intentionally added.

1. Stop the bot.
2. Set:
   ```sh
   STORAGE_PROVIDER=supabase-v2
   SUPABASE_DB_URL=
   ```
3. Start the bot in a dev/test Discord server only.
4. Run `/profile` with the imported test user.
5. Run `/mypals` with the imported test user.
6. Run `/daily` only if the reward timing is safe to mutate.
7. Run `/capture` once with a test user if safe.
8. Verify expected Supabase row changes.
9. Verify JSON files remain unchanged:
   ```sh
   git status --short data/users.json data/user-pals.json data/pals.json
   ```
10. Stop the bot after test completion and review logs.

## Rollback Plan

1. Stop the bot.
2. Set:
   ```sh
   STORAGE_PROVIDER=json
   ```
3. Restart the bot.
4. Verify `/profile`, `/mypals`, and `/capture` work from JSON.
5. Do not attempt partial manual database rollback unless a specific data corruption issue is identified.

## Risks

- Async compatibility: current runtime expects immediate return values from storage and gameplay methods.
- Latency: Supabase calls will add network and database latency to command interactions.
- Connection pooling: hosted runtime must support long-lived or properly reused `pg` pools.
- Transaction behavior: capture and inventory updates must stay atomic where user-visible state changes happen together.
- Daily quest edge cases: date normalization and latest quest row selection must match current JSON behavior.
- Owned Pal update semantics: current behavior condenses Pals by species and updates essence/stars; Supabase writes must preserve that behavior exactly.
- Rollback divergence: if Supabase runtime writes happen, JSON will not automatically contain those new changes after rollback.

## Readiness Decision

Runtime is not ready for Supabase cutover until async compatibility is audited and resolved. The next implementation phase should focus on async compatibility/refactor planning before enabling `STORAGE_PROVIDER=supabase-v2`.
