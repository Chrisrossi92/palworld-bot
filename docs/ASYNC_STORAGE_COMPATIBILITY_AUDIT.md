# Async Storage Compatibility Audit

This audit documents the runtime work required before cutting over from JSON storage to Supabase Storage V2. It is documentation only. Runtime still defaults to JSON.

## Scope Inspected

- `src/storage/index.js`
- `src/storage/jsonStorage.js`
- `src/storage/supabaseStorageV2.js`
- `src/systems/captureSystem.js`
- all command files under `src/commands`
- `src/index.js` where command execution is dispatched

## Current Storage Shape

- `jsonStorage` is synchronous.
- `supabaseStorage` is synchronous from the caller's perspective because it uses `spawnSync`.
- `supabaseStorageV2` is async because it uses `pg`.
- `storage/index.js` currently supports `json` and `supabase`; it does not support `supabase-v2`.
- Runtime default remains `STORAGE_PROVIDER=json`.

## Compatibility Conclusion

Runtime is not async-compatible yet.

`captureSystem.js` calls storage methods synchronously and returns immediate values. Command handlers then immediately read properties from those return values. If `supabaseStorageV2` were plugged in today, these call sites would receive Promises where they expect arrays, objects, booleans, and numbers.

Do not add `STORAGE_PROVIDER=supabase-v2` to runtime selection until the capture system and command handlers are converted to await async storage calls.

## captureSystem Public Methods

### `buySpheres(guildId, userId, sphere, quantity)`

- Storage methods: `updateGuildPlayerRecord`.
- Command callers: `src/commands/buy.js`.
- Immediate return usage: command reads `result.success`, `result.coins`, `result.updatedSphereCount`.
- Async risk: high; command must `await buySpheres(...)` after `deferReply`.

### `attemptCapture(guildId, userId, sphere)`

- Storage methods: indirectly `getGuildPlayerRecord`, `updateGuildOwnedPals`, `updateGuildPlayerRecord`.
- Command callers: none found directly.
- Immediate return usage: exported utility, not command path today.
- Async risk: medium if used later.

### `claimDailyReward(guildId, userId)`

- Storage methods: `updateGuildPlayerRecord`.
- Command callers: `src/commands/daily.js`.
- Immediate return usage: command reads `result.claimed`, `result.progression`, `result.sphereRewards`.
- Async risk: high; command must `await claimDailyReward(...)` after `deferReply`.

### `claimDailyQuestReward(guildId, userId)`

- Storage methods: `updateGuildPlayerRecord`.
- Command callers: `src/commands/quests.js`.
- Immediate return usage: command builds updated embed from return value.
- Async risk: high in button collector after `deferUpdate`.

### `claimStarterRewards(guildId, userId)`

- Storage methods: `updateGuildPlayerRecord`.
- Command callers: `src/commands/start.js`.
- Immediate return usage: command reads `result.claimed`, rewards, user record.
- Async risk: high; command must `await claimStarterRewards(...)` after `deferReply`.

### `consumeSphere(guildId, userId, sphere)`

- Storage methods: `updateGuildPlayerRecord`.
- Command callers: `src/commands/capture.js`, `src/commands/spawn.js`.
- Immediate return usage: button handlers read `sphereUse.consumed`, `sphereUse.sphere`, `sphereUse.remaining`.
- Async risk: very high; capture/spawn button flows must await before using result.

### `createEncounter(guildId, userId)`

- Storage methods: `getGuildPlayerRecord`.
- Command callers: `src/commands/capture.js`.
- Immediate return usage: command builds encounter embed immediately.
- Async risk: high; command must `await createEncounter(...)`.

### `createEncounterForLevel(userLevel, options)`

- Storage methods: `readPalCatalog`.
- Command callers: `src/commands/spawn.js`.
- Immediate return usage: command builds public spawn immediately.
- Async risk: medium; must become async because catalog reads are async under V2.

### `findPalByName(name)`

- Storage methods: `readPalCatalog`.
- Command callers: `src/commands/spawn.js`.
- Immediate return usage: command checks forced Pal result before spawning.
- Async risk: medium; must become async or use cached catalog.

### `getUserLevel(guildId, userId)`

