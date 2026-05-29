# Public Landing and Install Flow Plan

Phase 7A plans the public product entry point for Discord server owners. The goal is to explain the product, make installation clear, and route owners into the protected dashboard without adding billing yet.

## Product Positioning

Position the product as:

> Palworld community engagement platform for Discord server owners.

The landing page should not present the bot as merely another Palworld collection bot. Player-facing capture, Palbox, profile, daily quest, and leaderboard features matter, but the differentiator is owner value:

- Dashboard visibility.
- Community health.
- Engagement analytics.
- Server-specific activity signals.
- Retention opportunities.
- Future configurable events and campaigns.

## Landing Page Purpose

The public landing page should:

- Explain what the product does.
- Differentiate from player-only Palworld RPG/collection bots.
- Sell owner dashboard and community engagement value.
- Show key owner and player-facing features.
- Drive bot installation.
- Drive dashboard login for already-installed servers.
- Route users to support.

## Primary CTAs

- Add to Discord.
- View Dashboard / Login.
- Join Support Server.

CTA behavior:

- `Add to Discord` starts the bot install OAuth flow.
- `View Dashboard / Login` starts the existing dashboard Discord OAuth login flow.
- `Join Support Server` links to the support community once available.

## Install Flow

### Discord Bot Invite URL

The public install CTA should use a Discord OAuth2 bot invite URL built from:

- `DISCORD_CLIENT_ID`
- `scope=bot applications.commands`
- Required bot permissions integer.
- Optional `guild_id` only for internal/dev install links, not public default links.

The generated URL should be server-side or configured from environment so the landing page does not hard-code secrets or brittle app metadata.

### Required Permissions

Initial install documentation should explain the bot needs enough permissions to:

- Register and respond to slash commands.
- Send messages and embeds in configured channels.
- Read interaction/channel context needed for Discord command workflows.
- Use buttons/components for capture and dashboard-adjacent flows.

Keep requested permissions minimal and document why each is needed before public launch.

### Post-Install Guild Detection

After install:

- The bot should eventually upsert the installed guild into `public.discord_guilds`.
- The dashboard should show the server after the owner logs in with Discord and has owner/admin/manage-guild access.
- If Discord redirects back after installation, the app should land on an onboarding route or dashboard login route.

### Dashboard Access After Install

Dashboard login remains separate from bot installation:

- Bot install OAuth grants the application access to the server.
- Dashboard Discord OAuth authenticates the human user.
- Dashboard access is granted only when the signed-in user owns or can manage the installed guild.

### Onboarding Empty States

Newly installed servers may have little or no data. Empty states should explain:

- Run `/start` or first player commands to seed player activity.
- Use `/capture`, `/daily`, and `/quests` to start engagement loops.
- Return to the dashboard after players interact.
- Metrics appear as the bot records Supabase runtime activity.

Do not add owner controls in Phase 7A.

## Landing Sections

### Hero

Purpose: make the offer clear in the first viewport.

Content:

- Product name or literal category.
- Positioning line: Palworld community engagement platform for Discord server owners.
- Short owner-value supporting copy.
- CTAs: Add to Discord, View Dashboard / Login.

### What It Does

Explain the loop:

- Players capture Pals, earn progression, complete quests, and compete.
- Owners watch community health, top collectors, recent activity, and Paldeck progress.
- The product helps turn collection mechanics into recurring Discord engagement.

### Owner Dashboard Preview

Show or describe:

- Community Health score.
- Owner insights.
- Recent activity feed.
- Top collectors.
- Paldeck health.

Use current dashboard screenshots or preview cards once assets are ready.

### Player Engagement Loop

Show player-facing features as support for owner outcomes:

- Capture.
- Daily rewards.
- Quests.
- Palbox.
- Leaderboards.
- Public spawns.

### Community Health / Analytics

Explain owner-facing analytics:

- Total players.
- Captures.
- Recent activity.
- Daily quest activity.
- Collection progress.
- Engagement opportunities.

### Pricing Placeholder

