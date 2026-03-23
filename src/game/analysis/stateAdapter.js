import {
  createSeededRandom,
  initializeMiniTileBag,
  initializeTileBag,
  shuffleArray,
} from "../shared/bag";
import { getBoardLayout } from "./boardLayouts";

const createEmptyBoard = (boardSize) =>
  Array(boardSize)
    .fill(null)
    .map(() => Array(boardSize).fill(null));

const cloneBoard = (board) =>
  (Array.isArray(board) ? board : []).map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      cell == null ? null : { ...cell }
    )
  );

const cloneRack = (rack = []) => rack.map((tile, rackIndex) => ({ ...tile, rackIndex }));

const normalizeMode = (mode) => (mode === "mini" ? "mini" : "classic");

export const createInitialAnalysisState = ({
  seed,
  mode = "classic",
  layoutId = null,
} = {}) => {
  if (!seed) {
    throw new Error("seed is required to create an initial analysis state");
  }

  const normalizedMode = normalizeMode(mode);
  const layout = getBoardLayout({ mode: normalizedMode, layoutId });
  const random = createSeededRandom(String(seed));
  const rawBag =
    normalizedMode === "mini" ? initializeMiniTileBag(seed) : initializeTileBag();
  const tileBag = shuffleArray(rawBag, random.next);

  const initialRack = [];
  let nextTileId = 0;
  for (let index = 0; index < 7 && tileBag.length > 0; index += 1) {
    const tile = tileBag.pop();
    initialRack.push({ ...tile, id: nextTileId, rackIndex: index });
    nextTileId += 1;
  }

  return {
    source: "seed",
    seed: String(seed),
    mode: normalizedMode,
    boardSize: layout.boardSize,
    board: createEmptyBoard(layout.boardSize),
    tileRack: initialRack,
    tileBag,
    nextTileId,
    premiumSquares: { ...layout.premiumSquares },
    turnCount: 0,
    totalScore: 0,
    wordPointsTotal: 0,
    wordHistory: [],
    scrabbleBonusTotal: 0,
    swapPenaltyTotal: 0,
    isFirstTurn: true,
    gameOver: false,
    finalScore: null,
  };
};

const isSnapshotPayload = (payload) =>
  payload &&
  typeof payload === "object" &&
  Array.isArray(payload.board) &&
  Array.isArray(payload.tileRack) &&
  Array.isArray(payload.tileBag);

const isTurnLogPayload = (payload) =>
  payload &&
  typeof payload === "object" &&
  Array.isArray(payload.turns) &&
  payload.initialState;

export const createAnalysisStateFromSnapshot = (snapshot = {}) => {
  const mode = normalizeMode(snapshot.gameMode || snapshot.mode);
  const boardSize =
    typeof snapshot.boardSize === "number" && snapshot.boardSize > 0
      ? snapshot.boardSize
      : Array.isArray(snapshot.board)
        ? snapshot.board.length
        : mode === "mini"
          ? 11
          : 15;

  return {
    source: "snapshot",
    seed: String(snapshot.currentSeed || snapshot.seed || ""),
    mode,
    boardSize,
    board: cloneBoard(snapshot.board),
    tileRack: cloneRack(snapshot.tileRack),
    tileBag: Array.isArray(snapshot.tileBag) ? snapshot.tileBag.map((tile) => ({ ...tile })) : [],
    nextTileId: typeof snapshot.nextTileId === "number" ? snapshot.nextTileId : 0,
    premiumSquares:
      snapshot.premiumSquares && typeof snapshot.premiumSquares === "object"
        ? { ...snapshot.premiumSquares }
        : getBoardLayout({ mode }).premiumSquares,
    turnCount: snapshot.turnCount ?? 0,
    totalScore: snapshot.totalScore ?? 0,
    wordPointsTotal: snapshot.wordPointsTotal ?? 0,
    wordHistory: Array.isArray(snapshot.wordHistory) ? [...snapshot.wordHistory] : [],
    scrabbleBonusTotal: snapshot.scrabbleBonusTotal ?? 0,
    swapPenaltyTotal: snapshot.swapPenaltyTotal ?? 0,
    isFirstTurn: Boolean(snapshot.isFirstTurn),
    gameOver: Boolean(snapshot.gameOver),
    finalScore: snapshot.finalScore ?? null,
  };
};

export const normalizeAnalysisInput = (payload = {}) => {
  if (isTurnLogPayload(payload)) {
    const initialState = isSnapshotPayload(payload.initialState)
      ? createAnalysisStateFromSnapshot(payload.initialState)
      : createInitialAnalysisState(payload.initialState);

    return {
      kind: "turnLog",
      initialState,
      turns: payload.turns,
      metadata: payload.metadata ?? null,
    };
  }

  if (isSnapshotPayload(payload)) {
    return {
      kind: "snapshot",
      initialState: createAnalysisStateFromSnapshot(payload),
      turns: [],
      metadata: null,
    };
  }

  if (payload.seed) {
    return {
      kind: "seed",
      initialState: createInitialAnalysisState(payload),
      turns: [],
      metadata: payload.metadata ?? null,
    };
  }

  throw new Error("Unsupported analysis input payload");
};
