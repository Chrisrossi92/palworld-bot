# Early Access Deployment Runbook

This runbook prepares controlled early-access hosting for the bot and owner dashboard. It does not change bot gameplay, JSON data, Stripe, or storage defaults.

For VPS-specific deployment sequencing, PM2 isolation from existing services, and the first live VPS inspection commands, see `docs/VPS_DEPLOYMENT_PLAN.md`.

## Runtime Deployment Modes

Early access uses four runtime pieces:

- Bot process: Discord bot worker that handles slash commands and gameplay interactions.
- Dashboard process: HTTP server for public landing, Discord OAuth login, protected dashboard, and metrics APIs.
- Supabase database: hosted Postgres database for Supabase Storage V2 and dashboard metrics.
- Public URL: dashboard/landing URL exposed to server owners for install, login, support, and metrics.

Recommended process names:

- `palworld-bot`
- `palworld-dashboard`

## Required Environment Variables

Shared:

```sh
DISCORD_CLIENT_ID=
SUPABASE_DB_URL=
```

Bot process:

```sh
DISCORD_TOKEN=
REGISTER_COMMANDS_SCOPE=guild
DISCORD_GUILD_ID=
SPAWN_CHANNEL_ID=
STORAGE_PROVIDER=supabase-v2
```

Dashboard process:

```sh
DASHBOARD_PORT=3000
DASHBOARD_BASE_URL=https://your-dashboard-host.example
DASHBOARD_SESSION_SECRET=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_INVITE_URL=
SUPPORT_SERVER_URL=
```

Keep `STORAGE_PROVIDER=supabase-v2` intentional. JSON remains the rollback provider.

## Preflight

1. Confirm the target Discord server is an early-access pilot/test server.
2. Confirm the public dashboard URL is reachable.
3. Confirm Discord Developer Portal redirect URL includes:
   - `${DASHBOARD_BASE_URL}/auth/discord/callback`
4. Confirm Supabase V2 validation passes:
   ```sh
   node scripts/importJsonToSupabase.js --check-db
   node scripts/validateSupabaseStorageV2ReadOnly.js
   node scripts/validateSupabaseStorageV2WriteDryRun.js
   ```
5. Confirm dashboard syntax validation passes:
   ```sh
   npm run dashboard:check
   ```
6. Confirm bot syntax validation passes:
   ```sh
   node --check src/index.js
   node --check src/systems/captureSystem.js
   ```

## Starting the Bot

Start the Discord bot with Supabase V2 only after preflight passes:

```sh
STORAGE_PROVIDER=supabase-v2 npm start
```

PM2 example:

```sh
pm2 start npm --name palworld-bot -- start
```

Set `STORAGE_PROVIDER=supabase-v2` in the managed process environment before starting. Do not rely on shell history for launch-critical env.

## Starting the Dashboard

Start the dashboard HTTP server:

```sh
npm run dashboard:start
```

The existing alias remains valid:

```sh
npm run dashboard
```

PM2 example:

```sh
pm2 start npm --name palworld-dashboard -- run dashboard:start
```

Expose the dashboard process behind the chosen public URL and ensure `DASHBOARD_BASE_URL` matches that URL.

## Duplicate Bot Process Checks

Before launch, confirm only one bot process is connected to the Discord application:

```sh
pm2 list
pm2 logs palworld-bot --lines 100
```

Also check any VPS, local terminal, Docker container, or old PM2 process that may still be running the same `DISCORD_TOKEN`.

Stop criteria:

- Interaction acknowledgement errors appear immediately.
- Commands visually respond but logs show duplicate processing.
- More than one process is using the same Discord token.

## Checking Logs

Bot logs:

```sh
pm2 logs palworld-bot --lines 200
```

Dashboard logs:

```sh
pm2 logs palworld-dashboard --lines 200
```

Watch for:

- Discord interaction acknowledgement errors.
- Unknown interaction errors.
- Unhandled Promise rejections.
- Supabase connection or transaction errors.
- Dashboard OAuth callback failures.
- Slow command responses.

## Basic Smoke Test After Deploy

Public/dashboard:

1. Open `/`.
2. Verify `Add to Discord` routes to the configured bot invite.
3. Verify `View Dashboard` starts Discord login.
4. Verify `/servers.html` lists authorized installed guilds.
5. Verify `/dashboard.html` renders metrics for the selected guild.

Bot:

1. `/ping`
2. `/profile`
3. `/mypals`
4. `/buy` with a small quantity if safe.
5. `/capture` once with a test user if safe.
6. `/quests`

Data checks:

```sh
node scripts/printSupabaseSmokeCounts.js
git status --short data/users.json data/user-pals.json data/pals.json
```

Expected:

- Supabase rows change for write commands.
- JSON data files remain unchanged when using Supabase V2 runtime.

## Rollback to JSON

1. Stop the bot process.
2. Set:
   ```sh
   STORAGE_PROVIDER=json
   ```
3. Restart the bot:
   ```sh
   npm start
   ```
4. Verify `/profile`, `/mypals`, and `/capture` against JSON.
5. Do not manually roll back Supabase rows unless a specific bad write is identified.

Dashboard rollback is independent from bot storage rollback. If dashboard hosting fails, stop `palworld-dashboard`; the bot can continue running.

## PM2 Recommendations

- Use explicit process names:
  - `palworld-bot`
  - `palworld-dashboard`
- Store env in PM2 ecosystem config or deployment environment, not ad hoc shell commands.
- Restart one process at a time.
- After restart, inspect logs before inviting testers.
- Keep a written record of runtime provider, commit, and launch time for each early-access run.

## Known Limitations

- Early access is intended for controlled pilot/test servers.
- JSON remains the default rollback provider.
- Supabase V2 runtime is opt-in through environment.
- Stripe and billing are not available.
- Owner controls are not available.
- Longer runtime stability, latency, and connection pooling should continue to be monitored.