Include a placeholder only:

- Free during early access or private beta.
- Premium owner tools planned later.
- No Stripe implementation in Phase 7A.

### FAQ

Initial questions:

- Is this just another Palworld collection bot?
- Does the dashboard require Discord login?
- Does bot installation automatically grant dashboard access?
- What data does the dashboard show?
- Can I roll back to JSON storage?
- Is billing available?

## Technical Notes

## Phase 7A-1 Architecture Lock

### Public Route Decisions

- `/`: public landing page. It should work without a dashboard session.
- `/auth/discord`: existing dashboard login OAuth route. It should remain user authentication, not bot installation.
- `/servers.html`: protected server selection after dashboard login.
- `/dashboard.html`: protected owner dashboard for a selected authorized guild.

Supporting public route decisions:

- `/login.html`: preserves the current dashboard login screen when `/` becomes the public landing page.
- `/install`: optional public helper route that redirects to the configured Discord bot invite URL.
- `/support`: optional public helper route that redirects to the configured support server URL.

### Install Flow Decision

`Add to Discord` should start Discord bot install OAuth, using either a configured invite URL or an `/install` redirect helper.

Install flow:

1. Visitor clicks `Add to Discord`.
2. Browser opens Discord bot install OAuth with `bot` and `applications.commands` scopes.
3. Server owner chooses a Discord server and authorizes the bot.
4. Discord returns to an onboarding or login route when a redirect is configured.
5. Owner signs in separately through dashboard Discord OAuth to see authorized installed servers.

Bot installation must not create or imply a dashboard browser session.

### Dashboard Login Flow Decision

`View Dashboard` should start or route toward dashboard user OAuth.

Dashboard login flow:

1. Visitor clicks `View Dashboard`.
2. Browser opens `/login.html` or directly starts `/auth/discord`.
3. Dashboard OAuth requests `identify` and `guilds`.
4. The dashboard session is created only after the existing OAuth callback validates Discord identity and authorized installed guilds.
5. User lands on `/servers.html`, then enters `/dashboard.html` for an authorized guild.

Dashboard login must not install the bot into a server.

### Support Flow Decision

`Join Support Server` should route to a configured support URL. If `SUPPORT_SERVER_URL` is missing, the landing page should show a disabled or placeholder support CTA rather than a broken link.

### CTA Mapping

| CTA | Destination | Purpose |
| --- | --- | --- |
| Add to Discord | `/install` or `DISCORD_BOT_INVITE_URL` | Install the bot into a server. |
| View Dashboard | `/login.html` or `/auth/discord` | Authenticate the owner/admin and show authorized servers. |
| Join Support Server | `/support` or `SUPPORT_SERVER_URL` | Route users to community support. |

### Landing Content Structure

The first landing page should use these sections in order:

1. Hero with positioning and primary CTAs.
2. What it does for server owners.
3. Owner dashboard preview.
4. Player engagement loop.
5. Community health and analytics.
6. Early-access pricing placeholder with no Stripe.
7. FAQ.

The page should lead with owner outcomes, then explain player-facing loops as the mechanism that creates those outcomes.

### Public vs Protected Routes

Public routes:

- Landing page.
- Install information.
- FAQ/support page.

Protected routes:

- `/servers.html`
- `/dashboard.html`
- `/api/guilds`
- `/api/guilds/:guildId/*`

Protected routes continue to require the dashboard session from Discord OAuth.

### OAuth Separation

Dashboard OAuth remains user authentication:

- Scopes: `identify`, `guilds`.
- Used to determine which installed guilds the user can manage.

Bot install OAuth remains application installation:

- Scopes: `bot`, `applications.commands`.
- Used to add the bot to a server.

These flows should remain separate so installing the bot does not automatically trust the browser session, and logging into the dashboard does not install the bot.

## Implementation Order

### 7A-1: Landing Content and Route Plan

