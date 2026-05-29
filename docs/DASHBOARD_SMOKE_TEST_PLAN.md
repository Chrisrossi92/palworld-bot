# Dashboard Smoke Test Plan

This checklist validates the Phase 6A owner dashboard foundation locally. It does not change bot runtime behavior or storage providers.

## Local Run

Run the dashboard only when intentionally smoke testing:

```sh
npm run dashboard
```

The dashboard listens on:

```text
http://localhost:3000
```

Set `DASHBOARD_PORT` to use another port.

## Non-Live Validation

Run syntax/build-style validation without starting a server:

```sh
npm run dashboard:check
```

## Manual Route Checklist

1. `/` loads the login screen.
2. `/servers.html` loads the server selection screen.
3. `/dashboard.html` loads the metrics shell.
4. `/auth/discord` redirects to `/servers.html` as the current OAuth placeholder.

## Metrics Checklist

With `SUPABASE_DB_URL` present:

- `/api/guilds` returns real Supabase guild rows.
- `/api/guilds/:guildId/metrics` returns real counts for:
  - Total Players.
  - Total Captures.
  - Total Owned Pals.
  - Daily Quest Activity.

Without `SUPABASE_DB_URL`:

- `/api/guilds` returns an empty guild list with `hasSupabaseConnection: false`.
- `/dashboard.html` renders the shell and empty metric values.
- No dashboard route should modify JSON data or bot runtime state.

## Pass Criteria

- Login, server selection, and dashboard shell render locally.
- Supabase-backed metrics return values when `SUPABASE_DB_URL` is configured.
- Empty/fallback states render when database env is missing.
- Bot runtime code and storage provider defaults are unchanged.
- JSON data files remain unchanged.

## Smoke Result

- Manual dashboard server was run with `npm run dashboard`.
- `/dashboard.html` loaded successfully.
- Dashboard displayed live Supabase metrics for guild `1323324192627888339`:
  - Total Players: 1
  - Total Captures: 12
  - Total Owned Pals: 10
  - Daily Quest Activity: 1
- Phase 6A dashboard foundation is accepted.
