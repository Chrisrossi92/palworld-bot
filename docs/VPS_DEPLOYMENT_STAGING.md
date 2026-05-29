# VPS Deployment Staging

Phase 7C-2 prepares exact staging commands and environment structure for deploying into `/root/palworld-owner-platform`. Do not run these commands until deployment is explicitly approved.

## Assumptions

- Existing `cdawg-bot` and `cdawg-dashboard` services remain untouched.
- Existing `/root/palworld-bot` remains untouched.
- Supabase V2 is the intended early-access runtime provider.
- The deployment target is a new directory:
  ```sh
  /root/palworld-owner-platform
  ```

## Folder Structure

Expected deployment tree:

```text
/root/palworld-owner-platform/
  dashboard/
  data/
  docs/
  scripts/
  src/
  supabase/
  package.json
  package-lock.json
  .env.bot
  .env.dashboard
  ecosystem.config.cjs
```

Environment files are shown as staging structure. Keep real secrets out of git.

## Environment Files

### `/root/palworld-owner-platform/.env.bot`

```sh
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
REGISTER_COMMANDS_SCOPE=global
DISCORD_GUILD_ID=
SPAWN_CHANNEL_ID=
STORAGE_PROVIDER=supabase-v2
SUPABASE_DB_URL=
```

Use `REGISTER_COMMANDS_SCOPE=guild` and `DISCORD_GUILD_ID` only for a deliberately scoped pilot server.

### `/root/palworld-owner-platform/.env.dashboard`

```sh
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DASHBOARD_PORT=3000
DASHBOARD_BASE_URL=
DASHBOARD_SESSION_SECRET=
SUPABASE_DB_URL=
DISCORD_BOT_INVITE_URL=
SUPPORT_SERVER_URL=
```

## PM2 Process Definitions

Use these process names:

- `palworld-dashboard`
- `palworld-bot`

Optional `ecosystem.config.cjs` structure:

```js
module.exports = {
  apps: [
    {
      name: "palworld-dashboard",
      cwd: "/root/palworld-owner-platform",
      script: "npm",
      args: "run dashboard:start",
      env_file: "/root/palworld-owner-platform/.env.dashboard",
    },
    {
      name: "palworld-bot",
      cwd: "/root/palworld-owner-platform",
      script: "npm",
      args: "start",
      env_file: "/root/palworld-owner-platform/.env.bot",
    },
  ],
};
```

If PM2 `env_file` support is unavailable in the installed PM2 version, use a managed shell wrapper or PM2 environment configuration instead. Do not fall back to ad hoc temporary exports for launch-critical secrets.

## Clone or Copy Instructions

Inspect first:

```sh
pm2 list
pm2 describe cdawg-bot
pm2 describe cdawg-dashboard
ls -la /root
ls -la /root/palworld-bot
```

Create the new deployment directory without touching `/root/palworld-bot`:

```sh
mkdir -p /root/palworld-owner-platform
cd /root/palworld-owner-platform
```

Clone option:

```sh
git clone <repo-url> /root/palworld-owner-platform
cd /root/palworld-owner-platform
```

Copy option:

```sh
rsync -av --exclude node_modules --exclude .git <local-repo>/ /root/palworld-owner-platform/
cd /root/palworld-owner-platform
```

## Install Dependencies

```sh
npm install
```

## Validation Commands

Run from `/root/palworld-owner-platform`:

```sh
npm run dashboard:check
node --check src/index.js
node --check src/register-commands.js
node --check src/systems/captureSystem.js
node --check src/storage/supabaseStorageV2.js
node scripts/importJsonToSupabase.js --check-db
node scripts/validateSupabaseStorageV2ReadOnly.js
node scripts/validateSupabaseStorageV2WriteDryRun.js
```

## Startup Commands

Start dashboard first:

```sh
pm2 start ecosystem.config.cjs --only palworld-dashboard
```

Alternative without ecosystem file:

```sh
pm2 start npm --name palworld-dashboard -- run dashboard:start
```

Smoke dashboard before starting the bot.

Start bot only after duplicate checks:

```sh
pm2 start ecosystem.config.cjs --only palworld-bot
```

Alternative without ecosystem file:

```sh
pm2 start npm --name palworld-bot -- start
```

Save PM2 only after the process list is correct:

```sh
pm2 save
```

## Duplicate Bot Checks

Before starting `palworld-bot`:

```sh
pm2 list
pm2 describe palworld-bot
pm2 logs palworld-dashboard --lines 100
```

Also confirm no local shell, old PM2 process, Docker container, or service is using the same `DISCORD_TOKEN`.

Stop criteria:

- More than one process can connect with the Palworld bot token.
- Existing `cdawg-*` process would be affected.
- Interaction acknowledgement errors appear during smoke.

## Smoke Test Sequence

Dashboard:

1. Open public `/`.
2. Open `/login.html`.
3. Verify `/install` redirects or shows early-access placeholder.
4. Verify `/support` redirects or shows support placeholder.
5. Complete Discord OAuth.
6. Verify `/servers.html`.
7. Verify `/dashboard.html`.

Bot:

1. `/ping`
2. `/profile`
3. `/mypals`
4. `/quests`
5. `/buy` small quantity if safe.
6. `/capture` once with a test user if safe.

Data/file check:

```sh
node scripts/printSupabaseSmokeCounts.js
git status --short data/users.json data/user-pals.json data/pals.json
```

## Log Commands

```sh
pm2 logs palworld-dashboard --lines 200
pm2 logs palworld-bot --lines 200
pm2 describe palworld-dashboard
pm2 describe palworld-bot
```

Watch for:

- Dashboard OAuth callback failures.
- Supabase connection errors.
- Discord interaction acknowledgement errors.
- Unknown interaction errors.
- Unhandled Promise rejections.
- Slow command responses.

## Rollback Steps

Stop staged processes:

```sh
pm2 stop palworld-bot
pm2 stop palworld-dashboard
```

Delete staged processes if needed:

```sh
pm2 delete palworld-bot
pm2 delete palworld-dashboard
```

Rollback bot to JSON if keeping the bot online:

```sh
# update .env.bot first
STORAGE_PROVIDER=json
pm2 restart palworld-bot
```

Rollback folder:

```sh
mv /root/palworld-owner-platform /root/palworld-owner-platform.failed-$(date +%Y%m%d-%H%M%S)
```

Do not restore over `/root/palworld-bot` unless explicitly deciding to return to that old deployment.

## Do Not Touch During Staging

- `cdawg-bot`
- `cdawg-dashboard`
- `/root/palworld-bot`
- Palworld game server services.
- Valheim services.
- Any unrelated PM2 process.
