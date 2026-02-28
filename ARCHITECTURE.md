# Words with Friends Clone — Architecture Plan

This document breaks down every major piece needed for a complete Words-with-Friends-style game. Each section describes **what it is**, **what’s already built**, and **what still needs to be built**.

---

## 1. Game board — layout and data

| Aspect | Description | Status |
|--------|-------------|--------|
| **Grid** | 15×15 cell grid; each cell is either empty or holds one tile. | ✅ Done — `board[row][col]` in `useGame`. |
| **Board layout (UI)** | Visual grid with consistent cell size, fits on screen. | ✅ Done — `GameBoard.js` uses `CELL_SIZE`, responsive. |
| **Cell model** | Each cell: position `(row, col)`, optional tile `{ letter, value, rackIndex?, isFromRack? }`, premium type. | ✅ Done. |
| **Premium squares** | Fixed positions for DW, TW, DL, TL, center (★). Stored as a map `"row,col" → type`. | ✅ Done — `getPremiumSquares()` in `useGame.js`. |
| **Premium consumption** | Premiums are one-time use; remove from map when a word covers that cell. | ✅ Done — after `submitWord`, premiums on used cells are deleted. |

**Gaps:** None for single-board layout. Optional later: board theme/skin, accessibility (e.g. labels for premium types).

---

## 2. Tiles and bag — distribution, drawing, seeding

| Aspect | Description | Status |
|--------|-------------|--------|
| **Tile definition** | Letter, point value. Blanks (wildcards) have no letter until played. | ✅ Done — `BLANK_LETTER` in `TILE_DISTRIBUTION`. |
| **Tile distribution** | Standard Scrabble-style counts and values (A–Z). | ✅ Done — `TILE_DISTRIBUTION` in `useGame.js`. |
| **Blanks** | Two blanks, value 0; when played, player chooses letter (no extra points for letter). | ✅ Done — 2 blanks in bag; letter picker on place; value 0 in scoring. |
| **Tile bag** | 100 tiles total; build array from distribution, shuffle. | ✅ Done — `initializeTileBag()`, then shuffle. |
| **Shuffle / seeding** | Reproducible game for same seed (e.g. replay, sharing). | ✅ Done — `createSeededRandom(seed)`, `shuffleArray(bag, randomFn)`. |
| **Draw order** | Tiles drawn from bag (e.g. `pop`) so order is deterministic for a given seed. | ✅ Done — `tileBagRef.current.pop()`. |
| **Rack size** | Each player has up to 7 tiles; refill after each turn until bag empty. | ✅ Done for single player; second player rack not modeled yet. |

**Gaps:** Add 2 blanks to distribution and bag. Implement “choose letter for blank” when placing (UI + state). Multiplayer will need separate racks and bag shared across players.

---

## 3. Tile rack — display and interaction

| Aspect | Description | Status |
|--------|-------------|--------|
| **Display** | Show current player’s 7 (or fewer) tiles; letter + value. | ✅ Done — `TileRack.js`, receives `tiles` from `useGame`. |
| **Order** | Tiles have a stable order (array index); “used this turn” tracked by index. | ✅ Done — `rackIndex` on placed tiles, `selectedTiles` as indices. |
| **Selection** | Player selects tiles (e.g. tap) to place; selected state visible. | ✅ Done — `selectedTiles`, `onTileClick`, “used” styling. |
| **Shuffle rack** | Reorder rack without changing contents (cosmetic). | ✅ Done — `shuffleRack()`. |
| **Blanks on rack** | Show blank as empty or “?” until placed and letter chosen. | ❌ N/A until blanks exist. |

**Gaps:** When adding a second player, rack must reflect **current** player only and swap between turns. Blank tile display and “pick letter” flow when placing a blank.

---

## 4. Placing tiles on the board — flow and rules

| Aspect | Description | Status |
|--------|-------------|--------|
| **Placement flow** | Select tile(s) on rack → tap empty cell → tile appears on board (still “in play” until submit). | ✅ Done — `selectTile`, `handleCellClick`, `placeTileOnBoard`. |
| **Removing from board** | Return tile to rack (undo placement this turn). | ✅ Done — `removeTileFromBoard`, `clearSelection`. |
| **One tile per cell** | Cell either empty or one tile. | ✅ Enforced. |
| **No duplicate use** | A tile can’t be placed twice in the same turn. | ✅ Done — `tilesUsedThisTurnRef`. |
| **First turn — center** | First word must use the center cell (7,7). | ✅ Done — `isFirstTurn` and center check in `submitWord`. |
| **Later turns — connection** | At least one new tile must be adjacent (up/down/left/right) to an existing tile. | ✅ Done — adjacency check in `submitWord`. |
| **Contiguity** | Placed tiles this turn must form a single connected set (no gaps). | ⚠️ Not enforced — player could place non-adjacent tiles; validation only checks “has connection” and “all words valid”. |
| **Line constraint** | All tiles placed in one turn must lie on one row or one column (Scrabble/WWF rule). | ❌ Not enforced — current code allows arbitrary shapes as long as words are valid. |

