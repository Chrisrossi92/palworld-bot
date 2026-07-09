# PalMaster Limited Soft Launch Ops

Last updated: 2026-07-09

## Current Deployed Commit

- Production path: `/root/palworld-owner-platform`
- Current deployed commit after this ops slice: confirm with `git rev-parse --short HEAD` in `/root/palworld-owner-platform`.
- Previous known-good rollback commit: `a142545 Finalize PalMaster launch cleanup`
- Deploy model: committed local code is copied/pulled into the production path, then PM2 is restarted dashboard first, bot second.

After applying this ops slice, confirm the VPS commit with:

```sh
cd /root/palworld-owner-platform
git rev-parse --short HEAD
git status --short
```

## Production Env Assumptions

Bot:

- `STORAGE_PROVIDER=supabase-v2`
- `REGISTER_COMMANDS_SCOPE=global`
- `DISCORD_TOKEN` is present
- `DISCORD_CLIENT_ID` matches the PalMaster Discord application
- `SUPABASE_DB_URL` is present
- JSON fallback remains available for local/dev use, but production should not launch in JSON mode without an explicit allow flag.

Dashboard:

- `DASHBOARD_BASE_URL=https://palmaster.online`
- Discord OAuth callback is expected at `https://palmaster.online/auth/discord/callback`
- Dashboard listens locally on port `3000`
- Caddy terminates HTTPS and reverse-proxies `palmaster.online` to the dashboard process.

## PM2 Process Names

Production PalMaster processes:

- `palworld-dashboard`
- `palworld-bot`

Known stale/legacy processes observed during final cleanup:

- `cdawg-dashboard`
- `cdawg-bot`

Do not stop legacy processes during launch prep unless their ownership and public traffic impact are confirmed.

## Smoke-Test Results

Final cleanup smoke test passed:

- `https://palmaster.online` returned HTTP 200 and loaded the PalMaster landing page.
- `https://palmaster.online/health` returned:

```json
{"ok":true,"service":"palmaster-dashboard"}
```

- PM2 showed `palworld-dashboard` and `palworld-bot` online.
- Discord Developer Portal application name: `PalMaster`.
- Discord bot username: `PalMaster`.
- Bot startup log confirmed `PalMaster online as PalMaster#4847`.
- Live Discord commands verified in the smoke-test server:
  - `/ping`
  - `/help`
  - `/start`

## First-Wave Monitoring Checklist

During the first wave, check these before inviting users, after the first install, and then every 30-60 minutes:

- PM2 status:

```sh
pm2 status palworld-dashboard palworld-bot
```

- PM2 logs:

```sh
pm2 logs palworld-dashboard --lines 100
pm2 logs palworld-bot --lines 150
```

- Dashboard health:

```sh
curl -fsS https://palmaster.online/health
```

- Supabase table counts:

```sh
node scripts/importJsonToSupabase.js --check-db
```

- Discord command errors:
  - Watch bot logs for `interaction failed`, `Unknown interaction`, Supabase errors, and Discord REST errors.
  - Confirm command registration scope stays `global`.

- Dashboard login/install issues:
  - Test `/login.html`, `/install`, and one owner dashboard load.
  - Watch dashboard logs for OAuth callback errors, missing guilds, and session errors.

## Rollback Steps

Use rollback only for production-blocking issues such as bot login failure, dashboard outage, command dispatch failures, or Supabase write failures.

1. Confirm the current commit:

```sh
cd /root/palworld-owner-platform
git rev-parse --short HEAD
```

2. Roll back to the previous known-good commit:

```sh
cd /root/palworld-owner-platform
git reset --hard a142545
```

3. Restart dashboard first:

```sh
pm2 restart palworld-dashboard --update-env
```

4. Confirm the site and health route:

```sh
curl -fsS https://palmaster.online
curl -fsS https://palmaster.online/health
```

5. Restart bot second:

```sh
pm2 restart palworld-bot --update-env
```

6. Check logs:

```sh
pm2 logs palworld-dashboard --lines 100
pm2 logs palworld-bot --lines 150
```

## Limited Soft-Launch Announcement Draft

PalMaster is open for a limited soft launch.

PalMaster is an independent, fan-made Discord bot for Palworld communities. It gives your server lightweight collection and activity loops: players can start with `/start`, catch Pals with `/capture`, claim `/daily` rewards, check `/quests`, view progress with `/profile` or `/mypals`, and compare rankings with `/leaderboard`.

This is an early-access soft launch, so we are inviting a small first wave of server owners while we monitor stability, onboarding, dashboard login, and command reliability. If you install PalMaster, please report any confusing copy, failed commands, missing dashboard data, or setup friction.

Install: https://palmaster.online/install

PalMaster is independent and not affiliated with Pocketpair.
