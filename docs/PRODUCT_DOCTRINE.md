# Product Doctrine

This document locks the product direction for the Palworld Discord bot as it evolves into a hosted multi-server SaaS product.

## Product Model

- Discord is the action layer.
- The dashboard is the progression layer.
- Guild owners are the paying customer.
- Players drive engagement.
- The product is a Palworld community engagement platform for Discord server owners, not merely another Palworld bot.

Discord should remain where players perform fast actions: capture, buy, inspect, compete, join events, and react to spawns. The dashboard should become the place where owners and players understand progress over time: Paldeck completion, player activity, seasonal standings, guild settings, events, and monetized features.

Competition validates the market, but the product should not chase every competitor feature. Player-facing features matter, but they should reinforce owner-facing retention, community activity, and measurable server value.

## Core Pillars

### Collection

The core loop is catching and improving Pals. Palbox, Paldeck, rarity, shinies, favorites, nicknames, and collection completion should remain central.

### Identity

Players should be able to express who they are through showcased Pals, titles, achievements, seasonal history, favorite Pals, and profile presentation.

### Progression

XP, levels, coins, sphere inventory, stars, essence, quests, streaks, and seasonal progress should make repeated play feel meaningful.

### Competition

Leaderboards, rare captures, shiny hunting, seasonal rankings, and future battle/raid outcomes should create healthy guild-level competition.

### Cooperation

Public spawns, raids, events, guild goals, and shared seasonal objectives should make the bot feel like a community game rather than only a solo collector.

### Achievements

Achievements should reward skill, consistency, luck, collection milestones, event participation, and social play.

### Seasons

Seasons should provide resets, limited-time goals, badges, cosmetics, special events, and reasons for guilds to keep returning.

### Operator Value

Server owners need tools to keep their communities active. The dashboard, analytics, event controls, configurable spawns, campaigns, guild health reporting, and branded/community-specific experiences should be treated as differentiators, not back-office extras.

## Revenue Doctrine

### Free Tier

The free tier must be genuinely fun. It should include the core capture loop, Palbox, profile, daily rewards, basic quests, and basic leaderboards.

### Pro Tier

The Pro tier should add owner-facing value: analytics, richer guild settings, spawn/event configuration, dashboard insights, and quality-of-life controls.

### Community Tier

The Community tier should add advanced customization, stronger seasonal tools, premium events, raid/event controls, branding options, and deeper guild-scale features.

Paid tiers should enhance community management, customization, and long-term engagement. They should not make the free game feel broken or pointless.

## Technical Doctrine

- Supabase is the future single source of truth.
- Multi-tenant first: guild -> player -> progress.
- The dashboard is a first-class product surface.

The runtime bot can continue to use JSON while the product is being prepared, but production SaaS state should move to Supabase. Data models and storage calls should be designed around guild-scoped player progression, not global Discord user state.

The dashboard should not be treated as an afterthought or admin-only utility. It is a product surface for progression, retention, owner value, and billing.

## Decision Rules

- Preserve Discord command speed and simplicity.
- Put longitudinal progress, configuration, and analytics in the dashboard.
- Keep player progression scoped to a guild.
- Treat guild owners/admins as buyers and operators.
- Treat players as the engagement engine.
- Prioritize features that help Discord owners keep communities active.
- Keep player-facing improvements tied to retention, social play, and community engagement.
- Do not turn the roadmap into a competitor parity checklist.
- Avoid paid features that undermine the free collection loop.
- Prefer changes that make future Supabase, dashboard, and billing work simpler.
