# JSON Provider Smoke Test Plan

This plan verifies that the bot still works with `STORAGE_PROVIDER=json` after the async captureSystem and command handler refactors. It does not cut over runtime storage to Supabase.

## Preconditions

- Runtime storage remains JSON:
  ```sh
  STORAGE_PROVIDER=json
  ```
- Do not set `STORAGE_PROVIDER=supabase-v2`.
- Use a dev/test Discord server when possible.
- Back up JSON data before starting the bot:
  ```sh
  cp data/users.json data/users.json.smoke-backup
  cp data/user-pals.json data/user-pals.json.smoke-backup
  cp data/pals.json data/pals.json.smoke-backup
  ```

## Manual Command Checklist

Known smoke-test fix:

- `/profile` previously hit `DiscordAPIError[40060]: Interaction has already been acknowledged` during smoke testing. The command now guards its `deferReply`, and shared command error handling now falls back to an already-acknowledged response path when Discord reports `40060`.
- Retest `/profile` before continuing to mutation commands.

1. Start the bot with JSON storage:
   ```sh
   STORAGE_PROVIDER=json npm start
   ```
2. Run `/ping`.
3. Run `/profile`.
4. Run `/mypals`.
5. Run `/shop`.
6. Run `/buy` with a small quantity only if it is safe to mutate test data.
7. Run `/daily` only if the daily reward timing is safe to mutate test data.
8. Run `/quests`.
9. Run `/capture` once only if it is safe to mutate test data.
10. Run `/leaderboard`.
11. Run `/inspect` for a Pal the test user owns.

## Expected JSON Mutation Checks

Read-only commands should not change JSON files:

- `/ping`
- `/profile`
- `/mypals`
- `/shop`
- `/quests` when not claiming rewards
- `/leaderboard`
- `/inspect`

Commands that may change JSON files:

- `/buy`
- `/daily`
- `/capture`
- `/start`
- `/quests` when claiming completed quest rewards

After read-only commands, check for unintended changes:

```sh
git status --short data/users.json data/user-pals.json data/pals.json
```

After mutation commands, inspect expected changes only:

```sh
git diff -- data/users.json data/user-pals.json data/pals.json
```

## Rollback

If test mutations should be undone, stop the bot and restore the backed-up JSON files:

```sh
cp data/users.json.smoke-backup data/users.json
cp data/user-pals.json.smoke-backup data/user-pals.json
cp data/pals.json.smoke-backup data/pals.json
```

Then verify:

```sh
git status --short data/users.json data/user-pals.json data/pals.json
```

Do not delete JSON storage or JSON data as part of this smoke test.

## Pass Criteria

- Bot starts with `STORAGE_PROVIDER=json`.
- All listed commands respond without Promise/object-shape errors.
- Read-only commands leave JSON files unchanged.
- Mutation commands only change the expected JSON fields.
- No Supabase runtime provider is used.
