# JSON to Supabase Migration Plan

This document defines the safe migration path from local JSON files to the Supabase schema. Runtime storage still uses JSON, and live import is available only through an explicit confirmation gate.

## Source Files

- `data/pals.json`
- `data/users.json`
- `data/user-pals.json`

## Target Tables

- `pal_catalog`
- `discord_guilds`
- `discord_users`
- `guild_memberships`
- `guild_players`
- `player_sphere_inventory`
- `player_owned_pals`
- `player_daily_quests`

Capture history should not be backfilled by default because current condensed Palbox data does not contain every historical capture attempt. If historical rows are later synthesized, they should be marked as imported metadata.

## Safety Rules

- Dry-run must be the default.
- The import script must never rewrite JSON files.
- Malformed JSON must fail closed.
- Live Supabase import must require both `--execute` and `--confirm-import`.
- `--execute` without `--confirm-import` must fail closed.
- Back up all JSON files before any live import.
- Counts from the dry-run must be recorded before and after import.
- Live import must run inside a transaction and rollback on any failed step.
- Database URLs and secrets must never be logged.

## Shape Handling

The preferred JSON shape is guild-aware:

```json
{
  "guildId": {
    "userId": {}
  }
}
```

Legacy flat user data is still supported during planning:

```json
{
  "userId": {}
}
```

When flat data is detected, the import scaffold reports the guild bucket it would use. The bucket is `DISCORD_GUILD_ID` when present, otherwise `__legacy__`.

## Dry-Run Checks

The scaffold at `scripts/importJsonToSupabase.js` reports:

- Pal catalog count.
- Guild count.
- Player count.
- Palbox owner count.
- Owned Pal count.
- Expected sphere inventory row count.
- Expected daily quest row count.
- Whether legacy flat shape was detected.
- Which legacy guild bucket would be used.

## Database Preflight

After setting `SUPABASE_DB_URL`, run:

```sh
node scripts/importJsonToSupabase.js --check-db
```

This mode is read-only. It verifies required tables, reports row counts, and reports RLS status when available. It performs no inserts, updates, or deletes.

## Import Order

Live import uses this order:

1. Import `pal_catalog`.
2. Upsert `discord_guilds`.
3. Upsert `discord_users`.
4. Upsert `guild_memberships`.
5. Upsert `guild_players`.
6. Insert or upsert `player_sphere_inventory`.
7. Insert or upsert `player_daily_quests`.
8. Insert or upsert `player_owned_pals`.
9. Run post-import consistency checks.

## Live Import Command

Live import requires an explicit confirmation gate:

```sh
node scripts/importJsonToSupabase.js --execute --confirm-import
```

The script:

- Requires `SUPABASE_DB_URL`.
- Reads JSON files without rewriting them.
- Fails closed on malformed JSON.
- Prints dry-run source counts.
- Prints database row counts before and after import.
- Uses a single transaction for import writes.
- Rolls back the transaction if any statement fails.
- Does not synthesize `capture_history`.

The live import should only be run after backing up JSON files and reviewing dry-run plus `--check-db` output.

## Post-Import Checks

- Compare Pal catalog count.
- Compare guild count.
- Compare player count.
- Compare Palbox owner count.
- Compare total owned Pal count.
- Spot-check one known guild/player pair.
- Spot-check one known Palbox entry.
- Confirm runtime still reads JSON until the Supabase storage adapter is explicitly enabled.

## Live Import Requirements Before Running

- Supabase migration applied in a non-production project.
- Supabase storage adapter design finalized.
- Service-role environment variables documented.
- Dry-run counts reviewed.
- JSON backup created.
- Rollback plan documented.
