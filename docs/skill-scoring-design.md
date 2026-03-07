# Skill scoring design: time, perfection, consistency

This doc expands on skill-based bonuses for the solo seeded leaderboard. You already have: raw score, move penalty (2× turns), rack penalty, and scrabble bingo bonus. Below are the new pieces and a single **consistency bonus** concept in detail.

---

## 1. Time bonus (to implement)

**Idea:** Reward finishing the same puzzle in under a target time with tiers of points.

**Tracking:**
- **Start:** Record gameStartedAt when the first move is committed (or when the game is started from the menu). In useGame.js, set a ref or state when startNewGame(seed) is called; alternatively set it on first successful commitPreparedSubmitWord so “thinking time” before first move isn’t counted.
- **End:** Use the time when finishGame() runs (or when the last move is committed and bag is empty).

**Formula**
<40min 15 points
<1hr 10 points
<1hr30min 5 points
>1hr30 min no bonus

**Touchpoints:**
- useGame.js: add gameStartedAtRef (or state), set in startNewGame and/or on first commit; in finishGame, compute durationMs and pass into breakdown.
- buildFinalScoreBreakdown: add optional durationMs, compute timeBonus; add to finalScore and to breakdown for UI/submission.
- EndGameModal: show time bonus row when present.
- Leaderboard submission: add time_bonus (and optionally duration_seconds) to payload; schema may need new columns.

## 2. Perfection bonus (to implement)

**Idea:** One-time bonus for zero invalid word submissions during the game.

**Tracking:**
- **Invalid attempt:** Any time the player taps “Submit” and validation fails (invalid word, placement, etc.). In prepareSubmitWord() in useGame.js, when validateSubmitTurn returns ok: false, you already call setMessage(validation.error). Increment an **invalidSubmitCount** (ref or state) in that path only when the failure is due to **invalid word** (so placement/connection errors don’t count, if you want “perfection” to mean “no invalid words”).
- **Perfection:** At finishGame, if invalidSubmitCount === 0, award a fixed perfection bonus.

**Formula (example):**
- perfectionBonus = (invalidSubmitCount === 0) ? PERFECTION_BONUS : 0  
- PERFECTION_BONUS = 50, capped so it doesn’t dominate.

**Caveat:** If you count every validation failure (including “No Word”, “Invalid Placement”), perfection is very hard. Prefer counting only **invalid word** outcomes so the bonus is about dictionary accuracy, not UI mistakes.

**Touchpoints:**
- useGame.js: add invalidWordAttemptsRef (or state). In prepareSubmitWord, when !validation.ok and the error is word-related (e.g. validation.error.title === 'Invalid Word'), increment. Reset in startNewGame / resetGame.
- finishGame / buildFinalScoreBreakdown: accept invalidWordAttempts; set perfectionBonus from that; add to breakdown and final score.
- EndGameModal: show “Perfection bonus” row when > 0.
- Leaderboard: add perfection_bonus (and optionally invalid_word_attempts) to submission and schema. We want to display it with a star symbol to the left of the score text


## 3. Word score consistency bonus (concept)

**Idea:** Reward **low variance** in the quality of turns. Same seed and same total word points can be achieved with very different “shapes”: one player might have a few huge turns and many tiny ones; another might have steadier, medium-sized turns. The consistency bonus rewards the latter—controlled play with fewer “wasted” low-value turns.

**Why it reflects skill:**
- Avoiding unnecessary low-score plays (e.g. dumping a single tile for 2 points when the board and rack could support a better play later).
- Balancing risk: not relying on one or two bingo turns; building a more even score distribution.
- On a fixed seed, tile order is the same for everyone, so variance is about *how* you chose to play, not luck of the draw.

**What to measure:**
- You already have per-turn information in wordHistory: each entry has word, score, and turn. Multiple entries can share the same turn (e.g. main word + cross word + “SCRABBLE BONUS”).
- **Turn-level scores:** Group wordHistory by turn, sum score for that turn → array turnScores = [s1, s2, ..., sN].
- **Consistency metric:** Combo meter for >=20 point score per turn

**Formula:**
-Combo based tracking for turn score >= 20 points
-1-2 combo no reward
-3+ combo +2 points per turn (+2, +4, +6, +8)
-resets on combo break (<20 point score turn)

- **Swaps:** Swap turns don’t add to wordHistory but do add to turnCount. treat swap turns as 0 in turnScores. 

**Touchpoints:**
- '<MessageOverlay message={game.message}' on word accepted needs to show the ' consistencyBonus ' added to the current turn's score
- buildFinalScoreBreakdown: accept precomputed turnScores. Compute consistencyBonusTotal; add to breakdown and final score.
- finishGame: pass wordHistory into the breakdown builder.
- EndGameModal: show “Consistency bonus” row when present.

## 4. Score display

finalScore = wordPointsTotal - swapPenalties - turnPenalties - rackPenalty + timeBonus + consistencyBonusTotal + scrabbleBonusTotal + perfectionBonus

finalScore will be the displayed score in the leaderboards. 

## 5. Implementation checklist

| Item | Where | Notes |
|------|--------|------|
| Game start time | useGame.js – startNewGame or first commit | Store in ref; pass to breakdown at finish |
| Duration at finish | finishGame / buildFinalScoreBreakdown | durationMs = Date.now() - gameStartedAt |
| Time bonus | scoring.js – buildFinalScoreBreakdown | Add params; compute; add to finalScore and breakdown |
| Invalid word count | useGame.js – prepareSubmitWord when !validation.ok and word-related | Increment ref; reset on new/reset game |
| Perfection bonus | buildFinalScoreBreakdown | If invalidCount === 0, add fixed bonus; add to breakdown |
| Turn scores from history | buildFinalScoreBreakdown or helper | Group wordHistory by turn, sum score |
| Consistency bonus | buildFinalScoreBreakdown | sum consistencyBonus as consistencyBonusTotal, add to breakdown |
| EndGameModal | Rows for time, consistency, perfection | Only show rows when value &gt; 0 |
| Leaderboard submit | leaderboardService.js + schema | New columns: e.g. time_bonus, perfection_bonus, consistency_bonus, skill_score, duration_seconds, invalid_word_attempts |
| Leaderboard display | Perfection bonus display, enhanced game statistics | star symbol next to score for perfection; tapping on the row shows extra stats about the game (time played, # turns, consistency bonus, # scrabble bingos) |

---

## 6. Optional: schema additions

If you store skill components for transparency or future tuning:

```sql
-- Optional new columns on public.scores
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS invalid_word_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_bonus integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfection_bonus integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_bonus integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skill_score integer;
-- Then either rank by skill_score when present, or keep final_score as primary and use skill_score for display/sorting.
```

You can keep `final_score` as the “raw” score and set `skill_score = final_score + time_bonus + perfection_bonus + consistency_bonus` for ranking, or migrate to a single stored score that already includes bonuses (and store raw in a separate column if needed).
