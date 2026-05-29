# Implementation Progress

This tracker records completed SaaS-readiness work and the planned sequence for upcoming phases.

## Completed

- Guild-aware JSON storage.
- Global command registration with optional dev guild mode.
- Storage abstraction with JSON as the only runtime backend.
- Data safety verification for existing users and caught Pals.
- README, `.env.example`, and roadmap docs.
- Supabase schema plan.
- Supabase SQL migration foundation.
- Supabase initial SQL migration applied to the linked `palworld-bot` project.
- JSON-to-Supabase import planning/script scaffold.
- Initial JSON-to-Supabase import run manually by Chris.
- Phase 3A Supabase storage adapter scaffold.
- Phase 3B Supabase adapter read-only validation against imported data.
- Phase 4A Supabase storage V2 read-only adapter scaffold using `pg`.
- Phase 4A Supabase storage V2 read-only validation.
- Phase 4B Supabase storage V2 write-method implementation.
- Phase 4B Supabase storage V2 write validation.
- Phase A captureSystem async compatibility refactor.
- Phase B command async compatibility refactor.
- JSON-provider smoke validation.
- Supabase-v2 provider selection.
- Supabase-v2 dev runtime smoke test.
- Supabase-v2 broader command smoke test.
- Competitor positioning and owner/operator differentiation doctrine.
- Phase 6A Owner Platform Foundation scaffold.
- Phase 6A dashboard smoke validation.
- Phase 6B Discord OAuth architecture planning.
- Phase 6B-1 Discord OAuth session foundation.
- Phase 6B OAuth smoke validation.
- Phase 6B OAuth logout/access-control smoke validation.
- Phase 6C Owner Dashboard Value Layer planning.
- Phase 6C-1 Metric Service Expansion.
- Phase 6C-2 Dashboard Layout Upgrade.
- Phase 6C-3 Dashboard Polish and Owner Insights.
- Phase 6C-4 Dashboard Refinement and Server Identity Polish.
- Phase 6C-5 Activity Feed Enrichment.
- Phase 6C-6 Dashboard Mobile and Responsive Polish.
- Phase 7A Public Landing and Install Flow planning.
- Phase 7A-1 Landing Content and Route Plan.
- Phase 7A-2 Static Public Landing Page.
- Phase 7A-3 Install URL and Onboarding Polish.
- Phase 7B-1 Onboarding and Empty States.
- Phase 7B-2 Early Access Launch Polish.
- Phase 7B-3 Early Access Deployment Prep.

## Current Phase

- Paldeck/profile improvements.

## Next Planned Phases

1. Paldeck/profile improvements.
2. Supabase runtime cutover implementation.
3. Stripe billing.

## Notes

