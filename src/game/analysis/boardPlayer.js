import { generateLegalMoves } from "./moveGenerator";
import { rankMoves } from "./moveEvaluator";
import { getDefaultLexicon } from "./lexicon";
import { applyMoveToState } from "./replayEngine";
import { createInitialAnalysisState } from "./stateAdapter";

const cloneBoard = (board = []) =>
  board.map((row) => row.map((cell) => (cell == null ? null : { ...cell })));

const cloneTiles = (tiles = []) => tiles.map((tile) => ({ ...tile }));

const cloneState = (state) => ({
  ...state,
  board: cloneBoard(state.board),
  tileRack: cloneTiles(state.tileRack),
  tileBag: cloneTiles(state.tileBag),
  premiumSquares: { ...(state.premiumSquares || {}) },
  wordHistory: Array.isArray(state.wordHistory) ? [...state.wordHistory] : [],
  moveHistory: Array.isArray(state.moveHistory)
    ? state.moveHistory.map((entry) => ({ ...entry }))
    : [],
  drawHistory: Array.isArray(state.drawHistory)
    ? state.drawHistory.map((entry) => ({
        ...entry,
        drawnTiles: cloneTiles(entry.drawnTiles || []),
        bagBeforeDraw: cloneTiles(entry.bagBeforeDraw || []),
      }))
    : [],
  boardAtTurnStart: Array.isArray(state.boardAtTurnStart)
    ? state.boardAtTurnStart.map((row) => [...row])
    : null,
});

const serializeCandidateMove = (candidate, candidateIndex) => ({
  id: `${candidate.word}-${candidate.startRow}-${candidate.startCol}-${candidate.direction}-${candidateIndex}`,
  word: candidate.word,
  score: candidate.turnScore,
  move: {
    ...candidate,
    placements: (candidate.placements || []).map((placement) => ({ ...placement })),
    usedRackIndices: [...(candidate.usedRackIndices || [])],
  },
});

const getTurnEntry = (script, turnIndex) =>
  (script?.turns || []).find((turn) => turn.turnIndex === turnIndex) || null;

const createPositionEntry = ({
  turnIndex,
  positionState,
  playedWord = null,
  playedScore = 0,
}) => ({
  turnIndex,
  turnLabel: turnIndex === 0 ? "Start" : `After Turn ${turnIndex}`,
  board: cloneBoard(positionState.board),
  positionState: cloneState(positionState),
  playedWord,
  playedScore,
});

export const buildBoardPlayerScript = ({
  seed,
  mode = "classic",
  layoutId = null,
  topWordCount = 30,
} = {}) => {
  if (!seed) {
    throw new Error("seed is required");
  }

  const initialState = createInitialAnalysisState({ seed, mode, layoutId });

  return {
    seed: String(seed),
    mode,
    layoutId: layoutId || mode,
    topWordCount,
    turns: [
      createPositionEntry({
        turnIndex: 0,
        positionState: initialState,
      }),
    ],
  };
};

export const getCandidateMovesForPosition = ({
  script,
  positionTurnIndex,
} = {}) => {
  const entry = getTurnEntry(script, positionTurnIndex);
  if (!entry?.positionState) {
    return [];
  }

  const lexicon = getDefaultLexicon();
  return rankMoves({
    moves: generateLegalMoves({
      state: entry.positionState,
      lexicon,
      maxMoves: 240,
    }),
    state: entry.positionState,
  })
    .slice(0, script?.topWordCount || 30)
    .map((candidate, index) => serializeCandidateMove(candidate, index));
};

export const commitCandidateForPosition = ({
  script,
  positionTurnIndex,
  candidateIndex,
} = {}) => {
  if (!script || !Array.isArray(script.turns)) {
    throw new Error("A board player script is required.");
  }
  if (!Number.isInteger(positionTurnIndex) || positionTurnIndex < 0) {
    throw new Error("positionTurnIndex must be >= 0.");
  }

  const entry = getTurnEntry(script, positionTurnIndex);
  if (!entry?.positionState) {
    throw new Error(`Position ${positionTurnIndex} not found.`);
  }

  const candidates = getCandidateMovesForPosition({
    script,
    positionTurnIndex,
  });
  if (
    !Number.isInteger(candidateIndex) ||
    candidateIndex < 0 ||
    candidateIndex >= candidates.length
  ) {
    throw new Error("candidateIndex is out of range for selected position.");
  }

  const selected = candidates[candidateIndex];
  const lexicon = getDefaultLexicon();
  const { nextState, payload } = applyMoveToState({
    state: cloneState(entry.positionState),
    move: selected.move,
    lexicon,
  });

  const preservedTurns = script.turns
    .filter((turn) => turn.turnIndex <= positionTurnIndex)
    .map((turn) => ({ ...turn }));

  const nextEntry = createPositionEntry({
    turnIndex: positionTurnIndex + 1,
    positionState: nextState,
    playedWord: selected.word,
    playedScore: payload.turnScore,
  });

  return {
    ...script,
    turns: [...preservedTurns, nextEntry],
    lastCommittedMove: {
      word: selected.word,
      score: payload.turnScore,
      turnIndex: positionTurnIndex + 1,
    },
  };
};

export const previewCandidateForPosition = ({
  script,
  positionTurnIndex,
  candidateIndex,
} = {}) => {
  const entry = getTurnEntry(script, positionTurnIndex);
  if (!entry?.positionState) {
    return null;
  }

  const candidates = getCandidateMovesForPosition({
    script,
    positionTurnIndex,
  });
  if (
    !Number.isInteger(candidateIndex) ||
    candidateIndex < 0 ||
    candidateIndex >= candidates.length
  ) {
    return null;
  }

  const selected = candidates[candidateIndex];
  const lexicon = getDefaultLexicon();
  const { nextState, payload } = applyMoveToState({
    state: cloneState(entry.positionState),
    move: selected.move,
    lexicon,
  });

  return {
    board: cloneBoard(nextState.board),
    selectedWord: selected.word,
    turnScore: payload.turnScore,
    totalScoreAfterMove: nextState.totalScore,
  };
};
