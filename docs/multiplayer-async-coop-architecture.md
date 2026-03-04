# Async Co-op Multiplayer Architecture

This document defines the first architecture pass for a multiplayer mode with:

- 2 players
- async turn handoff
- one shared board
- one shared score
- separate personal racks

It is intentionally scoped to the game engine and session model only. It does not cover invites, identity validation, matchmaking, or menu integration.

## Product contract

The multiplayer mode should feel like the existing solo game with shared responsibility:

- same seeded tile sequence
- same board rules
- same word validation
- same premium-square behavior
- one team score
- alternating turns

The active player is the only player allowed to mutate the board on a turn. The inactive player can inspect the run state but cannot commit moves.

## Reuse vs rebuild

### Reuse directly

- [`src/components/GameBoard.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/components/GameBoard.js)
  Board rendering and tile display remain valid for a shared board.
- [`src/components/TileRack.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/components/TileRack.js)
  The component is reusable as a rack presenter. Multiplayer should pass only the active player's rack as interactive.
- [`src/components/WordHistory.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/components/WordHistory.js)
  The history UI can render a shared action log or scored-word list with small formatting changes.
- [`src/utils/dictionary.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/utils/dictionary.js)
  Dictionary validation rules should be identical to solo mode.

### Reuse by extraction, not by direct import

- [`src/hooks/useGame.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/hooks/useGame.js)
  This contains the scoring, tile placement, submit validation, premium consumption, bag handling, and finish-game math that multiplayer should reuse. The current hook should not be imported directly because it assumes one rack, one local session, and one score owner. The shared logic should be extracted into pure helpers over time.
- [`src/App.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/App.js)
  The drag/drop orchestration and rack-to-board interactions are useful reference material for the multiplayer page, but the screen-level state should be rebuilt around a session envelope instead of copied.

### Rebuild for multiplayer

- Session storage and persistence
- Active-player turn locks
- Shared session hydration from a saved envelope
- Per-player racks and contribution summaries
- Shared action log with turn metadata
- Remote sync contract for turn handoff
- Multiplayer-specific end-of-game conditions and resume behavior

### Do not reuse

- [`src/utils/gameSnapshotStorage.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/utils/gameSnapshotStorage.js)
  The snapshot key and envelope are solo-specific.
- Solo score records, stats, and leaderboard submission modules
- Daily-seed home-screen wiring in [`src/App.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/App.js)

## Session envelope

Multiplayer should persist one canonical session object.

```js
{
  schemaVersion: 1,
  modeId: "async_coop_shared_score",
  sessionId: "server-or-local-id",
  seed: "seed-string",
  status: "active" | "completed" | "abandoned",
  sharedBoard,
  sharedPremiumSquares,
  sharedScore: {
    total,
    wordPointsTotal,
    swapPenaltyTotal,
    scrabbleBonusTotal,
    turnPenaltyTotal,
    rackPenaltyTotal,
    finalScore,
  },
  players: [
    {
      id,
      displayName,
      rack,
      contribution: {
        pointsScored,
        wordsPlayed,
        turnsTaken,
        swapsUsed,
      },
      readiness,
    }
  ],
  turn: {
    number,
    activePlayerId,
    passStreak,
    pendingAction,
    lockedAt,
    lastCompletedTurnId,
  },
  bag: {
    tiles,
    remainingCount,
    randomState,
  },
  history: [
    {
      id,
      turnNumber,
      actorId,
      action,
      scoreDelta,
      words,
      createdAt,
    }
  ],
  boardRevision,
  savedAt,
}
```

## Turn flow

### Start

1. Create one seeded bag from the shared seed.
2. Draw 7 tiles for Player 1.
3. Draw 7 tiles for Player 2.
4. Set `activePlayerId` to Player 1.
5. Persist the initial session envelope.

### Active player turn

1. Load the latest session envelope.
2. Verify `activePlayerId` matches the local player.
3. Lock the turn by setting `turn.pendingAction` and `turn.lockedAt`.
4. Permit temporary local mutations only against the active player's rack and the shared board draft state.
5. On `submit`, validate:
   - center rule for first turn
   - same-row or same-column placement
   - connectivity to existing board
   - all formed words valid
6. Apply scoring and consume premiums.
7. Refill only the active player's rack from the shared bag.
8. Append a history entry.
9. Rotate `activePlayerId` to the waiting player.
10. Increment `boardRevision`.
11. Persist the whole envelope.

### Swap

1. Active player selects tiles from their own rack only.
2. Remove those tiles from their rack.
3. Return them to the bag.
4. Draw replacements from the shared bag.
5. Apply team-level swap penalty to `sharedScore.total`.
6. Append a `swap` history entry.
7. Hand off turn to the other player.