- Runtime storage is still JSON.
- The `pg` package is installed for Supabase Storage V2.
- Supabase storage adapter exists but is not the default runtime backend.
- The initial SQL migration has been applied manually to the linked Supabase project.
- JSON-to-Supabase live import support is guarded by `--execute --confirm-import`.
- Dashboard scaffold exists; billing does not exist yet.
- Command behavior should remain stable while infrastructure changes are introduced.
- `STORAGE_PROVIDER=json` remains the default.
- `STORAGE_PROVIDER=supabase` currently uses `psql` through synchronous `spawnSync`; validate latency, process availability, and hosting compatibility before runtime cutover.
- `STORAGE_PROVIDER=supabase-v2` is available as an explicit opt-in and requires `SUPABASE_DB_URL`.
- `supabaseStorageV2` uses the `pg` client and has passed read/write validation with synthetic test records.
- Runtime cutover remains an explicit operational decision; JSON remains available as the rollback provider.
- `captureSystem` storage-dependent public methods and command call sites are async-compatible.
- JSON-provider smoke validation passed after the `/profile` acknowledgement fix.
- Supabase-v2 runtime smoke test fully passed after the duplicate PM2-managed VPS bot process was removed.
- Supabase-v2 was not responsible for the earlier interaction acknowledgement errors.
- Shared interaction error fallback now skips unknown/expired and already-acknowledged interactions instead of attempting another response.
- Supabase-v2 is production-capable for continued testing; keep JSON available as rollback.
- PalVerse validates market demand, but product differentiation is owner/operator value rather than competitor feature parity.
- Positioning is: Palworld community engagement platform for Discord server owners.
- Player-facing features remain important, but should support retention, engagement, and owner-facing community outcomes.
- Phase 6A dashboard scaffold is isolated from bot runtime and storage provider selection.
- Initial dashboard metrics read from Supabase when `SUPABASE_DB_URL` is available.
- Phase 6A dashboard foundation is accepted after local smoke validation.
- Dashboard smoke test displayed live Supabase metrics for guild `1323324192627888339`: 1 player, 12 captures, 10 owned Pals, and 1 daily quest activity row.
- Phase 6B OAuth plan defines Discord Developer Portal setup, session strategy, route protection, server access model, and future permissions.
- Phase 6B-1 replaces the placeholder dashboard login with Discord OAuth session plumbing.
- Dashboard OAuth now uses signed HTTP-only session cookies and signed OAuth state cookies.
- Dashboard protected routes now require a valid session and filter guild/API access to authorized installed Discord guilds.
- Phase 6B OAuth smoke validation passed with locally configured `DISCORD_CLIENT_SECRET` and `DASHBOARD_SESSION_SECRET`.
- Phase 6B logout/access-control smoke validation passed.
- Phase 6C is planned around read-only owner value modules before controls or billing.
- Phase 6C-1 expands the dashboard metrics service with read-only Supabase owner-value data.
- Phase 6C-2 upgrades the dashboard layout to consume the read-only owner-value metrics APIs.
- Phase 6C-2 dashboard layout smoke validation passed.
- Phase 6C-3 adds read-only owner insight cards and improves dashboard hierarchy.
- Phase 6C-3 Dashboard Polish and Owner Insights completed.
- Phase 6C-4 refines the dashboard into a stronger owner command center.
- Phase 6C-4 visual smoke passed after server identity fallback follow-up.
- Phase 6C-5 enriches Recent Activity into a read-only community feed.
- Phase 6C-6 improves dashboard responsiveness across desktop, tablet, and phone widths.
- Phase 7A plans the public landing and Discord install flow for server owners.
- Phase 7A-1 route plan is locked: `/` becomes the public landing page, `/login.html` preserves dashboard login, and protected dashboard/API routes remain session-gated.
- Phase 7A-1 CTA mapping is locked: `Add to Discord` starts bot install OAuth, `View Dashboard` starts dashboard OAuth/login, and `Join Support Server` uses a configured support URL.
- Phase 7A-2 replaced `/` with a static public landing page and preserved dashboard login at `/login.html`.
- Phase 7A-2 public landing smoke validation passed.
- Phase 7A-3 polished `/install` and `/support` placeholders and added early onboarding copy.
- Phase 7B-1 adds dashboard onboarding for empty and low-activity servers without faking live data.
- Phase 7B-1 Onboarding and Empty States is completed.
- Phase 7B-2 polishes early-access landing copy, CTA expectations, and launch readiness documentation.
- Phase 7B-3 documents early-access deployment modes, process names, Supabase-v2 launch steps, dashboard hosting, duplicate bot checks, and JSON rollback.

## Post-Import Status

- Initial JSON import was run manually by Chris.
- Runtime still defaults to JSON.
- Imported counts reported:
  - `pal_catalog`: 197
  - `discord_guilds`: 1
  - `discord_users`: 1
  - `guild_memberships`: 1
  - `guild_players`: 1
  - `player_sphere_inventory`: 6
  - `player_daily_quests`: 1
  - `player_owned_pals`: 10

## Phase 3B Read-Only Validation

- Chris ran read-only Supabase adapter validation against imported data.
- Runtime still defaults to JSON.
- Validation results:
  - Pal catalog count: JSON 197 / Supabase 197
  - Guild player count: JSON 1 / Supabase 1
  - Owned Pal count: JSON 10 / Supabase 10
  - Sphere inventory keys matched.
  - Sphere inventory key count: JSON 6 / Supabase 6
  - Daily quest presence matched.

## Phase 4A Supabase Storage V2 Validation

- Chris ran Supabase Storage V2 read-only validation against imported data.
- Runtime still defaults to JSON.
- No runtime cutover has happened.
- Validation passed:
  - V2 `pg` adapter matched the existing Supabase read adapter.
  - Pal catalog count matched.
  - Guild player count matched.
  - Owned Pal count matched.
  - Sphere inventory keys matched.
  - Sphere inventory key count matched.
  - Daily quest presence matched.

## Phase 4B Supabase Storage V2 Write Validation