- Storage methods: `getGuildPlayerRecord`.
- Command callers: `src/commands/spawn.js`.
- Immediate return usage: public spawn capture sets encounter level.
- Async risk: high in button flow.

### `getUserInventory(guildId, userId)`

- Storage methods: `getSphereInventory`.
- Command callers: `src/commands/capture.js`.
- Immediate return usage: repeated embed/button rendering during capture flow.
- Async risk: very high; many button-render calls must await inventory before rendering.

### `getUserRecord(guildId, userId)`

- Storage methods: `getGuildPlayerRecord`.
- Command callers: none found directly.
- Immediate return usage: exported utility.
- Async risk: medium if used later.

### `getTrainerTitle(level)`

- Storage methods: none.
- Command callers: internal/profile formatting paths.
- Async risk: none.

### `getDailyQuestStatus(guildId, userId)`

- Storage methods: `getGuildPlayerRecord`.
- Command callers: `src/commands/quests.js`.
- Immediate return usage: command reads `status.complete`, `status.dailyQuests.claimed`, embeds.
- Async risk: high; slash command and collector end handler must await.

### `readUserPals()`

- Storage methods: `readUserPals`.
- Command callers: `src/commands/leaderboard.js`, `src/commands/inspect.js`, `src/commands/mypals.js`, `src/commands/profile.js`.
- Immediate return usage: commands index into nested object immediately.
- Async risk: high; all callers must await.

### `readUsers()`

- Storage methods: `readUsers`.
- Command callers: `src/commands/leaderboard.js`, `src/commands/profile.js`.
- Immediate return usage: commands index into guild/user data immediately.
- Async risk: high; all callers must await.

### `resolveCaptureEncounter(guildId, userId, encounterPal, sphere)`

- Storage methods: indirectly `updateGuildOwnedPals`, `updateGuildPlayerRecord`.
- Command callers: `src/commands/capture.js`, `src/commands/spawn.js`.
- Immediate return usage: commands read `result.success`, `result.pal`, `result.progression`, `result.collectionUpdate`.
- Async risk: very high; capture/spawn resolution must await before rendering resolved embed.

### `spherePrices`

- Storage methods: none.
- Command callers: `src/commands/shop.js`, `src/commands/buy.js`.
- Immediate return usage: static object.
- Async risk: none.

## Command Handler Audit

### `src/commands/capture.js`

- Capture system calls: `createEncounter`, `getUserInventory`, `consumeSphere`, `resolveCaptureEncounter`.
- Handler already defers slash command with `deferReply`.
- Button collector defers with `deferUpdate`.
- Immediate Promise breakpoints: encounter embed, inventory buttons, sphere consume result, resolved capture result, follow-up inventory reads.
- Timing risk: high because the command does many DB-backed reads during button animation. Cache inventory values within the flow where possible.

### `src/commands/spawn.js`

- Capture system calls: `createEncounterForLevel`, `findPalByName`, `consumeSphere`, `getUserLevel`, `resolveCaptureEncounter`.
- Slash command defers for forced spawn path.
- Public spawn button handler defers with `deferUpdate`.
- Immediate Promise breakpoints: forced Pal lookup, public spawn encounter creation, sphere consume result, user level, resolved capture result.
- Timing risk: high because public spawn capture is shared and must prevent double resolution while awaiting DB writes.

### `src/commands/quests.js`

- Capture system calls: `getDailyQuestStatus`, `claimDailyQuestReward`.
- Slash command defers before initial storage work.
- Button collector defers before claim storage work.
- Immediate Promise breakpoints: status embed, claim result, updated status, collector end status.
- Timing risk: medium-high; daily quest claim must remain atomic and buttons should be disabled after claim.

### `src/commands/daily.js`

- Capture system calls: `claimDailyReward`.
- Defers before storage work.
- Immediate Promise breakpoints: result object.
- Timing risk: medium; must preserve one-claim-per-day semantics under async writes.

### `src/commands/buy.js`

- Capture system calls: `buySpheres`.
- Defers before storage work.
- Immediate Promise breakpoints: result object.
- Timing risk: medium; coin deduction and inventory update must remain atomic.

### `src/commands/start.js`

