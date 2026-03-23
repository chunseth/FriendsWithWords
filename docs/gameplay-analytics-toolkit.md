# Gameplay Analytics Toolkit

CLI-first analysis scripts live in `scripts/analysis/` and share logic under `src/game/analysis/`.

## Core scripts

- `node scripts/analysis/solve-seed-greedy.js --seed <seed> [--mode classic|mini]`
- `node scripts/analysis/analyze-game.js --input <snapshot-or-turn-log.json>`
- `node scripts/analysis/simulate-board-layouts.js --seeds <seed1,seed2> [--layouts classic,mini]`
- `node scripts/analysis/search-layouts.js --seeds <seed1,seed2> [--baseLayout classic]`

## Dev-only visual board player (separate app entrypoint)

This does not alter normal in-app UX. It is a separate React Native entry file using `GameBoard` / `GameBoardMini`.

- iOS: `npm run dev:board-player:ios`
- Android: `npm run dev:board-player:android`
- Metro (required when using `--no-packager`): `npm run dev:board-player:metro`

Entry file:

- `index.boardPlayer.js`

Note: RN CLI in this repo does not support `--entry-file` on `run-ios` / `run-android`.  
The npm scripts above use `scripts/run-board-player.js` to temporarily switch entrypoint for the dev run, then restore `index.js` automatically.

Recommended launch flow:

1. Terminal A: `npm run dev:board-player:metro`
2. Terminal B: `npm run dev:board-player:ios -- --udid 6B7EAA0E-A074-4DA6-99F2-E2D823D0D87E --no-packager`

Optional one-shot (temporarily rewrites entrypoint):  
- `npm run dev:board-player:ios:oneshot -- --udid 6B7EAA0E-A074-4DA6-99F2-E2D823D0D87E --no-packager`

The dev app has two tabs:

- `Board Player`: turn-by-turn candidate selection and commit.
- `Layout Lab`: search/mutate board premium layouts, rank distributions, and preview selected layout visually.

## Additional insight scripts

- `seed-difficulty-index.js`
- `rack-balance-audit.js`
- `dictionary-impact-audit.js`
- `first-3-turn-snowball-analyzer.js`
- `skill-segment-benchmark.js`
- `mode-parity-report.js`
- `multiplayer-fairness-replay.js`
- `penalty-tuner.js`

## Input formats

### Snapshot format

A single game snapshot compatible with `useGame().getStableSnapshot()` shape:

- `gameMode`
- `currentSeed`
- `board`
- `tileRack`
- `tileBag`
- `premiumSquares`
- `turnCount`
- `wordHistory`
- etc.

### Turn log format

```json
{
  "initialState": {
    "seed": "20260321",
    "mode": "classic"
  },
  "turns": [
    {
      "action": "play",
      "move": {
        "direction": "horizontal",
        "startRow": 7,
        "startCol": 5,
        "placements": [
          { "row": 7, "col": 7, "rackIndex": 0, "letter": "A" }
        ]
      }
    }
  ]
}
```

## Output shape

Scripts produce JSON with fields such as:

- `summary`
- `turnAnalyses`
- `bestLine`
- `distributionStats`
- `layoutComparisons`