- Chris ran Supabase Storage V2 write validation.
- Runtime still defaults to JSON.
- No runtime cutover has happened.
- Validation used synthetic guild/user/Pal IDs.
- Cleanup was scoped to the synthetic records.
- Validation passed:
  - Player XP: PASS 50
  - Player coins: PASS 330
  - Player level: PASS 8
  - Basic spheres: PASS 11
  - Legendary spheres: PASS 1
  - Daily quest claimed: PASS true
  - Daily quest attempts: PASS 3
  - Owned Pal count: PASS 1
  - Owned Pal name: PASS Storage V2 Test Pal
  - Owned Pal level: PASS 6

## JSON-Provider Smoke Validation

- Chris ran JSON-provider smoke validation after the async compatibility refactor.
- Runtime still defaults to JSON.
- Supabase runtime cutover has not happened.
- Validation passed:
  - `/profile` passed after the acknowledgement fix.
  - `/mypals` passed.
  - `/buy` passed.
  - `/capture` passed.
  - Other read-only commands were tested by Chris.
- `git status` for JSON data files was clean after testing.

## Supabase-v2 Dev Runtime Smoke Test

- Chris ran the dev runtime smoke test with `STORAGE_PROVIDER=supabase-v2`.
- Runtime default remains JSON.
- Supabase runtime cutover has not happened.
- Preflight passed:
  - `check-db` passed.
  - V2 read validation passed.
  - V2 write validation passed.
- Runtime commands passed:
  - `/profile`
  - `/capture`
- Capture result:
  - Direhowl captured.
  - Basic sphere remaining became 0.
  - `/profile` reflected updated XP, coins, and failed captures state.
- JSON files remained clean after Supabase-v2 runtime testing.

## Supabase-v2 Broader Runtime Smoke Test

- Chris ran broader runtime smoke testing with `STORAGE_PROVIDER=supabase-v2`.
- Runtime default remains JSON.
- Supabase runtime cutover has not happened.
- Commands passed:
  - `/profile`
  - `/capture`
  - `/buy`
  - `/mypals`
  - `/leaderboard`
  - `/inspect`
  - `/quests`
- Observed Supabase runtime behavior:
  - Direhowl capture persisted to Supabase.
  - `player_owned_pals` showed runtime-written rows.
  - Quest progress updated.
  - Inventory and coins updated.
  - JSON files remained clean.
- Earlier console interaction acknowledgement errors were caused by a duplicate PM2-managed VPS bot process.
- Supabase-v2 was not responsible for those errors.
- After VPS bot removal:
  - `/profile` passed.
  - `/buy` passed.
  - `/capture` passed.
  - `deferReply` lifecycle was validated.
  - Supabase writes succeeded.
- Runtime smoke test accepted.
- Recommendation: Supabase-v2 is production-capable for continued testing; JSON remains available as rollback.

## Phase 6B-1 Discord OAuth Session Foundation

- Dashboard-only OAuth/session plumbing has been implemented.
- Bot runtime code, JSON data files, and storage provider defaults are unchanged.
- Implemented routes:
  - `/auth/discord` redirects to Discord OAuth with `identify` and `guilds` scopes.
  - `/auth/discord/callback` validates state, exchanges the code, fetches Discord user/guilds, filters manageable guilds, matches installed guilds, upserts Discord user identity, and creates a signed session.
  - `/logout` clears the signed session.
- Protected routes:
  - `/servers.html`
  - `/dashboard.html`
  - `/api/guilds`
  - `/api/guilds/:guildId/metrics`
- Access behavior:
  - HTML routes redirect to `/` without a valid session.
  - API routes return `401` without a valid session.
  - Metrics API returns `403` if the signed session does not authorize the requested guild.
- Required local Discord redirect URI:
  - `http://localhost:3000/auth/discord/callback`

## Phase 6B OAuth Smoke Validation

- Chris added `DISCORD_CLIENT_SECRET` locally.
- Chris added `DASHBOARD_SESSION_SECRET` locally.
- Discord OAuth login completed successfully.
- OAuth callback redirected into the protected dashboard flow.
- Session-protected dashboard loaded.
- Authorized guild metrics displayed:
  - Total Players: 1
  - Total Captures: 12
  - Total Owned Pals: 10
  - Daily Quest Activity: 1
- Sign out link appeared.
- Bot runtime code, JSON data files, and storage provider defaults are unchanged.

## Phase 6B OAuth Logout/Access-Control Smoke Validation