- Capture system calls: `claimStarterRewards`.
- Defers before storage work.
- Immediate Promise breakpoints: result object.
- Timing risk: medium; must avoid double starter reward if repeated.

### `src/commands/profile.js`

- Capture system calls: `readUsers`, `readUserPals`.
- Defers before storage work.
- Immediate Promise breakpoints: nested user/pal data reads.
- Timing risk: low-medium; read-only but can involve broader table reads.

### `src/commands/mypals.js`

- Capture system calls: `readUserPals`.
- Defers before storage work.
- Immediate Promise breakpoints: Palbox pagination source.
- Timing risk: low-medium; collector pagination uses already-loaded data.

### `src/commands/inspect.js`

- Capture system calls: `readUserPals`.
- Defers before storage work.
- Immediate Promise breakpoints: Pal lookup.
- Timing risk: low.

### `src/commands/leaderboard.js`

- Capture system calls: `readUsers`, `readUserPals`.
- Defers before storage work.
- Immediate Promise breakpoints: leaderboard data construction.
- Timing risk: medium; broad reads may grow expensive in SaaS.

### `src/commands/shop.js`, `src/commands/help.js`, `src/commands/ping.js`

- Capture system calls: `spherePrices` only for shop; none for help/ping.
- Async risk: none for storage.

## Discord Interaction Timing Risks

- Most slash commands that touch storage already call `deferReply` before storage work.
- Button collectors generally call `deferUpdate` before storage work.
- `/spawn` has early validation replies before storage-dependent forced-spawn work; storage work happens after defer.
- The main timing risk is not initial acknowledgement; it is long DB work during interactive capture animations and component collectors.
- After async refactor, any new storage call added before `deferReply` or `deferUpdate` should be rejected in review.

## Phased Migration Plan

### Phase A: Make `captureSystem` async-compatible while JSON still works

- Convert public storage-dependent functions to `async`.
- Use `await` around every storage method call.
- Keep pure helpers synchronous.
- JSON storage can remain synchronous; `await` works with non-Promise values.
- Do not change gameplay formulas, rewards, capture odds, cooldowns, or returned object shapes.
- Add temporary focused validation scripts or smoke checks for JSON provider.

### Phase B: Update command handlers to await `captureSystem`

- Update every command call site listed in this audit.
- Preserve existing defer/reply behavior.
- Avoid adding storage work before interaction acknowledgement.
- For capture/spawn button flows, await storage work before reading result properties.
- Keep user-facing text and command names unchanged.

### Phase C: Add `supabase-v2` provider selection while keeping JSON default

- Update `src/storage/index.js` to support `STORAGE_PROVIDER=supabase-v2`.
- Keep default `STORAGE_PROVIDER=json`.
- Keep existing `supabase` psql adapter available as fallback unless intentionally removed later.
- Require `SUPABASE_DB_URL` only when `supabase-v2` is selected.

### Phase D: Dev-server runtime smoke test with Supabase

- Stop bot before changing provider env.
- Start in a dev/test Discord server only.
- Run `/profile`, `/mypals`, `/daily` if safe, and one controlled `/capture` with a test user.
- Verify Supabase rows changed as expected.
- Verify JSON files are unchanged.
- Roll back to JSON after the test unless explicitly continuing validation.

### Phase E: Rollback checklist

- Stop bot.
- Set `STORAGE_PROVIDER=json`.
- Restart bot.
- Verify `/profile`, `/mypals`, and `/capture` against JSON.
- Do not manually roll back database rows unless a specific corruption issue is identified.

## Guardrails

- Runtime default remains JSON.
- No command behavior changes.
- No gameplay rule changes.
- No Supabase cutover until async refactor and smoke checks pass.
- No dashboard or Stripe work belongs in this migration path.
- Do not delete JSON storage or JSON data during cutover preparation.

## Recommended First Implementation Slice

Start with `captureSystem.js`.

1. Convert storage-dependent public functions to async.
2. Keep pure helper functions synchronous.
3. Add `await` around all storage calls.
4. Preserve all returned object shapes.
5. Run syntax validation.
6. Then update commands in the next slice to await the async functions.

Do not add `supabase-v2` provider selection until both `captureSystem` and command call sites are async-compatible.
