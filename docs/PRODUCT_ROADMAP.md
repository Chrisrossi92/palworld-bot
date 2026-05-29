# Product Roadmap

This roadmap should be read alongside [PRODUCT_DOCTRINE.md](PRODUCT_DOCTRINE.md) and [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md). The doctrine defines product direction; the progress tracker records what has already been completed and what should come next.

## Positioning

Competition validates the market for Palworld Discord bots, but this product should not become a competitor parity checklist. PalVerse appears to be primarily a player-facing Palworld RPG/collection bot; this product should differentiate as a Palworld community engagement platform for Discord server owners.

The roadmap should prioritize owner/operator value: dashboard, analytics, configurable events, server-specific campaigns, branded/community experiences, retention tools, and guild health reporting. Player-facing features still matter, but they should support retention and community activity.

## Current Phase: JSON-Backed Guild-Safe Bot

- Guild-aware player progression and Palbox storage.
- Global command registration with optional dev guild mode.
- JSON storage abstraction in place for a future database backend.
- Current gameplay loop preserved: capture, daily, quests, shop, Palbox, profile, leaderboard, and public spawns.

## Next Phase: Supabase Storage

- Convert the planned schema into an initial SQL migration.
- Keep Supabase aligned with the doctrine: guilds are tenants, players are guild-scoped, and the dashboard is a first-class surface.
- Add Supabase project configuration and migrations.
- Implement a Supabase storage adapter behind the existing storage interface.
- Migrate `data/users.json`, `data/user-pals.json`, and `data/pals.json`.
- Add durability, concurrency safety, and production backup strategy.
- Preserve JSON fallback until the migration has been verified.

## Current Product Phase: Phase 7A Public Landing and Install Flow Planning

- Plan the public-facing product entry point for Discord server owners.
- Explain the product as a Palworld community engagement platform, not just another collection bot.
- Define Add to Discord, View Dashboard / Login, and Join Support Server CTAs.
- Keep bot install OAuth separate from dashboard login OAuth.
- Prepare the path for public landing content, install URL handling, and onboarding empty states.
- Do not add Stripe in Phase 7A.

Phase 7A should prioritize:

- Landing page content and route plan.
- Static public landing page.
- Safe Discord bot invite/install URL handling.
- Dashboard login CTA to existing Discord OAuth.
- Support server CTA placeholder.
- New-server onboarding empty states.

## Completed Product Phase: Phase 6C Owner Dashboard Value Layer

- Expand the authenticated owner dashboard into a read-only value layer.
- View player activity, guild stats, Palbox summaries, and collection health.
- Add basic engagement analytics before owner controls.
- Surface recent activity, top collectors, Paldeck completion, and owner insight cards.
- Keep dashboard access protected by Discord OAuth.

Phase 6C should prioritize these owner-value modules:

- Engagement Snapshot: total players, total captures, owned Pals, daily quest activity, recent captures, and active collectors.
- Top Collectors: captures leaderboard, rarest owned Pals, shiny collectors, and highest-level players.
- Paldeck / Collection Health: total catalog size, guild-owned unique species, completion percentage, and missing popular or rare Pals.
- Recent Activity Feed: latest captures, daily quest claims, new players, and rare/shiny events.
- Owner Insight Cards: most active player, rarest recent capture, players close to quest completion, collection progress, and engagement opportunities.

Implementation order:

1. 6C-1 metric service expansion.
2. 6C-2 dashboard layout upgrade.
3. 6C-3 recent activity and top collectors.
4. 6C-4 Paldeck completion card.
5. 6C-5 owner insight cards.

No owner controls, spawn/event configuration, advanced analytics, billing, or gameplay changes were added in Phase 6C.

## Completed Product Foundation

- Add a web dashboard for guild owners/admins.
- Add Discord OAuth and dashboard access controls.
- Display initial Supabase-backed owner metric cards.
- Establish the foundation for server-specific campaigns and branded community experiences.
- Improve Paldeck/profile surfaces so player progress feeds owner-facing engagement.

Phase 6A started with the dashboard shell, Discord OAuth implementation path, server selection, and Supabase-backed owner metric cards:

- Total Players.
- Total Captures.
- Total Owned Pals.
- Daily Quest Activity.

Advanced analytics, full Paldeck UI, billing, owner controls, and campaign tooling remain later phases.

## Future Phase: Stripe Billing

- Add guild-scoped subscriptions.
- Handle Stripe checkout, customer portal, and webhooks.
- Gate premium bot features by active guild subscription.
- Add billing status to the admin dashboard.

## Future Phase: Public SaaS Launch

- Harden invite/install flow.
- Add onboarding and support docs.
- Add production observability, error reporting, and backup monitoring.
- Prepare pricing, terms, privacy policy, and launch messaging.

## Feature Roadmap

- Server-owner dashboard.
- Discord OAuth.
- Basic analytics.
- Configurable spawn and event tools.
- Server-specific campaigns.
- Branded/community-specific experiences.
- Retention tools.
- Guild health/activity reporting.
- Paldeck completion tracking.
- Favorite Pals.
- Rarest Pal and showcase improvements.
- Pal nicknames.
- Expanded condensing mechanics.
- Battles.
- Raids.
- Achievements.
- Seasons and seasonal leaderboards.
- Reusable multi-game SaaS platform foundations.