- Make `/` the public landing page.
- Move the current dashboard login screen to `/login.html` before replacing `/`.
- Keep `/auth/discord` as the dashboard user OAuth entry point.
- Add an install route or configured link for the Discord bot install OAuth flow.
- Keep `/servers.html`, `/dashboard.html`, `/api/guilds`, and `/api/guilds/:guildId/*` protected.
- Draft landing copy and CTA destinations.
- Define required environment variables for install/support URLs.
- Keep dashboard routes protected.

### 7A-1 Route Structure Decision

Public routes:

- `/`: public landing page for server owners.
- `/login.html`: dashboard login page with the Discord login CTA.
- `/auth/discord`: starts dashboard user OAuth with `identify` and `guilds`.
- `/install` or configured `Add to Discord` URL: starts bot install OAuth with `bot` and `applications.commands`.
- `/support` or configured support URL: routes to the support community once available.

Protected routes:

- `/servers.html`: authenticated server selection.
- `/dashboard.html`: authenticated dashboard shell.
- `/api/guilds`: authenticated authorized guild list.
- `/api/guilds/:guildId/*`: authenticated, guild-authorized dashboard data.

The first implementation should preserve the current dashboard login experience by moving it from `/` to `/login.html`, then replace `/` with the public landing page. Bot install OAuth and dashboard login OAuth must stay separate.

### 7A-1 Landing Copy Direction

Hero message:

- Headline: Palworld community engagement platform for Discord server owners.
- Supporting copy: Turn Palworld collection activity into recurring Discord engagement with captures, quests, leaderboards, and an owner dashboard built for community health.

Primary CTAs:

- Add to Discord: bot install OAuth.
- View Dashboard / Login: `/login.html` or `/auth/discord`.
- Join Support Server: configured support link or disabled placeholder until ready.

Feature message hierarchy:

- Owner command center: community health, top collectors, recent activity, and Paldeck progress.
- Player engagement loop: captures, daily rewards, quests, Palbox, leaderboards, and public spawns.
- Analytics and retention: identify active collectors, collection progress, and engagement opportunities.

### 7A-1 Environment Planning

Expected public-page configuration:

```sh
DISCORD_CLIENT_ID=
DISCORD_BOT_INVITE_URL=
DISCORD_BOT_PERMISSIONS=
SUPPORT_SERVER_URL=
```

`DISCORD_BOT_INVITE_URL` can be provided directly for the first implementation. A later install helper can construct it from `DISCORD_CLIENT_ID`, scopes, and `DISCORD_BOT_PERMISSIONS`.

### 7A-2: Static Landing Page

- Add a public landing page that works without authentication.
- Link to `/auth/discord` for dashboard login.
- Link to the configured Discord bot invite URL.
- Include a support link placeholder if the support server URL is not ready.
- Implemented with `/` as the public landing page and `/login.html` as the preserved dashboard login page.
- Implemented `/install` and `/support` helper routes with configured redirects or placeholders.

### 7A-3: Install URL Helper

- Add a safe helper for constructing or reading the bot invite URL.
- Keep permissions documented.
- Avoid hard-coded secrets.
- Implemented `/install` behavior:
  - Redirects to `DISCORD_BOT_INVITE_URL` when configured.
  - Shows a polished placeholder when missing.
  - Includes `View Dashboard` and `Back to Home` links.
  - Includes early onboarding copy for `/start`, `/capture`, `/daily`, `/quests`, and returning to the dashboard.
- Implemented `/support` behavior:
  - Redirects to `SUPPORT_SERVER_URL` when configured.
  - Shows a polished placeholder when missing.
  - Includes a `Back to Home` link.
- Bot install OAuth and dashboard user OAuth remain separate flows.

### 7A-4: Post-Install / Empty-State Copy

- Add onboarding empty-state copy for newly installed servers.
- Keep this read-only and informational.

## Guardrails

- Do not modify bot runtime code during planning.
- Do not modify JSON data files.
- Do not change storage providers.
- Do not add Stripe yet.
- Do not add owner controls yet.
- Keep dashboard auth separate from bot install OAuth.
- Keep public pages separate from protected dashboard routes.
