const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const STRONG_LEAVE_LETTERS = new Set(["A", "E", "R", "S", "T", "L", "N", "I"]);
const HARD_LETTERS = new Set(["Q", "J", "X", "Z", "V", "K"]);

const normalizeLetter = (letter) => String(letter || "").trim().toUpperCase();

const calculateRackLeaveHeuristic = ({ tileRack = [], usedRackIndices = [] } = {}) => {
  const used = new Set(usedRackIndices);
  const leaveTiles = tileRack.filter((_, index) => !used.has(index));

  const letters = leaveTiles.map((tile) => normalizeLetter(tile.letter));
  const vowelCount = letters.filter((letter) => VOWELS.has(letter)).length;
  const consonantCount = letters.length - vowelCount;

  const balancePenalty = Math.abs(vowelCount - consonantCount) * 1.2;
  const retainableValue = letters.reduce((sum, letter) => {
    if (STRONG_LEAVE_LETTERS.has(letter)) return sum + 1.5;
    if (HARD_LETTERS.has(letter)) return sum - 1.25;
    return sum + 0.1;
  }, 0);

  const duplicatePenalty = letters.reduce((acc, letter, index) => {
    if (letters.indexOf(letter) !== index) {
      return acc + 0.4;
    }
    return acc;
  }, 0);

  return Number((retainableValue - balancePenalty - duplicatePenalty).toFixed(3));
};

export const evaluateMove = ({ move, state, rackLeaveWeight = 0.35 } = {}) => {
  if (!move || !state) {
    throw new Error("move and state are required for evaluation");
  }

  const leaveHeuristic = calculateRackLeaveHeuristic({
    tileRack: state.tileRack,
    usedRackIndices: move.usedRackIndices,
  });

  const evalScore = Number((move.turnScore + leaveHeuristic * rackLeaveWeight).toFixed(3));

  return {
    ...move,
    leaveHeuristic,
    evalScore,
  };
};

export const rankMoves = ({ moves = [], state, rackLeaveWeight = 0.35 } = {}) => {
  return moves
    .map((move) => evaluateMove({ move, state, rackLeaveWeight }))
    .sort((left, right) => {
      if (right.evalScore !== left.evalScore) {
        return right.evalScore - left.evalScore;
      }
      if (right.turnScore !== left.turnScore) {
        return right.turnScore - left.turnScore;
      }
      return String(left.word).localeCompare(String(right.word));
    });
};
