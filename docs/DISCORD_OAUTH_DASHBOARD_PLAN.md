# Discord OAuth Dashboard Architecture

This plan defines Phase 6B: real Discord OAuth for the owner dashboard. Phase 6B-1 implements the session foundation and replaces the placeholder login route.

## Goal

Allow Discord server owners and admins to sign in, select guilds they manage, and view owner-focused engagement metrics.

## Required Environment

```sh
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DASHBOARD_BASE_URL=
DASHBOARD_SESSION_SECRET=
SUPABASE_DB_URL=
```

## Discord Developer Portal Configuration

Configure the Discord application before implementation:

1. Open the Discord Developer Portal.
2. Select the Palworld bot application.
3. In OAuth2 settings, add redirect URLs:
   - Local: `http://localhost:3000/auth/discord/callback`
   - Production: `${DASHBOARD_BASE_URL}/auth/discord/callback`
4. Confirm the application has OAuth2 enabled.
5. Keep `DISCORD_CLIENT_SECRET` server-side only.
6. Use scopes:
   - `identify`
   - `guilds`

Do not request bot permissions through dashboard login. Bot installation and dashboard user login should remain separate flows.

## OAuth Flow

1. User opens the dashboard login screen.
2. Dashboard redirects to Discord OAuth with scopes:
   - `identify`
   - `guilds`
3. Discord redirects back to `/auth/discord/callback`.
4. Dashboard exchanges the code for a Discord access token.
5. Dashboard fetches the user profile and guild list.
6. Dashboard filters guilds where the user has owner/admin/manage-guild permissions.
7. Dashboard matches those guilds against `public.discord_guilds`.
8. Dashboard stores a signed session.
9. User selects a guild and views Supabase-backed metrics.

Phase 6B-1 status: implemented in the dashboard server.

Phase 6B OAuth smoke validation status: passed.

Phase 6B OAuth logout/access-control smoke validation status: passed.

## Supabase Auth and Session Strategy

Use application-managed sessions for the first implementation. Do not use Supabase Auth for Discord login yet.

Session strategy:

- Store a signed, HTTP-only cookie.
- Cookie payload should include:
  - Discord user id.
  - Username/global name.
  - Avatar hash or URL.
  - Authorized guild ids.
  - Issued-at and expiry timestamps.
- Keep Discord access tokens server-side only if they are retained at all.
- Prefer short-lived sessions with a clear logout path.
- Use `DASHBOARD_SESSION_SECRET` to sign and verify cookies.

Supabase persistence strategy:

- Upsert the logged-in Discord user into `public.discord_users`.
- Do not write dashboard permissions broadly during Phase 6B.
- Continue using service-role/direct database access only on the server.

Future option:

- Supabase Auth can be revisited later if it improves hosted dashboard operations, but it is not required for the first OAuth implementation.

## Access Rules

- Users can view only guilds they own or manage.
- Dashboard access should later honor `dashboard_access_grants`.
- Bot/backend service-role access remains separate from user sessions.

## Route Protection Strategy

Protected routes:

- `/servers.html`
- `/dashboard.html`
- `/api/guilds`
- `/api/guilds/:guildId/metrics`

Protection behavior:

- If no valid session exists, redirect HTML routes to `/`.
- If no valid session exists, return `401` for API routes.
- If a valid session exists but the guild is not authorized, return `403`.
- Server selection should list only guilds that:
  - The signed-in user owns or can manage in Discord.
  - Exist in `public.discord_guilds`.

The dashboard should never trust a client-supplied guild id without checking it against the signed session.

Implemented behavior:

- `/servers.html` and `/dashboard.html` redirect to `/` when no valid signed session exists.
- `/api/guilds` returns `401` when no valid signed session exists.
- `/api/guilds/:guildId/metrics` returns `401` without a session and `403` when the signed session does not authorize the requested guild.
- `/api/guilds` returns only installed guilds that match the signed-in user's Discord owner/admin/manage-guild list.

## Server Ownership and Access Model

Initial access model:

- Allow if Discord marks the user as guild owner.
- Allow if the user has Administrator permission.
- Allow if the user has Manage Guild permission.
- Match guilds by Discord guild id against installed guild rows in Supabase.

Implementation detail:

- Discord guild permission bitfield from `/users/@me/guilds` should be evaluated server-side.
- The dashboard should avoid showing servers where the bot is not installed.
- The dashboard should not expose cross-guild metrics.

## Future Permission Model

Later phases should add:

- `dashboard_access_grants` enforcement.
- Owner/admin/viewer roles.
- Invite-based dashboard access for non-Discord-admin staff.
- Audit log for dashboard configuration changes.
- Per-feature permissions for campaigns, spawn settings, analytics, and billing.
- Billing owner distinction separate from Discord server owner.

Do not implement advanced permissions, billing, or admin controls in Phase 6B.

## Implementation Steps

1. Add signed session cookie support. Completed in Phase 6B-1.
2. Implement `/auth/discord` redirect. Completed in Phase 6B-1.
3. Implement `/auth/discord/callback` token exchange. Completed in Phase 6B-1.
4. Add Discord API client for `identify` and `guilds`. Completed in Phase 6B-1.
5. Add guild permission filtering. Completed in Phase 6B-1.
6. Persist or resolve `discord_users` for dashboard users. Completed in Phase 6B-1.
7. Connect guild selection to authorized guilds only. Completed in Phase 6B-1.
8. Add logout. Completed in Phase 6B-1.
9. Add CSRF/state validation. Completed in Phase 6B-1.
10. Add production cookie security settings. Completed in Phase 6B-1.

## Acceptance Criteria

- Login with Discord works. Smoke validation passed.
- Dashboard stores Discord user identity in a signed session. Smoke validation passed.
- Dashboard retrieves the Discord guild membership list. Smoke validation passed.
- Server selection shows only authorized installed guilds. Smoke validation passed.
- Metrics API rejects unauthorized guild access. Route protection smoke validation passed.
- Logout clears the session. Smoke validation passed.
- Existing bot runtime, JSON files, and storage provider defaults are unchanged.

## Smoke Validation

- `DISCORD_CLIENT_SECRET` was added locally.
- `DASHBOARD_SESSION_SECRET` was added locally.
- Discord OAuth login completed successfully.
- Callback redirected into the protected dashboard flow.
- Session-protected dashboard loaded.
- Authorized guild metrics displayed:
  - Total Players: 1
  - Total Captures: 12
  - Total Owned Pals: 10
  - Daily Quest Activity: 1
- Sign out link appeared.
- Sign out cleared the dashboard session.
- Logout returned the user to `/`.
- Direct access to `/dashboard.html?guildId=1323324192627888339` after logout redirected back to login.
- Protected route behavior passed.
- Current phase: Phase 6C Owner Dashboard Value Layer Planning.

## Current Scaffold

- `/` renders a login screen.
- `/auth/discord` redirects to Discord OAuth with `identify` and `guilds` scopes.
- `/auth/discord/callback` validates OAuth state, creates a signed session, and redirects to server selection.
- `/servers.html` loads only authorized installed guilds.
- `/dashboard.html` renders initial owner metrics.
- `/logout` clears the signed session and redirects to `/`.

Remaining work should focus on OAuth smoke validation, deployment configuration, and later permission roles. Advanced permissions, billing, and admin controls are intentionally not part of Phase 6B-1.
