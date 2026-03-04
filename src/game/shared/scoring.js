import { SCRABBLE_BONUS } from "./premiumSquares";

export const calculateWordScore = ({ board, wordData, premiumSquares }) => {
  let score = 0;
  let wordMultiplier = 1;

  wordData.cells.forEach(({ row, col }) => {
    const tile = board[row][col];
    if (!tile) return;

    const premium = premiumSquares[`${row},${col}`];

    if (premium === "dw" || premium === "center") {
      wordMultiplier *= 2;
    } else if (premium === "tw") {
      wordMultiplier *= 3;
    }

    if (tile.isBlank) {
      score += 0;
      return;
    }

    let tileMultiplier = 1;
    if (premium === "dl") tileMultiplier = 2;
    else if (premium === "tl") tileMultiplier = 3;
    score += tile.value * tileMultiplier;
  });

  return score * wordMultiplier;
};

export const scoreSubmittedWords = ({
  board,
  newWords,
  premiumSquares,
  turnCount,
  placedCells,
}) => {
  let baseWordScore = 0;
  const newHistory = newWords.map((wordData) => {
    const score = calculateWordScore({ board, wordData, premiumSquares });
    baseWordScore += score;
    return {
      word: wordData.word.toUpperCase(),
      score,
      turn: turnCount + 1,
    };
  });

  const earnedScrabbleBonus = placedCells.length === 7;
  const scrabbleBonus = earnedScrabbleBonus ? SCRABBLE_BONUS : 0;

  if (earnedScrabbleBonus) {
    newHistory.push({
      word: "SCRABBLE BONUS",
      score: SCRABBLE_BONUS,
      turn: turnCount + 1,
    });
  }

  return {
    baseWordScore,
    turnScore: baseWordScore + scrabbleBonus,
    earnedScrabbleBonus,
    scrabbleBonus,
    newHistory,
  };
};

export const buildFinalScoreBreakdown = ({
  wordPointsTotal,
  swapPenaltyTotal,
  scrabbleBonusTotal,
  turnCount,
  rackTiles,
}) => {
  const turnPenalties = turnCount * 2;
  const rackPenalty = rackTiles.reduce((sum, tile) => sum + (tile?.value ?? 0), 0);
  const finalScore =
    wordPointsTotal -
    swapPenaltyTotal -
    turnPenalties -
    rackPenalty +
    scrabbleBonusTotal;

  return {
    pointsEarned: wordPointsTotal,
    swapPenalties: swapPenaltyTotal,
    turnPenalties,
    rackPenalty,
    scrabbleBonus: scrabbleBonusTotal,
    finalScore,
  };
};
