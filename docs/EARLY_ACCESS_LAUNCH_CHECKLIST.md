# Early Access Launch Checklist

This checklist prepares a soft launch for pilot/test Discord servers. It does not make Supabase the default runtime provider, add Stripe, or change bot gameplay.

## Required Configuration

- `DISCORD_BOT_INVITE_URL` is configured for the public `Add to Discord` CTA.
- `SUPPORT_SERVER_URL` is configured for the public support CTA.
- Dashboard OAuth environment is set:
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DASHBOARD_BASE_URL`
  - `DASHBOARD_SESSION_SECRET`
- Supabase access is configured only where intended:
  - `SUPABASE_DB_URL`
  - `STORAGE_PROVIDER=supabase-v2` only for deliberate Supabase runtime tests or launch runs.

## Runtime Preflight

- Confirm the target server is a pilot/test server.
- Confirm `STORAGE_PROVIDER` is intentionally selected.
- Confirm JSON remains available as rollback.
- Run Supabase preflight if using Supabase runtime:
  - `node scripts/importJsonToSupabase.js --check-db`
  - `node scripts/validateSupabaseStorageV2ReadOnly.js`
  - `node scripts/validateSupabaseStorageV2WriteDryRun.js`
- Check for duplicate bot processes before launch.
- Confirm no stale PM2/VPS bot process is connected to the same Discord application.

## Dashboard Preflight

- Run `npm run dashboard:check`.
- Confirm `/` renders the public landing page.
- Confirm `/login.html` starts dashboard login.
- Confirm `/install` redirects when `DISCORD_BOT_INVITE_URL` is configured.
- Confirm `/support` redirects when `SUPPORT_SERVER_URL` is configured.
- Confirm protected dashboard routes still require session auth.
- Confirm authorized guild metrics load after Discord OAuth.

## Smoke Tests

- Public landing page renders.
- Add to Discord CTA works or shows the early-access placeholder.
- View Dashboard CTA works.
- Join Support Server CTA works or shows the support placeholder.
- Dashboard OAuth login works.
- `/servers.html` lists only authorized installed guilds.
- `/dashboard.html` renders metrics for the selected guild.
- Empty/low-activity onboarding panel appears when appropriate.
- JSON data files remain clean if testing Supabase runtime.

## Known Limitations

- Early access is best for pilot/test servers.
- Owner controls are not available yet.
- Stripe and billing are not available yet.
- Install flow depends on a configured Discord bot invite URL.
- Support flow depends on a configured support server URL.
- Supabase runtime must be selected intentionally; JSON remains the default rollback provider.
- Long-running stability and connection pooling should continue to be monitored.

## Soft Launch Targets

Track launch targets before inviting broader usage:

- Pilot server owner:
- Discord guild id:
- Invite date:
- Runtime provider:
- Support contact:
- Feedback channel:
- Known follow-up items:
