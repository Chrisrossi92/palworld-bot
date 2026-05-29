# Supabase Runtime Acceptance

This document records the current acceptance status for Supabase Storage V2 runtime testing. Runtime default remains JSON.

## Milestone Summary

- Supabase schema has been applied.
- JSON data has been imported into Supabase.
- Supabase Storage V2 read validation passed.
- Supabase Storage V2 write validation passed with synthetic records.
- JSON-provider runtime smoke validation passed after async compatibility work.
- Supabase-v2 provider selection is implemented as explicit opt-in.
- Supabase-v2 dev and broader runtime smoke tests fully passed.
- Earlier interaction acknowledgement errors were caused by a duplicate PM2-managed VPS bot process, not Supabase-v2.

## Commands Tested

- `/profile`
- `/capture`
- `/buy`
- `/mypals`
- `/leaderboard`
- `/inspect`
- `/quests`

## Results

- Direhowl capture persisted to Supabase.
- `player_owned_pals` showed runtime-written rows.
- Quest progress updated.
- Inventory and coins updated.
- JSON files remained clean during Supabase-v2 runtime testing.
- Runtime default still remains `STORAGE_PROVIDER=json`.
- After the VPS bot was removed:
  - `/profile` passed.
  - `/buy` passed.
  - `/capture` passed.
  - `deferReply` lifecycle was validated.
  - Supabase writes succeeded.
- Runtime smoke test accepted.

## Rollback Plan

1. Stop the bot.
2. Set:
   ```sh
   STORAGE_PROVIDER=json
   ```
3. Restart the bot.
4. Verify `/profile`, `/mypals`, and `/capture` against JSON.
5. Do not manually roll back Supabase rows unless a specific bad write is identified.

## Remaining Watch Items

- Latency under normal Discord command use.
- Duplicate records after repeated runtime captures and buys.
- Daily quest and quest-claim edge cases.
- Public spawn behavior.
- Longer runtime stability.
- Connection pooling behavior in the target hosting environment.
- Avoiding duplicate bot processes during deployment and testing.

## Recommendation

Supabase-v2 is production-capable for continued testing. JSON remains available as the rollback provider.