**Gaps:** Enforce **single row or single column** for the tiles placed this turn. Optionally enforce **contiguity** of placed tiles. Implement blank: on place, open “choose letter” modal; store chosen letter on board (value 0).

---

## 5. Word detection and validation

| Aspect | Description | Status |
|--------|-------------|--------|
| **Extract words** | Scan board for horizontal and vertical runs of 2+ tiles. | ✅ Done — `getWordsOnBoard()` (horizontal + vertical). |
| **Word list** | All distinct words on board (no duplicate segments). | ✅ Done — visited set by word key. |
| **“New” words** | Words that include at least one cell that was empty at turn start. | ✅ Done — `hasNewTiles()` vs `boardAtTurnStartRef`. |
| **Dictionary** | Load word list; check `isValid(word)`. | ✅ Done — `dictionary.js` (remote load + fallback). |
| **Validate on submit** | Every word on the board (after placement) must be in the dictionary. | ✅ Done — all words checked; invalid list shown. |
| **Minimum new tiles** | At least one new tile must be placed (so at least one “new” word). | ✅ Done. |

**Gaps:** Dictionary is generic English; you may want a Words-with-Friends-specific word list. No “challenge” flow (dispute word); optional later.

---

## 6. Points and scoring

| Aspect | Description | Status |
|--------|-------------|--------|
| **Letter values** | Per-tile point value (from distribution). | ✅ Done — `tile.value`. |
| **Board multipliers** | DL (×2 letter), TL (×3 letter), DW (×2 word), TW (×3 word), center = DW. | ✅ Done — `calculateWordScore`, premiums from `premiumSquaresRef`. |
| **Word score** | Sum (letter × letter mult) per cell, then × word multiplier(s). | ✅ Done — correct for single word. |
| **Multiple words in one turn** | Sum score of every **new** word formed. | ✅ Done — `newWords.forEach`, `turnScore += calculateWordScore`. |
| **Bingo** | Bonus (e.g. +50) when using all 7 rack tiles in one turn. | ✅ Done — `if (selectedCells.length === 7) turnScore += 50`. |
| **Premium once only** | Premium applied when word is placed; then removed. | ✅ Done. |
| **Running total** | Current player’s cumulative score. | ✅ Done — `totalScore`. |
| **Blanks** | Value 0; no letter multiplier for the blank cell. | ✅ Done — `tile.isBlank` in `calculateWordScore`; value 0, no DL/TL. |

**Gaps:** Second player’s score and turn-based scoring. (Final scoring for single player is done — see Game over.)

---

## 7. Game state — single vs two players

| Aspect | Description | Status |
|--------|-------------|--------|
| **Board state** | 15×15 grid of tile or null. | ✅ Done. |
| **Current player** | Who is allowed to place tiles and submit. | ❌ Single player only — no “current player” or turn alternation. |
| **Player scores** | Score per player. | ⚠️ Only `totalScore` (one player). |
| **Player racks** | 7 tiles per player. | ⚠️ Only `tileRack` (one player). |
| **Tile bag** | Shared; refill racks after each turn. | ✅ Done — single bag in ref. |
| **Turn state** | “In progress” (placing) vs “submitted” (refill, switch turn). | ⚠️ Implicit — no explicit “current turn” or “other player”. |
| **First turn** | Must use center. | ✅ Done — `isFirstTurn`. |
| **Board snapshot** | State at start of current turn (for “new words” and undo). | ✅ Done — `boardAtTurnStartRef`. |

**Gaps:** Introduce **two players** (e.g. `currentPlayerIndex`, `scores[0]`, `scores[1]`, `racks[0]`, `racks[1]`). After submit: add turn score to current player, refill current player’s rack, then switch `currentPlayerIndex`. Pass and Swap also “end turn” and switch player.

---

## 8. Turn actions — submit, pass, swap

| Aspect | Description | Status |
|--------|-------------|--------|
| **Submit play** | Validate placement and words → add score → remove used tiles from rack → refill rack → (later) switch player. | ✅ Done except second player and game-over check. |
| **Pass** | Skip placing; no score; turn ends; switch player. | ❌ Not implemented. |
| **Swap** | Choose 1–7 tiles to exchange with same number from bag (no peek); turn ends; switch player. | ❌ Not implemented. |
| **Consecutive passes** | If both players pass in sequence, game ends. | ❌ Not implemented. |

**Gaps:** Add `passTurn()` and `swapTiles(indices[])`. Track “last action” (play / pass / swap) and “previous turn was pass” to detect two consecutive passes. After submit/pass/swap: switch current player and, when applicable, check game-over conditions.

---

## 9. Game over and win/loss

