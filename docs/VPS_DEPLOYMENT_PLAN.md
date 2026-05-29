# Controlled VPS Deployment Plan

Phase 7C-1 plans the safe VPS deployment path for the Palworld owner platform. This is a planning document only. Do not deploy from this plan until explicitly instructed.

## Goals

- Host the public landing page and owner dashboard.
- Run the Discord bot as a controlled PM2 process.
- Use Supabase Storage V2 intentionally for early-access runtime.
- Avoid disrupting unrelated VPS services.
- Preserve JSON as the rollback provider.

## Do Not Touch

Do not stop, restart, rename, delete, or modify:

- `cdawg-bot`
- `cdawg-dashboard`
- Palworld game server services.
- Valheim services.
- Any unrelated PM2 process.
- Any unrelated `/root` application directory.

## Current VPS State Inspection

Before copying code or starting processes, inspect the VPS state.

Commands to run first:

```sh
pm2 list
pm2 describe cdawg-bot
pm2 describe cdawg-dashboard
ls -la /root
ls -la /root/palworld-bot
```

Inspection goals:

- Confirm whether an old `palworld-bot` PM2 process exists.
- Confirm whether an old `palworld-dashboard` PM2 process exists.
- Confirm whether `/root/palworld-bot` exists.
- Confirm whether `/root/palworld-bot` is old, dirty, or active.
- Confirm `cdawg-bot` and `cdawg-dashboard` are unrelated and should remain untouched.
- Confirm no old local shell, PM2 process, Docker container, or service is already using the same Discord bot token.

If `/root/palworld-bot` exists, do not overwrite it until it is backed up or confirmed disposable.

## Deployment Target

Recommended repo path:

```sh
/root/palworld-owner-platform
```

Use a new path instead of reusing an old `/root/palworld-bot` directory unless the old directory has been backed up and explicitly cleared.

PM2 process names:

- `palworld-bot`
- `palworld-dashboard`

Dashboard port:

```sh
DASHBOARD_PORT=3000
```

Public URL/domain plan:

- Point the public landing/dashboard domain to the dashboard process.
- Configure reverse proxy from HTTPS public URL to `localhost:3000`.
- Set `DASHBOARD_BASE_URL` to the public HTTPS URL.
- Add `${DASHBOARD_BASE_URL}/auth/discord/callback` to the Discord Developer Portal OAuth redirect URLs.

## Required Production Environment

Bot and dashboard shared:

```sh
DISCORD_CLIENT_ID=
SUPABASE_DB_URL=
```

Bot process:

```sh
DISCORD_TOKEN=
REGISTER_COMMANDS_SCOPE=global
DISCORD_GUILD_ID=
STORAGE_PROVIDER=supabase-v2
SPAWN_CHANNEL_ID=
```

Use `REGISTER_COMMANDS_SCOPE=guild` and `DISCORD_GUILD_ID` only if the early-access launch is intentionally limited to one dev/test guild.

Dashboard process:

```sh
DISCORD_CLIENT_SECRET=
DASHBOARD_PORT=3000
DASHBOARD_BASE_URL=
DASHBOARD_SESSION_SECRET=
DISCORD_BOT_INVITE_URL=
SUPPORT_SERVER_URL=
```

Environment rules:

- Do not commit production secrets.
- Do not rely on temporary shell exports for PM2-managed processes.
- Prefer a PM2 ecosystem file, service env file, or deployment environment.
- Keep `STORAGE_PROVIDER=supabase-v2` explicit for the bot process.

## Safe Deployment Sequence

1. Inspect current state:
   ```sh
   pm2 list
   ls -la /root
   ls -la /root/palworld-bot
   ```
2. Stop/delete only old Palworld owner-platform PM2 processes if present:
   ```sh
   pm2 stop palworld-bot
   pm2 delete palworld-bot
   pm2 stop palworld-dashboard
   pm2 delete palworld-dashboard
   ```
3. Back up old deployment directory if present:
   ```sh
   mv /root/palworld-bot /root/palworld-bot.backup-$(date +%Y%m%d-%H%M%S)
   ```
