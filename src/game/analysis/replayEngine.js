import { BLANK_LETTER } from "../shared/bag";
import {
  buildResolvedSubmitPayload,
  buildBoardOccupancySnapshot,
} from "../shared/turnResolution";
import { validateSubmitTurn } from "../shared/validation";
import { buildFinalScoreBreakdown } from "../shared/scoring";
import { generateLegalMoves } from "./moveGenerator";
import { rankMoves } from "./moveEvaluator";
import { createInitialAnalysisState } from "./stateAdapter";

const cloneBoard = (board) => board.map((row) => row.map((cell) => (cell == null ? null : { ...cell })));

const makeDictionaryAdapter = (lexicon) => ({
  isValid: (word) => lexicon.isValid(String(word || "").toLowerCase()),
});

const normalizeLetter = (letter) => String(letter || "").trim().toUpperCase();

const applyPlacementsToBoard = ({ board, tileRack, placements = [] }) => {
  const nextBoard = cloneBoard(board);

  placements.forEach((placement) => {
    const rackTile = tileRack[placement.rackIndex];
    if (!rackTile) {
      throw new Error(`Invalid placement rackIndex ${placement.rackIndex}`);
    }

    const tileLetter = normalizeLetter(placement.letter || rackTile.letter);
    const isBlank =
      rackTile?.isBlank ||
      rackTile?.value === 0 ||
      normalizeLetter(rackTile?.letter) === normalizeLetter(BLANK_LETTER);

    nextBoard[placement.row][placement.col] = {
      letter: tileLetter,
      value: isBlank ? 0 : rackTile.value,
      isBlank,
      rackIndex: placement.rackIndex,
      isFromRack: true,
      scored: false,
    };
  });

  return nextBoard;
};

const applyResolvedPayload = ({ state, payload }) => {
  const resolvedBoard = payload.resolvedBoard.map((row) =>
    row.map((cell) => (cell == null ? null : { ...cell }))
  );

  const premiumHits = payload.placedCells
    .map(({ row, col }) => ({
      row,
      col,
      premium: state.premiumSquares?.[`${row},${col}`] || null,
    }))
    .filter((entry) => Boolean(entry.premium));

  return {
    ...state,
    board: resolvedBoard,
    tileRack: payload.resultingRack,
    tileBag: payload.nextBag,
    nextTileId: payload.nextTileId,
    premiumSquares: payload.newPremiumSquares,
    turnCount: state.turnCount + 1,
    totalScore: state.totalScore + payload.turnScore,
    wordPointsTotal: state.wordPointsTotal + payload.baseWordScore,
    wordHistory: [...state.wordHistory, ...payload.newHistory],
    scrabbleBonusTotal: state.scrabbleBonusTotal + payload.scrabbleBonus,
    isFirstTurn: false,
    gameOver: payload.nextTilesRemaining === 0 && payload.resultingRack.length === 0,
    boardAtTurnStart: payload.nextBoardAtTurnStart,
    drawHistory: [
      ...(state.drawHistory || []),
      {
        turn: state.turnCount + 1,
        drawnTiles: payload.drawnTiles,
        bagBeforeDraw: state.tileBag.map((tile) => ({ ...tile })),
        tilesRemainingAfterDraw: payload.nextTilesRemaining,
      },
    ],
    moveHistory: [
      ...(state.moveHistory || []),
      {
        turn: state.turnCount + 1,
        words: payload.newWords,
        placedCells: payload.placedCells,
        turnScore: payload.turnScore,
        baseWordScore: payload.baseWordScore,
        scrabbleBonus: payload.scrabbleBonus,
        premiumHits,
      },
    ],
  };
};

export const applyMoveToState = ({ state, move, lexicon }) => {
  const dictionary = makeDictionaryAdapter(lexicon);
  const boardAtTurnStart =
    state.boardAtTurnStart || buildBoardOccupancySnapshot(state.board);

  const boardWithPlacements = applyPlacementsToBoard({
    board: state.board,
    tileRack: state.tileRack,
    placements: move.placements,
  });

  const validation = validateSubmitTurn({
    board: boardWithPlacements,
    isFirstTurn: state.isFirstTurn,
    boardAtTurnStart,
    dictionary,
    boardSize: state.boardSize,
  });

  if (!validation.ok) {
    throw new Error(`Illegal move: ${validation.error?.title || "validation_failed"}`);
  }

  const payload = buildResolvedSubmitPayload({
    board: boardWithPlacements,
    tileRack: state.tileRack,
    tileBag: state.tileBag,
    nextTileId: state.nextTileId,
    premiumSquares: state.premiumSquares,
    turnCount: state.turnCount,
    placedCells: validation.placedCells,
    words: validation.words,
    newWords: validation.newWords,
    bonusMode: state.mode === "mini" ? "mini" : "classic",
  });

  return {
    nextState: applyResolvedPayload({ state, payload }),
    payload,
  };
};