- Sign out cleared the dashboard session.
- Logout returned the user to `/`.
- Direct access to `/dashboard.html?guildId=1323324192627888339` after logout redirected back to login.
- Protected route behavior passed.
- Bot runtime code, JSON data files, and storage provider defaults are unchanged.

## Phase 6C Owner Dashboard Value Layer Planning

- Phase 6C plan created in `docs/OWNER_DASHBOARD_VALUE_LAYER_PLAN.md`.
- First owner-value modules:
  - Engagement Snapshot.
  - Top Collectors.
  - Paldeck / Collection Health.
  - Recent Activity Feed.
  - Owner Insight Cards.
- Implementation order:
  - 6C-1 metric service expansion.
  - 6C-2 dashboard layout upgrade.
  - 6C-3 recent activity and top collectors.
  - 6C-4 Paldeck completion card.
  - 6C-5 owner insight cards.
- Phase 6C guardrails:
  - Read-only Supabase data first.
  - No owner controls yet.
  - No event/spawn configuration yet.
  - No billing.
  - No bot gameplay changes.

## Phase 6C-1 Metric Service Expansion

- Dashboard metrics service expanded with read-only Supabase methods for:
  - Engagement Snapshot.
  - Top Collectors.
  - Paldeck Health.
  - Recent Activity.
- New protected API routes:
  - `/api/guilds/:guildId/engagement`
  - `/api/guilds/:guildId/top-collectors`
  - `/api/guilds/:guildId/paldeck-health`
  - `/api/guilds/:guildId/recent-activity`
- Existing `/api/guilds/:guildId/metrics` remains available and now shares the engagement snapshot service shape.
- Dashboard UI integration is intentionally deferred to Phase 6C-2.
- Bot runtime code, JSON data files, storage provider defaults, owner controls, and billing are unchanged.

## Phase 6C-2 Dashboard Layout Upgrade

- Dashboard UI upgraded into a read-only owner overview.
- Phase 6C-2 dashboard layout upgrade completed.
- Chris manually smoke-tested the dashboard layout.
- Added dashboard sections:
  - Engagement Snapshot.
  - Top Collectors.
  - Paldeck Health.
  - Recent Activity.
- Dashboard consumes protected read-only APIs:
  - `/api/guilds/:guildId/engagement`
  - `/api/guilds/:guildId/top-collectors`
  - `/api/guilds/:guildId/paldeck-health`
  - `/api/guilds/:guildId/recent-activity`
- Loading, empty, and API error states are handled per section.
- Manual smoke validation confirmed the owner overview sections rendered.
- Charts, owner controls, settings, billing, bot runtime changes, storage provider changes, and JSON data changes remain out of scope.

## Phase 6C-3 Dashboard Polish and Owner Insights

- Phase 6C-3 completed.
- Dashboard heading now uses the Supabase guild name when available and falls back to the guild id.
- Added read-only Owner Insight Cards:
  - Most Active Collector.
  - Rarest Recent Capture.
  - Collection Completion.
  - Engagement Opportunity.
- Insights are derived client-side from existing protected read-only metrics APIs.
- No new service/API changes were required for the insight cards.
- Manual visual smoke validation from dashboard screenshots passed.
- Visual hierarchy improved with an owner command center hero, clearer section labels, grouped insight cards, and stronger card spacing.
- Charts, admin controls, settings, billing, bot runtime changes, storage provider changes, and JSON data changes remain out of scope.

## Phase 6C-4 Dashboard Refinement and Server Identity Polish

- Hero section refined around server identity, with Supabase guild name display when available.
- Confirmed the imported dev guild row `1323324192627888339` currently has no stored `discord_guilds.name`.
- Added safe display fallback so the known dev guild renders as `CDawg's Fantasy World`.
- Added generic `Connected Discord Server` fallback for unnamed future guild rows.
- Raw guild IDs are now shown as smaller server identity metadata instead of leading the hero when a better display name exists.
- Added read-only Community Health score derived from existing engagement and Paldeck metrics.
- Added hero summary metrics for players, captures, Paldeck completion, and recent captures.
- Owner insight cards rewritten as:
  - MVP Collector.
  - Paldeck Progress.
  - Suggested Action.
  - Rarest Recent Capture.
- Recent Activity now renders as a timeline-style feed.
- Visual design refined with stronger card hierarchy, spacing, and subtle dashboard emphasis.
- Phase 6C-4 visual smoke passed with server identity follow-up noted and fixed.
- Charts, owner controls, settings, billing, bot runtime changes, storage provider changes, and JSON data changes remain out of scope.