4. Create or update the target repo path:
   ```sh
   mkdir -p /root/palworld-owner-platform
   ```
5. Pull or copy the latest repo into the target path.
6. Install dependencies:
   ```sh
   npm install
   ```
7. Run validation:
   ```sh
   npm run dashboard:check
   node --check src/index.js
   node --check src/systems/captureSystem.js
   node scripts/importJsonToSupabase.js --check-db
   node scripts/validateSupabaseStorageV2ReadOnly.js
   node scripts/validateSupabaseStorageV2WriteDryRun.js
   ```
8. Start dashboard only:
   ```sh
   pm2 start npm --name palworld-dashboard -- run dashboard:start
   ```
9. Smoke dashboard:
   - Open `/`.
   - Verify `/login.html`.
   - Verify `/install`.
   - Verify `/support`.
   - Verify Discord OAuth callback.
   - Verify `/servers.html`.
   - Verify `/dashboard.html`.
10. Confirm duplicate bot process checks:
    ```sh
    pm2 list
    pm2 logs palworld-dashboard --lines 100
    ```
11. Start bot only after duplicate checks:
    ```sh
    pm2 start npm --name palworld-bot -- start
    ```
12. Smoke bot commands:
    - `/ping`
    - `/profile`
    - `/mypals`
    - `/buy` small quantity if safe.
    - `/capture` once with a test user if safe.
    - `/quests`
13. Verify data and file safety:
    ```sh
    node scripts/printSupabaseSmokeCounts.js
    git status --short data/users.json data/user-pals.json data/pals.json
    ```
14. Save PM2 process list:
    ```sh
    pm2 save
    ```

## PM2 Plan

Process names:

- `palworld-dashboard`
- `palworld-bot`

Useful PM2 commands:

```sh
pm2 list
pm2 describe palworld-dashboard
pm2 describe palworld-bot
pm2 logs palworld-dashboard --lines 200
pm2 logs palworld-bot --lines 200
pm2 restart palworld-dashboard
pm2 restart palworld-bot
pm2 save
```

PM2 safety rules:

- Start the dashboard before the bot.
- Start the bot only after confirming no duplicate bot process exists.
- Never restart `cdawg-bot` or `cdawg-dashboard` as part of this deployment.
- Save PM2 only after the correct process list is confirmed.

## Rollback

Dashboard rollback:

```sh
pm2 stop palworld-dashboard
pm2 delete palworld-dashboard
```

Bot rollback to JSON:

1. Stop the Supabase-backed bot process:
   ```sh
   pm2 stop palworld-bot
   ```
2. Set bot env:
   ```sh
   STORAGE_PROVIDER=json
   ```
3. Restart the bot:
   ```sh
   pm2 restart palworld-bot
   ```
4. Smoke JSON-backed commands:
   - `/profile`
   - `/mypals`
   - `/capture`

Folder rollback:

```sh
pm2 stop palworld-bot
pm2 stop palworld-dashboard
mv /root/palworld-owner-platform /root/palworld-owner-platform.failed-$(date +%Y%m%d-%H%M%S)
mv /root/palworld-bot.backup-YYYYMMDD-HHMMSS /root/palworld-bot
```

Do not manually roll back Supabase rows unless a specific bad write is identified.

## Recommended First Live VPS Command Sequence

Run these commands first during the live VPS session:

```sh
pm2 list
pm2 describe cdawg-bot
pm2 describe cdawg-dashboard
ls -la /root
ls -la /root/palworld-bot
```

Then decide whether an old `palworld-bot` directory/process needs backup or removal. Do not proceed to install, pull, or start anything until the current process list and old directory state are understood.

## Safety Checks

- `cdawg-bot` still running if it was running before.
- `cdawg-dashboard` still running if it was running before.
- Palworld game server untouched.
- Valheim services untouched.
- Only one process uses the Palworld Discord bot token.
- Dashboard public URL routes to `palworld-dashboard`.
- Bot writes go to Supabase only when `STORAGE_PROVIDER=supabase-v2`.
- JSON data files remain unchanged during Supabase runtime smoke tests.