export const finalizeReplayState = (state) => {
  if (!state.gameOver) {
    return state;
  }

  const finalScoreBreakdown = buildFinalScoreBreakdown({
    wordPointsTotal: state.wordPointsTotal,
    swapPenaltyTotal: state.swapPenaltyTotal,
    scrabbleBonusTotal: state.scrabbleBonusTotal,
    turnCount: state.turnCount,
    rackTiles: state.tileRack,
    wordHistory: state.wordHistory,
    invalidWordAttempts: state.invalidWordAttempts || 0,
  });

  return {
    ...state,
    finalScore: finalScoreBreakdown.finalScore,
    finalScoreBreakdown,
  };
};

export const solveSeedGreedy = ({
  seed,
  mode = "classic",
  layoutId = null,
  lexicon,
  maxTurns = 200,
  maxMovesPerTurn = 200,
  topCandidates = 5,
  epsilon = 0,
} = {}) => {
  const initialState = createInitialAnalysisState({ seed, mode, layoutId });
  initialState.boardAtTurnStart = buildBoardOccupancySnapshot(initialState.board);

  let state = initialState;
  const turns = [];

  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
    const candidates = rankMoves({
      moves: generateLegalMoves({
        state,
        lexicon,
        maxMoves: maxMovesPerTurn,
      }),
      state,
    });

    if (candidates.length === 0) {
      break;
    }

    const bestMove = candidates[0];
    const comparisonBand = candidates.filter(
      (candidate) => bestMove.evalScore - candidate.evalScore <= epsilon
    );

    const { nextState, payload } = applyMoveToState({
      state,
      move: bestMove,
      lexicon,
    });

    turns.push({
      turn: turnIndex + 1,
      chosenMove: {
        word: bestMove.word,
        direction: bestMove.direction,
        startRow: bestMove.startRow,
        startCol: bestMove.startCol,
        placements: bestMove.placements,
        evalScore: bestMove.evalScore,
        leaveHeuristic: bestMove.leaveHeuristic,
      },
      turnScore: payload.turnScore,
      topCandidates: candidates.slice(0, topCandidates).map((candidate) => ({
        word: candidate.word,
        direction: candidate.direction,
        startRow: candidate.startRow,
        startCol: candidate.startCol,
        turnScore: candidate.turnScore,
        evalScore: candidate.evalScore,
      })),
      noBetterPlayBand: comparisonBand.length,
      tilesRemaining: nextState.tileBag.length,
      boardAfterTurn: payload.resolvedBoard.map((row) =>
        row.map((cell) => (cell == null ? null : { ...cell }))
      ),
    });

    state = nextState;
    if (state.gameOver) {
      break;
    }
  }

  const finalized = finalizeReplayState(state);

  const turnScores = turns.map((turn) => turn.turnScore);
  const averageTurnScore =
    turnScores.length > 0
      ? turnScores.reduce((sum, value) => sum + value, 0) / turnScores.length
      : 0;

  return {
    seed: String(seed),
    mode,
    layoutId: layoutId || mode,
    initialBoard: initialState.board.map((row) =>
      row.map((cell) => (cell == null ? null : { ...cell }))
    ),
    summary: {
      turnsPlayed: finalized.turnCount,
      totalScore: finalized.totalScore,
      finalScore: finalized.finalScore,
      averageTurnScore: Number(averageTurnScore.toFixed(3)),
      scoreBand: {
        low: Math.floor(finalized.totalScore * 0.88),
        expected: finalized.totalScore,
        high: Math.ceil(finalized.totalScore * 1.12),
      },
    },
    bestLine: turns,
    finalState: finalized,
  };
};