## Phase 6C-5 Activity Feed Enrichment

- Recent Activity now combines capture and player activity events into one timeline-style feed.
- Added event labels:
  - Capture.
  - Shiny capture.
  - Rare capture.
  - Player activity.
- Rare and shiny capture events receive visual emphasis.
- Added lightweight activity summary cards:
  - Latest capture.
  - Most recent active player.
  - Recent capture count.
- Friendly relative timestamps are used where event timestamps are available.
- Existing `/api/guilds/:guildId/recent-activity` remains the data source; no service/API changes were required.
- Charts, owner controls, settings, billing, bot runtime changes, storage provider changes, and JSON data changes remain out of scope.

## Phase 6C-6 Dashboard Mobile and Responsive Polish

- Reviewed responsive behavior across desktop, tablet, and mobile breakpoints.
- Improved header wrapping so nav links do not crowd narrow screens.
- Improved hero stacking and made the Community Health card readable on mobile.
- Added tablet-specific card wrapping for snapshot, insight, and panel grids.
- Ensured owner insight cards, metric cards, activity summary cards, and timeline content collapse cleanly to one column on phones.
- Added overflow protection and stronger mobile spacing for long server names, insight text, and activity feed text.
- Dashboard remains read-only with no new metrics, controls, billing, bot runtime changes, storage provider changes, or JSON data changes.

## Phase 7A Public Landing and Install Flow Planning

- Phase 7A plan created in `docs/PUBLIC_LANDING_INSTALL_FLOW_PLAN.md`.
- Planned public landing purpose:
  - Explain the product.
  - Differentiate from player-only Palworld bots.
  - Sell owner dashboard and community engagement value.
  - Show key features.
  - Invite bot/install.
  - Login to dashboard.
- Planned primary CTAs:
  - Add to Discord.
  - View Dashboard / Login.
  - Join Support Server.
- Planned landing sections:
  - Hero.
  - What it does.
  - Owner dashboard screenshots/preview.
  - Player engagement loop.
  - Community health/analytics.
  - Pricing placeholder with no Stripe yet.
  - FAQ.
- Technical direction:
  - Public landing routes remain separate from protected dashboard routes.
  - Dashboard OAuth remains user auth.
  - Bot install OAuth remains separate application installation.
  - Post-install guild detection and onboarding empty states should be handled before public launch.

## Phase 7A-1 Landing Content and Route Plan

- `/` will become the public landing page for server owners.
- `/login.html` will preserve the current dashboard login experience.
- `/auth/discord` remains the dashboard user OAuth route.
- `Add to Discord` will use a bot install OAuth URL or install route.
- `View Dashboard / Login` will route to `/login.html` or `/auth/discord`.
- `Join Support Server` will use a configured support URL when available.
- `/servers.html`, `/dashboard.html`, `/api/guilds`, and `/api/guilds/:guildId/*` remain protected by dashboard session and guild authorization.
- Bot install OAuth and dashboard user OAuth remain separate flows.
- `Add to Discord` maps to `/install` or `DISCORD_BOT_INVITE_URL`.
- `View Dashboard` maps to `/login.html` or `/auth/discord`.
- `Join Support Server` maps to `/support` or `SUPPORT_SERVER_URL`.
- Landing content structure is locked: hero, owner value, dashboard preview, player engagement loop, community health/analytics, early-access pricing placeholder, and FAQ.
- First implementation slice: move the existing login page to `/login.html`, replace `/` with a static public landing page, and keep all protected dashboard routes unchanged.
- No bot runtime code, JSON data files, storage providers, Stripe, or owner controls changed.

## Phase 7A-2 Static Public Landing Page

- `/` is now a public landing page.
- `/login.html` preserves the dashboard login screen and links to `/auth/discord`.
- Public landing page rendered during smoke validation.
- Login page preservation was verified.
- Landing sections added:
  - Hero.
  - Owner value.
  - Dashboard preview.
  - Player engagement loop.
  - Community health and analytics.
  - Early-access pricing placeholder.
  - FAQ.
- CTA behavior:
  - `Add to Discord` points to `/install`.
  - `View Dashboard` points to `/login.html`.
  - `Join Support Server` points to `/support`.