### Pass

1. Append a `pass` history entry.
2. Increment `passStreak`.
3. Hand off turn.
4. If `passStreak === 2`, end the run.

## End-of-game rules

The first multiplayer version should keep endgame simple:

- Game ends when the shared bag is empty and the active player empties their rack on a valid play.
- Game also ends after two consecutive passes.
- Final rack penalty is the sum of remaining tile values across both players' racks.
- Final score is the shared score after all penalties and bonuses are applied.

Avoid adding asymmetric Scrabble-style "teammate rack bonus" rules in v1. A straight team penalty model is cleaner.

## File plan

### New files introduced now

- [`src/components/MultiplayerModeScreen.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/components/MultiplayerModeScreen.js)
  Standalone page shell for multiplayer mode architecture.
- [`src/hooks/useAsyncCoopSession.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/hooks/useAsyncCoopSession.js)
  Session-scoped multiplayer state scaffold with local save/load and turn handoff.
- [`src/utils/multiplayerSessionStorage.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/utils/multiplayerSessionStorage.js)
  Dedicated persistence envelope for multiplayer sessions.
- [`src/game/shared/bag.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/game/shared/bag.js)
  Shared seeded bag and draw helpers used by solo and multiplayer code.
- [`src/game/shared/premiumSquares.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/game/shared/premiumSquares.js)
  Shared board constants and classic premium-square layout.
- [`src/game/shared/scoring.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/game/shared/scoring.js)
  Shared turn-scoring and final-score helpers.
- [`src/game/shared/validation.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/game/shared/validation.js)
  Shared submit validation and word extraction helpers.
- [`src/hooks/useTileDragDropController.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/hooks/useTileDragDropController.js)
  Shared rack/board drag, pickup, snap, and optimistic placement controller used by both solo and multiplayer screens.

### Next extraction targets

- Board-submit payload construction for applying validated moves to solo and multiplayer sessions.
- Shared rack refill helpers for swap and submit flows.
- Shared end-of-game resolution for multiplayer rack penalties and pass-streak termination.
- Shared board draft helpers so transient local move state stays outside the persisted session envelope.

## Implementation phases

### Phase 1: local architecture

- Add multiplayer session envelope
- Add standalone multiplayer screen
- Separate multiplayer storage key and serializer
- Build session selectors for active player, waiting player, and turn state

### Phase 2: extracted engine helpers

- Move scoring, validation, and bag logic into shared pure modules
- Replace mock handoff actions with real board-submit flow
- Keep current solo mode behavior unchanged

### Phase 3: remote session sync

- Replace local persistence with authoritative remote session storage
- Add revision checks and conflict handling
- Add resume-from-latest-session flow

Current prototype implementation:

- [`src/services/multiplayerSessionService.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/services/multiplayerSessionService.js) writes the full session envelope to Supabase when backend env vars are configured.
- [`src/hooks/useAsyncCoopSession.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/hooks/useAsyncCoopSession.js) now prefers remote load/save and falls back to local storage if Supabase is not configured.

## Backend setup

For the current prototype, multiplayer sessions are stored in a dedicated `multiplayer_sessions` table.

### Apply schema

Run the SQL in:

- [`supabase/schema.sql`](/Users/sethchun/Documents/WordsWithRealFriends/supabase/schema.sql)

This now creates:

- `scores`
- `multiplayer_sessions`

### Configure env

Add these env vars:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

These are already read by:

- [`src/config/backend.js`](/Users/sethchun/Documents/WordsWithRealFriends/src/config/backend.js)

### What is stored remotely

The multiplayer service persists:

- `session_id`
- `mode_id`
- `seed`
- `status`
- `board_revision`
- `active_player_id`
- `participant_player_ids`
- `session_payload`
- `saved_at`

The full board, both racks, bag state, score state, and turn state are stored inside `session_payload`.

### Important limitation

The current `multiplayer_sessions` RLS policy is intentionally permissive for authenticated users:

- any authenticated session can read multiplayer sessions
- any authenticated session can insert/update multiplayer sessions

That is acceptable only for the current prototype because invite flow, participant auth mapping, and turn ownership enforcement are not implemented yet.

Before shipping, tighten this to:

- participant-scoped reads
- active-player-scoped writes
- revision-checked updates to prevent turn overwrite races

## Practical warnings

- Do not fork `useGame` into a second giant multiplayer hook. That will create two engines that drift.
- Do not let multiplayer write into solo stats or solo leaderboard tables.
- Do not mix UI-only transient drag state into the persisted session envelope.
- Keep one canonical persisted board state and one ephemeral local draft state for the active player's turn.
