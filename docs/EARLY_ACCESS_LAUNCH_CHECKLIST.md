# Early Access Launch Checklist

This checklist prepares a public soft launch for PalMaster Discord servers. It
does not add Stripe, change gameplay, or perform deployment by itself.

## Required Configuration

- `DISCORD_BOT_INVITE_URL` is configured for the public `Add to Discord` CTA, or `DISCORD_CLIENT_ID` is set so the install URL can be generated.
- `SUPPORT_SERVER_URL` is configured for the public support CTA.
- Dashboard OAuth environment is set:
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DASHBOARD_BASE_URL`
  - `DASHBOARD_SESSION_SECRET`
- Supabase access is configured only where intended:
  - `SUPABASE_DB_URL`
- `STORAGE_PROVIDER=supabase-v2` for public launch runs.

## Runtime Preflight

- Confirm the target server owner understands this is an early-access soft launch.
- Confirm `STORAGE_PROVIDER` is intentionally selected.
- Confirm JSON remains available as rollback.
- Run Supabase preflight if using Supabase runtime:
  - `node scripts/importJsonToSupabase.js --check-db`
  - `node scripts/validateSupabaseStorageV2ReadOnly.js`
  - `node scripts/validateSupabaseStorageV2WriteDryRun.js` only after explicitly accepting mutation-risk for the dry-run path.
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
- Add to Discord CTA works.
- View Dashboard CTA works.
- Join Support Server CTA works or shows the configured support fallback page.
- Dashboard OAuth login works.
- `/servers.html` lists only authorized installed guilds.
- `/dashboard.html` renders metrics for the selected guild.
- Empty/low-activity onboarding panel appears when appropriate.
- JSON data files remain clean if testing Supabase runtime.

## Known Limitations

- Early access is actively improving and should start with limited public promotion.
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
