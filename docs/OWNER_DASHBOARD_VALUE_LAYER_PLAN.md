# Owner Dashboard Value Layer Plan

Phase 6C turns the authenticated dashboard foundation into a read-only owner value layer. The goal is to help Discord server owners understand community engagement before adding controls, campaigns, billing, or advanced permissions.

## Product Principle

The dashboard should answer owner/operator questions first:

- Are players active?
- Who is driving engagement?
- What collection goals can the server rally around?
- What happened recently?
- What should the owner do next to keep the community active?

All Phase 6C work should use read-only Supabase data first. No owner controls, spawn/event configuration, billing, or gameplay changes belong in this phase.

## Module 1: Engagement Snapshot

Purpose: give owners a fast health check for the selected guild.

Initial metrics:

- Total players.
- Total captures.
- Total owned Pals.
- Daily quest activity.
- Recent captures.
- Active collectors.

Implementation notes:

- Keep the existing four cards and expand the metrics service behind them.
- Define "active collectors" as players with recent capture or daily quest activity in the current observation window.
- Keep empty states explicit when Supabase data is missing.

## Module 2: Top Collectors

Purpose: make player engagement visible and celebrate contributors.

Initial views:

- Captures leaderboard.
- Rarest owned Pals.
- Shiny collectors.
- Highest-level players.

Implementation notes:

- Prefer compact ranked lists over large tables for the first pass.
- Do not add rewards, moderation tools, or admin actions yet.
- Keep player identity display conservative until richer profile data is available.

## Module 3: Paldeck / Collection Health

Purpose: show the server's collective collection progress.

Initial metrics:

- Total catalog size.
- Guild-owned unique species.
- Completion percentage.
- Missing popular or rare Pals.

Implementation notes:

- Compute completion from `pal_catalog` and guild-owned Pal species.
- Start with a single completion card and a short missing-Pals list.
- Defer full Paldeck UI, filters, search, and player-facing collection pages.

## Module 4: Recent Activity Feed

Purpose: give owners a clear view of current community activity.

Initial feed events:

- Latest captures.
- Daily quest claims.
- New players.
- Rare and shiny events.

Implementation notes:

- Use existing Supabase timestamps where available.
- If event-specific timestamps are incomplete, document the limitation and prefer accurate partial feeds over inferred noisy feeds.
- Keep the feed read-only.

## Module 5: Owner Insight Cards

Purpose: translate raw metrics into obvious owner actions.

Initial insight cards:

- Most active player.
- Rarest recent capture.
- Players close to quest completion.
- Collection completion progress.
- Engagement opportunities.

Implementation notes:

- Start with deterministic, explainable rules.
- Avoid AI-generated recommendations until the underlying metrics and event history are reliable.
- Make insight cards practical: "run a capture event", "highlight a collector", "remind players to finish quests".

## Implementation Order

### 6C-1: Metric Service Expansion

- Extend the Supabase metrics service with read-only queries for recent captures, active collectors, leaderboard data, Paldeck completion, and activity feed candidates.
- Keep query outputs small and dashboard-specific.
- Preserve current `/api/guilds/:guildId/metrics` behavior or version the response in a backward-compatible shape.

### 6C-2: Dashboard Layout Upgrade

- Upgrade the dashboard shell to support sections for snapshot cards, ranked lists, activity feed, Paldeck health, and insights.
- Keep the first screen scan-friendly for server owners.
- Do not add owner controls yet.

### 6C-3: Recent Activity / Top Collectors

- Add latest activity and top collector lists.
- Prioritize captures, quest activity, player level, and rare/shiny collection signals.
- Keep names and labels clear enough for manual owner interpretation.

### 6C-4: Paldeck Completion Card

- Add catalog size, unique owned species, completion percentage, and missing rare/popular Pals.
- Keep this as a compact owner-facing health card, not a full Paldeck UI.

### 6C-5: Owner Insight Cards

- Add deterministic insight cards based on the expanded metrics.
- Focus on retention and engagement opportunities.
- Keep the language operational and specific.

## Guardrails

- Do not modify bot runtime code.
- Do not modify JSON data files.
- Do not change storage providers.
- Do not add Stripe.
- Do not implement advanced controls.
- Do not add spawn/event configuration in Phase 6C.
- Use read-only Supabase data first.
- Keep dashboard access protected by the Phase 6B OAuth session model.

## Acceptance Criteria

- Owners can see a useful engagement snapshot beyond the initial four counts.
- Owners can identify top collectors and recent activity.
- Owners can understand guild Paldeck completion at a glance.
- Owners receive simple insight cards that point toward engagement opportunities.
- No bot gameplay, storage provider defaults, JSON data, billing, or advanced controls are changed.