- Smoke validation observed CTA behavior:
  - `Add to Discord` route resolved through the install helper behavior.
  - `View Dashboard` route preserved dashboard login access.
  - `Join Support Server` route resolved through the support helper behavior.
- `/install` redirects to `DISCORD_BOT_INVITE_URL` when configured and otherwise shows a placeholder.
- `/support` redirects to `SUPPORT_SERVER_URL` when configured and otherwise shows a placeholder.
- Protected dashboard routes remain protected.
- No bot runtime code, JSON data files, storage providers, Stripe, or owner controls changed.

## Phase 7A-3 Install URL and Onboarding Polish

- `/install` redirects to `DISCORD_BOT_INVITE_URL` when configured.
- `/install` shows a polished placeholder when the invite URL is missing.
- `/install` placeholder includes `View Dashboard` and `Back to Home` links.
- `/install` placeholder includes early onboarding copy:
  - Run `/start`.
  - Try `/capture`.
  - Claim `/daily`.
  - Check `/quests`.
  - Return to the dashboard once players interact.
- `/support` redirects to `SUPPORT_SERVER_URL` when configured.
- `/support` shows a polished placeholder when the support URL is missing.
- `/support` placeholder includes a `Back to Home` link.
- Bot install OAuth and dashboard user OAuth remain separate flows.
- No bot runtime code, JSON data files, storage providers, Stripe, or owner controls changed.

## Phase 7B-1 Onboarding and Empty States

- Phase 7B-1 completed.
- Onboarding smoke status: accepted.
- Dashboard now shows a welcome panel when server activity is empty or below early thresholds.
- Dashboard onboarding panel is recorded as the first-time owner entry point for empty and low-activity servers.
- Empty and low-activity guidance includes:
  - Run `/start`.
  - Try `/capture`.
  - Claim `/daily`.
  - Check `/quests`.
  - Return to the dashboard once players interact.
- Low-activity checklist is recorded as the primary next-action guidance.
- First activity guidance explains how captures, quests, leaderboards, and dashboard updates work together.
- Dashboard example cards are clearly labeled `Example Preview`.
- Example preview content is not presented as live data.
- Example Preview cards are recorded as educational preview content, not fake live metrics.
- Added install success page at `/install-success.html`.
- Install success page is recorded as part of the early owner onboarding path.
- Install success page includes:
  - Bot added successfully.
  - Open Dashboard.
  - Join Support Server.
  - Getting Started checklist.
- Landing page now includes guided launch messaging that matches onboarding.
- No bot runtime code, JSON data files, storage providers, Stripe, or owner controls changed.

## Phase 7B-2 Early Access Launch Polish

- Landing hero copy now emphasizes server-owner value and pilot-server fit.
- Early-access disclaimer added to the first viewport.
- Landing copy now avoids claiming broad production maturity.
- CTA messaging clarified:
  - `Add to Discord` may require early-access invite/configured bot invite URL.
  - `View Dashboard` requires Discord login.
  - `Join Support Server` routes help and feedback when configured.
- FAQ expanded and clarified:
  - Is this free?
  - Is it production-ready?
  - What does the bot do today?
  - What does the dashboard show?
  - How do I get help?
  - What happens after install?
- Added `docs/EARLY_ACCESS_LAUNCH_CHECKLIST.md`.
- Launch checklist covers bot invite URL, support URL, intentional Supabase-v2 runtime selection, duplicate bot process checks, dashboard OAuth env, smoke tests, known limitations, and soft launch target tracking.
- No bot runtime code, JSON data files, storage providers, Stripe, or owner controls changed.

## Phase 7B-3 Early Access Deployment Prep

- Added `docs/EARLY_ACCESS_DEPLOYMENT_RUNBOOK.md`.
- Documented runtime deployment modes:
  - Bot process.
  - Dashboard process.
  - Supabase database.
  - Public landing/dashboard URL.
- Process names decided:
  - `palworld-bot`.
  - `palworld-dashboard`.
- Deployment runbook covers:
  - Required env vars.
  - Starting bot with `STORAGE_PROVIDER=supabase-v2`.
  - Starting dashboard with `npm run dashboard:start`.
  - Duplicate bot process checks.
  - PM2/service recommendations.
  - Rollback to JSON.
  - Log checks.
  - Basic smoke test after deploy.
- Added `dashboard:start` npm script alias for dashboard hosting.
- No bot gameplay logic, JSON data files, storage provider defaults, or Stripe behavior changed.