export const solveSeedGreedyWithProgress = async ({
  seed,
  mode = "classic",
  layoutId = null,
  lexicon,
  maxTurns = 200,
  maxMovesPerTurn = 200,
  topCandidates = 5,
  epsilon = 0,
  onProgress = null,
  yieldMs = 0,
} = {}) => {
  const initialState = createInitialAnalysisState({ seed, mode, layoutId });
  initialState.boardAtTurnStart = buildBoardOccupancySnapshot(initialState.board);

  let state = initialState;
  const turns = [];
  const initialBagSize = Array.isArray(initialState.tileBag) ? initialState.tileBag.length : 0;

  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
    const candidates = rankMoves({
      moves: generateLegalMoves({
        state,
        lexicon,
        maxMoves: maxMovesPerTurn,
      }),
      state,
    });

    if (candidates.length === 0) {
      break;
    }

    const bestMove = candidates[0];
    const comparisonBand = candidates.filter(
      (candidate) => bestMove.evalScore - candidate.evalScore <= epsilon
    );

    const { nextState, payload } = applyMoveToState({
      state,
      move: bestMove,
      lexicon,
    });

    turns.push({
      turn: turnIndex + 1,
      chosenMove: {
        word: bestMove.word,
        direction: bestMove.direction,
        startRow: bestMove.startRow,
        startCol: bestMove.startCol,
        placements: bestMove.placements,
        evalScore: bestMove.evalScore,
        leaveHeuristic: bestMove.leaveHeuristic,
      },
      turnScore: payload.turnScore,
      topCandidates: candidates.slice(0, topCandidates).map((candidate) => ({
        word: candidate.word,
        direction: candidate.direction,
        startRow: candidate.startRow,
        startCol: candidate.startCol,
        turnScore: candidate.turnScore,
        evalScore: candidate.evalScore,
      })),
      noBetterPlayBand: comparisonBand.length,
      tilesRemaining: nextState.tileBag.length,
      boardAfterTurn: payload.resolvedBoard.map((row) =>
        row.map((cell) => (cell == null ? null : { ...cell }))
      ),
    });

    state = nextState;

    if (typeof onProgress === "function") {
      onProgress({
        turn: turnIndex + 1,
        tilesRemaining: nextState.tileBag.length,
        initialBagSize,
        turnsPlayed: turns.length,
      });
    }

    if (yieldMs >= 0) {
      await new Promise((resolve) => setTimeout(resolve, yieldMs));
    }

    if (state.gameOver) {
      break;
    }
  }

  const finalized = finalizeReplayState(state);
  const turnScores = turns.map((turn) => turn.turnScore);
  const averageTurnScore =
    turnScores.length > 0
      ? turnScores.reduce((sum, value) => sum + value, 0) / turnScores.length
      : 0;

  return {
    seed: String(seed),
    mode,
    layoutId: layoutId || mode,
    initialBoard: initialState.board.map((row) =>
      row.map((cell) => (cell == null ? null : { ...cell }))
    ),
    summary: {
      turnsPlayed: finalized.turnCount,
      totalScore: finalized.totalScore,
      finalScore: finalized.finalScore,
      averageTurnScore: Number(averageTurnScore.toFixed(3)),
      scoreBand: {
        low: Math.floor(finalized.totalScore * 0.88),
        expected: finalized.totalScore,
        high: Math.ceil(finalized.totalScore * 1.12),
      },
    },
    bestLine: turns,
    finalState: finalized,
  };
};

export const replayTurnLog = ({ initialState, turns = [], lexicon }) => {
  let state = {
    ...initialState,
    board: cloneBoard(initialState.board),
    tileRack: initialState.tileRack.map((tile) => ({ ...tile })),
    tileBag: initialState.tileBag.map((tile) => ({ ...tile })),
    premiumSquares: { ...(initialState.premiumSquares || {}) },
    boardAtTurnStart:
      initialState.boardAtTurnStart || buildBoardOccupancySnapshot(initialState.board),
  };
  const appliedTurns = [];

  turns.forEach((turnEntry, index) => {
    if (turnEntry?.action === "play") {
      const { nextState, payload } = applyMoveToState({
        state,
        move: turnEntry.move,
        lexicon,
      });
      state = nextState;
      appliedTurns.push({ turn: index + 1, action: "play", payload });
    }
  });

  return {
    finalState: finalizeReplayState(state),
    appliedTurns,
  };
};