| Aspect | Description | Status |
|--------|-------------|--------|
| **End condition — empty rack** | One player has 0 tiles and the bag is empty → game ends. | ❌ Not implemented. |
| **End condition — consecutive passes** | Both players pass in a row → game ends. | ❌ Not implemented. |
| **Final scoring** | Each player: subtract point value of tiles still on their rack from their score. | ❌ Not implemented. |
| **End bonus** | If one player went out (0 tiles), add the **other** player’s unplayed tile sum to the first player’s score. | ❌ Not implemented. |
| **Winner** | Compare final scores; tie possible. | ❌ Not implemented. |
| **Game-over state** | Store `gameOver: true`, `winnerIndex` or `tie`, `finalScores`. | ❌ Not implemented. |
| **UI** | Disable board/rack; show “Game Over”, winner, final scores; option to start new game. | ❌ Not implemented. |

**Gaps:** Full game-over flow: detect end, compute final scores, set `gameOver` state, show result screen/modal, and block further moves until “New game”.

---

## 10. Game-over state management (summary)

- **When to evaluate:** After every submit (and after pass/swap once those exist).
- **Checks:** (1) Current player’s rack empty and bag empty → game over. (2) Both last two moves were pass → game over.
- **On game over:** Compute final scores (deduct unplayed tiles; add opponent’s unplayed to score of player who went out). Set `gameOver`, `winnerIndex`/`tie`, `finalScores`. UI shows result and only allows “New game” (or “Rematch” with same seed if desired).

---

## 11. UI and UX (high level)

| Area | Status | Notes |
|------|--------|--------|
| Board render | ✅ | Grid, premiums, tiles, tap to place/remove. |
| Rack render | ✅ | Tiles, selection, shuffle. |
| Score / turn / bag | ✅ | GameInfo shows score, turn count, tiles remaining; seed and New/Reset. |
| Word history | ✅ | List of played words and scores. |
| Messages | ✅ | MessageOverlay for errors and “Word accepted”. |
| Turn indicator | ❌ | Need “Player 1” / “Player 2” and whose turn. |
| Pass / Swap buttons | ❌ | Add and wire to `passTurn` and swap flow. |
| Game-over screen | ❌ | Modal or screen with winner and final scores. |
| Blank letter picker | ❌ | When placing a blank, modal to choose A–Z. |

---

## 12. Drag performance (smooth tile-following)

**Why drags can lag:** Every touch move runs on the JS thread and can trigger React `setState`. If drop-target or rack-placeholder state is updated on every move, the whole tree (App → GameBoard → 225 cells) re-renders many times per second, causing jank.

**What we do (current stack):**
- **Floating tile position** uses `Animated.ValueXY` and `setValue()` so the tile that follows the finger is driven by the native driver — no React re-render per frame for position.
- **Drop target / rack placeholder** state is only updated when the value **actually changes** (e.g. new cell or new rack slot), not on every move. When the finger is over the rack, board hit-test is skipped to reduce work.
- **Dwell time** (50 ms) before showing board drop target avoids flicker and reduces updates.

**How pro games (Words with Friends, Q-less, etc.) get even smoother motion:**
- They run **gesture and position updates on the UI thread** so the finger-following view never waits on the JS bridge. That usually means **react-native-reanimated**: gesture handler updates a **shared value** on the UI thread, and the floating tile uses `useAnimatedStyle` with that value so the transform is applied natively at 60 fps.
- Drop-target highlighting can be driven by a shared value too (or by throttled JS updates). On drop, the app reads the final cell/slot on the JS thread once.
- Adding `react-native-reanimated` and moving the pan gesture + drag position into Reanimated (e.g. `useSharedValue`, `useAnimatedGestureHandler`, `useAnimatedStyle`) would remove per-frame JS work during drag and give the smoothest result.

---

## 13. Suggested build order (for a full clone)

1. **Two-player state** — Add `currentPlayerIndex`, `scores[2]`, `racks[2]`; refill and switch player after submit; UI shows current player and both scores.
2. **Turn actions** — Implement Pass and Swap; track “last action” and implement “game over on two consecutive passes”.
3. **Placement rules** — Enforce “single row or single column” for tiles placed this turn (and contiguity if you want).
4. **Game over** — Detect both end conditions; final scoring (deduct unplayed, end bonus); set `gameOver` and show result UI.
5. **Blanks** — Add blanks to bag and distribution; “choose letter” when placing blank; value 0 in scoring.

After that you have a complete single-device, two-player Words-with-Friends-style game. Multiplayer (async/online) would be a separate layer (matchmaking, persistence, push, etc.).

---

## Quick reference — what’s done vs missing

| Piece | Done | Missing |
|-------|------|--------|
| Board layout & data | ✅ | — |
| Premium squares | ✅ | — |
| Tile bag & seeding | ✅ | — (blanks included) |
| Rack display & selection | ✅ | Second rack (two-player) |
| Place / remove tiles | ✅ | Enforce row/column + contiguity |
| First turn & connection | ✅ | — |
| Word extraction & dictionary | ✅ | — |
| Scoring (turn + bingo) | ✅ | — |
| Two players & turn switch | ❌ | Full |
| Pass / Swap | ✅ Swap | Pass (two-player only) |
| Game over & final score | ✅ | End bonus, winner (two-player) |
| Game-over UI | ✅ | Optional modal/screen (two-player) |
