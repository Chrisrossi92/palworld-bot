# Public Debut Deployment Readiness

This document is the production-readiness checklist for PalMaster public soft
launch. It is documentation only; do not deploy from it until deployment is
explicitly approved.

## Production Environment

### Bot runtime

Required:

- `DISCORD_TOKEN` - Discord bot token. Secret. Dangerous if leaked.
- `DISCORD_CLIENT_ID` - Discord application client ID.
- `REGISTER_COMMANDS_SCOPE=global` - Public soft launch command mode.
- `STORAGE_PROVIDER=supabase-v2` - Required for public launch.
- `SUPABASE_DB_URL` - Supabase/Postgres connection string. Secret. Dangerous if leaked.

Optional:

- `DISCORD_GUILD_ID` - Required only when `REGISTER_COMMANDS_SCOPE=guild`.
- `SPAWN_CHANNEL_ID` - Legacy single-channel spawn fallback. Prefer dashboard Public Spawns.
- `PALMASTER_IMAGE_DEBUG=1` or `CARD_IMAGE_DEBUG=1` - Local/debug logging only.

Dangerous/local-only:

- `STORAGE_PROVIDER=json` - Allowed for local development and rollback only. Public launch must not use JSON unless `PALMASTER_ALLOW_JSON_LAUNCH=1` is deliberately set for an emergency.
- `PALMASTER_ALLOW_JSON_LAUNCH=1` - Emergency/local override only.
- `PALMASTER_LAUNCH_CHECK_LOCAL=1` - Local launch-check mode only.

### Dashboard and OAuth

Required:

- `DISCORD_CLIENT_ID` - Discord OAuth client ID.
- `DISCORD_CLIENT_SECRET` - Discord OAuth client secret. Secret. Dangerous if leaked.
- `DASHBOARD_BASE_URL=https://palmaster.online` - Must match Discord Developer Portal redirect configuration.
- `DASHBOARD_SESSION_SECRET` - Long random session signing secret. Secret. Dangerous if leaked.
- `SUPABASE_DB_URL` - Used for server selection and dashboard metrics.
- `SUPPORT_SERVER_URL` - Public support/community route target.

Recommended:

- `DASHBOARD_PORT=3000` - Internal HTTP port behind Caddy.
- `DISCORD_BOT_INVITE_URL` - Explicit install URL. If omitted, PalMaster builds one from `DISCORD_CLIENT_ID`.
- `DISCORD_BOT_PERMISSIONS=379904` - Current install permission integer.

Discord Developer Portal must include:

- OAuth redirect URL: `${DASHBOARD_BASE_URL}/auth/discord/callback`
- Bot install scopes: `bot applications.commands`
- Bot invite permissions matching `DISCORD_BOT_PERMISSIONS`

## Supabase Preflight

Run from the deployment directory with production environment loaded:

```sh
STORAGE_PROVIDER=supabase-v2 REGISTER_COMMANDS_SCOPE=global npm run launch:check
node scripts/importJsonToSupabase.js --check-db
node scripts/validateSupabaseStorageV2ReadOnly.js
```

The write dry-run script touches the database inside a dry-run path and should
only be run when mutation-risk has been explicitly accepted:

```sh
node scripts/validateSupabaseStorageV2WriteDryRun.js
```

Required runtime tables:

- `discord_users`
- `discord_guilds`
- `guild_memberships`
- `guild_settings`
- `pal_catalog`
- `guild_players`
- `player_sphere_inventory`
- `player_owned_pals`
- `capture_history`
- `daily_reward_claims`
- `player_daily_quests`
- `player_journal_entries`
- `player_daily_research`
- `guild_weekly_goals`
- `guild_spawn_settings`

RLS note: this app currently connects server-side with a Postgres connection
string. RLS may be disabled on server-owned tables when access is restricted by
database credentials and dashboard authorization checks. Revisit RLS before
client-side Supabase access or broader admin roles.

## PM2

Committed example:

```sh
ecosystem.config.example.cjs
```

Production process names:

- `palworld-dashboard`
- `palworld-bot`

Start dashboard first:

```sh
pm2 start ecosystem.config.cjs --only palworld-dashboard
pm2 logs palworld-dashboard --lines 100
```

Start bot only after duplicate-token checks:

```sh
pm2 list
pm2 start ecosystem.config.cjs --only palworld-bot
pm2 logs palworld-bot --lines 100
pm2 save
```

Recovery commands:

```sh
pm2 restart palworld-dashboard
pm2 restart palworld-bot
pm2 describe palworld-dashboard
pm2 describe palworld-bot
pm2 logs palworld-dashboard --lines 200
pm2 logs palworld-bot --lines 200
```

Rollback:

```sh
pm2 stop palworld-bot
pm2 stop palworld-dashboard
```

Bot storage rollback requires changing the bot environment to
`STORAGE_PROVIDER=json`, then restarting `palworld-bot`. Do not delete Supabase
rows unless a specific bad write is identified.

## Caddy

Committed example:

```sh
Caddyfile.example
```

Assumptions:

- Public host: `palmaster.online`
- Dashboard process listens on `127.0.0.1:3000`
- Caddy owns HTTPS termination and proxies to the dashboard process.

After Caddy changes:

```sh
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
journalctl -u caddy -n 100 --no-pager
```

## Fresh-Server Smoke Test

Use a brand-new Discord server where you can install apps and manage the server.

1. Open `https://palmaster.online/install`.
2. Install PalMaster into the fresh server.
3. Confirm the bot joins the server.
4. Open `https://palmaster.online/login.html` and log in with Discord.
5. Confirm `/servers.html` lists the fresh server.
6. Open that server dashboard.
7. Confirm the owner setup checklist makes sense for an empty server.
8. Run `/ping`.
9. Run `/help`.
10. Run `/start`.
11. Run `/capture`.
12. Run `/daily`.
13. Run `/quests`.
14. Run `/profile`.
15. Run `/mypals`.
16. Run `/leaderboard`.
17. Configure Public Spawns with a known Discord channel ID.
18. Save settings and confirm the dashboard reports success.
19. Inspect logs:
    ```sh
    pm2 logs palworld-bot --lines 200
    pm2 logs palworld-dashboard --lines 200
    ```
20. Confirm no Discord interaction acknowledgement errors, Supabase errors, or dashboard OAuth errors.

## Launch Assessment Gates

Private beta may proceed when:

- Tests and syntax checks pass.
- `launch:check` passes in `supabase-v2` mode.
- Dashboard OAuth works on the production URL.
- A fresh-server smoke test passes.

Limited public soft launch may proceed when:

- Private beta criteria pass.
- PM2 duplicate-token checks are clean.
- Caddy HTTPS routing works.
- Support URL is configured.
- Logs are clean after at least one fresh-server install.

Broad public launch should wait for:

- Longer-running uptime observation.
- Real legal/privacy review.
- Monitoring/alerting beyond manual PM2 log inspection.
- Clear support workflow and incident rollback ownership.
