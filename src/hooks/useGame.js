import { useState, useCallback, useRef, useEffect } from "react";
import { unstable_batchedUpdates } from "react-native";
import { dictionary } from "../utils/dictionary";
import {
  BLANK_LETTER,
  createSeededRandom,
  initializeMiniTileBag,
  initializeTileBag,
  shuffleArray,
} from "../game/shared/bag";
import {
  BOARD_SIZE as CLASSIC_BOARD_SIZE,
  MINI_BOARD_SIZE,
  createClassicPremiumSquares,
  createMiniPremiumSquares,
} from "../game/shared/premiumSquares";
import {
  buildFinalScoreBreakdown,
  scoreSubmittedWords,
  TIME_BONUS_PROFILE_CLASSIC,
  TIME_BONUS_PROFILE_MINI,
} from "../game/shared/scoring";
import { buildResolvedSubmitPayload } from "../game/shared/turnResolution";
import { validateSubmitTurn } from "../game/shared/validation";

const CONSISTENCY_THRESHOLD = 20;
const CONSISTENCY_BONUS_STEP = 2;
const PREVIEW_COMPUTE_DELAY_MS = 90;
const PREVIEW_DICTIONARY = {
  isValid: () => true,
};

const GAME_MODE_CLASSIC = "classic";
const GAME_MODE_MINI = "mini";
const DEFAULT_CLASSIC_BOARD_VARIANT_ID = "classic-default";
const DEFAULT_MINI_BOARD_VARIANT_ID = "mini-default";

const normalizeGameMode = (mode) =>
  mode === GAME_MODE_MINI ? GAME_MODE_MINI : GAME_MODE_CLASSIC;

const sanitizeBoardVariant = (value, fallbackMode = GAME_MODE_CLASSIC) => {
  if (!value || typeof value !== "object") {
    const mode = normalizeGameMode(fallbackMode);
    return {
      id:
        mode === GAME_MODE_MINI
          ? DEFAULT_MINI_BOARD_VARIANT_ID
          : DEFAULT_CLASSIC_BOARD_VARIANT_ID,
      mode,
      boardSize: mode === GAME_MODE_MINI ? MINI_BOARD_SIZE : CLASSIC_BOARD_SIZE,
    };
  }

  const mode = normalizeGameMode(value.mode ?? fallbackMode);
  const boardSize =
    typeof value.boardSize === "number" && value.boardSize > 0
      ? value.boardSize
      : mode === GAME_MODE_MINI
        ? MINI_BOARD_SIZE
        : CLASSIC_BOARD_SIZE;

  return {
    id:
      typeof value.id === "string" && value.id.trim().length > 0
        ? value.id.trim()
        : mode === GAME_MODE_MINI
          ? DEFAULT_MINI_BOARD_VARIANT_ID
          : DEFAULT_CLASSIC_BOARD_VARIANT_ID,
    mode,
    boardSize,
    layoutName:
      typeof value.layoutName === "string" && value.layoutName.trim().length > 0
        ? value.layoutName.trim()
        : null,
  };
};

const createEmptyBoard = (boardSize) =>
  Array(boardSize)
    .fill(null)
    .map(() => Array(boardSize).fill(null));

export const useGame = () => {
  const [board, setBoard] = useState(() => createEmptyBoard(CLASSIC_BOARD_SIZE));
  const [tileRack, setTileRack] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [wordPointsTotal, setWordPointsTotal] = useState(0);
  const [swapPenaltyTotal, setSwapPenaltyTotal] = useState(0);
  const [scrabbleBonusTotal, setScrabbleBonusTotal] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [tilesRemaining, setTilesRemaining] = useState(100);
  const [wordHistory, setWordHistory] = useState([]);
  const [isFirstTurn, setIsFirstTurn] = useState(true);
  const [currentSeed, setCurrentSeed] = useState(null);
  const [message, setMessage] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [finalScoreBreakdown, setFinalScoreBreakdown] = useState(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapCount, setSwapCount] = useState(0);
  const [submitScorePreview, setSubmitScorePreview] = useState(null);

  const randomRef = useRef(null);
  const tileBagRef = useRef([]);
  const nextTileIdRef = useRef(0);
  const pendingSwapRef = useRef(null);
  const pendingSubmitRef = useRef(null);
  const tilesUsedThisTurnRef = useRef(new Set());
  const boardAtTurnStartRef = useRef(null);
  const premiumSquaresRef = useRef(createClassicPremiumSquares());
  const boardSizeRef = useRef(CLASSIC_BOARD_SIZE);
  const gameModeRef = useRef(GAME_MODE_CLASSIC);
  const boardVariantRef = useRef(
    sanitizeBoardVariant({
      id: DEFAULT_CLASSIC_BOARD_VARIANT_ID,
      mode: GAME_MODE_CLASSIC,
      boardSize: CLASSIC_BOARD_SIZE,
      layoutName: "Classic",
    })
  );
  const timeBonusProfileRef = useRef(TIME_BONUS_PROFILE_CLASSIC);
  const gameStartedAtMsRef = useRef(null);
  const invalidWordAttemptsRef = useRef(0);
  const currentConsistencyStreakRef = useRef(0);
  const consistencyBonusTotalRef = useRef(0);

  const drawTiles = useCallback((count) => {
    setTileRack((prev) => {
      const newRack = [...prev];
      for (let i = 0; i < count && tileBagRef.current.length > 0; i++) {
        const tile = tileBagRef.current.pop();
        newRack.push({ ...tile, id: nextTileIdRef.current++ });
        setTilesRemaining((prevRemaining) => prevRemaining - 1);
      }
      return newRack;
    });
  }, []);

  const ensureRackHasSevenTiles = useCallback(() => {
    setTileRack((prev) => {
      const needed = 7 - prev.length;
      if (needed > 0 && tileBagRef.current.length > 0) {
        const newRack = [...prev];
        for (let i = 0; i < needed && tileBagRef.current.length > 0; i++) {
          const tile = tileBagRef.current.pop();
          newRack.push({ ...tile, id: nextTileIdRef.current++ });
          setTilesRemaining((prevRemaining) => prevRemaining - 1);
        }
        return newRack;
      }
      return prev;
    });
  }, []);

  const startNewGame = useCallback(
    (seed = null, options = {}) => {
      const mode = normalizeGameMode(options.mode);
      const inputVariant = sanitizeBoardVariant(options.boardVariant, mode);
      const resolvedBoardSize = inputVariant.boardSize;
      const resolvedPremiumSquares =
        options.boardVariant?.premiumSquares &&
        typeof options.boardVariant.premiumSquares === "object"
          ? options.boardVariant.premiumSquares
          : mode === GAME_MODE_MINI
            ? createMiniPremiumSquares()
            : createClassicPremiumSquares();

      gameModeRef.current = mode;
      boardSizeRef.current = resolvedBoardSize;
      premiumSquaresRef.current = resolvedPremiumSquares;
      boardVariantRef.current = {
        ...inputVariant,
        mode,
        boardSize: resolvedBoardSize,
      };
      timeBonusProfileRef.current =
        mode === GAME_MODE_MINI
          ? TIME_BONUS_PROFILE_MINI
          : TIME_BONUS_PROFILE_CLASSIC;

      const gameSeed = seed || Math.floor(Math.random() * 1000000).toString();
      randomRef.current = createSeededRandom(gameSeed);
      nextTileIdRef.current = 0;
      setCurrentSeed(gameSeed);
      setTotalScore(0);
      setWordPointsTotal(0);
      setSwapPenaltyTotal(0);
      setScrabbleBonusTotal(0);
      setWordCount(0);
      setTurnCount(0);
      setWordHistory([]);
      setSelectedTiles([]);
      setSelectedCells([]);
      setIsFirstTurn(true);
      setGameOver(false);
      setFinalScore(null);
      setFinalScoreBreakdown(null);
      setIsSwapMode(false);
      setSwapCount(0);
      pendingSwapRef.current = null;
      pendingSubmitRef.current = null;
      tilesUsedThisTurnRef.current = new Set();
      boardAtTurnStartRef.current = null;
      gameStartedAtMsRef.current = null;
      invalidWordAttemptsRef.current = 0;
      currentConsistencyStreakRef.current = 0;
      consistencyBonusTotalRef.current = 0;

      // Clear board
      setBoard(createEmptyBoard(boardSizeRef.current));

      // Initialize and shuffle tile bag
      tileBagRef.current = shuffleArray(
        mode === GAME_MODE_MINI
          ? initializeMiniTileBag(gameSeed)
          : initializeTileBag(),
        randomRef.current.next
      );
      const totalTilesInBag = tileBagRef.current.length;
      setTilesRemaining(totalTilesInBag);

      // Draw initial 7 tiles (or fewer if bag has fewer)
      const initialRack = [];
      let tilesDrawn = 0;
      for (let i = 0; i < 7 && tileBagRef.current.length > 0; i++) {
        const tile = tileBagRef.current.pop();
        initialRack.push({ ...tile, id: nextTileIdRef.current++ });
        tilesDrawn++;
      }
      setTileRack(initialRack);
      setTilesRemaining(totalTilesInBag - tilesDrawn);
    },
    []
  );

  const resetGame = useCallback(() => {
    let resolvedSeed = currentSeed;
    if (!currentSeed) {
      const gameSeed = Math.floor(Math.random() * 1000000).toString();
      randomRef.current = createSeededRandom(gameSeed);
      setCurrentSeed(gameSeed);
      resolvedSeed = gameSeed;
    } else {
      randomRef.current = createSeededRandom(currentSeed);
    }
    nextTileIdRef.current = 0;

    setTotalScore(0);
    setWordPointsTotal(0);
    setSwapPenaltyTotal(0);
    setScrabbleBonusTotal(0);
    setWordCount(0);
    setTurnCount(0);
    setWordHistory([]);
    setSelectedTiles([]);
    setSelectedCells([]);
    setIsFirstTurn(true);
    setGameOver(false);
    setFinalScore(null);
    setFinalScoreBreakdown(null);
    setIsSwapMode(false);
    setSwapCount(0);
    pendingSwapRef.current = null;
    pendingSubmitRef.current = null;
    tilesUsedThisTurnRef.current = new Set();
    boardAtTurnStartRef.current = null;
    gameStartedAtMsRef.current = null;
    invalidWordAttemptsRef.current = 0;
    currentConsistencyStreakRef.current = 0;
    consistencyBonusTotalRef.current = 0;

    setBoard(createEmptyBoard(boardSizeRef.current));

    tileBagRef.current = shuffleArray(
      gameModeRef.current === GAME_MODE_MINI
        ? initializeMiniTileBag(resolvedSeed)
        : initializeTileBag(),
      randomRef.current.next
    );
    const totalTilesInBag = tileBagRef.current.length;
    setTilesRemaining(totalTilesInBag);

    const initialRack = [];
    let tilesDrawn = 0;
    for (let i = 0; i < 7 && tileBagRef.current.length > 0; i++) {
      const tile = tileBagRef.current.pop();
      initialRack.push({ ...tile, id: nextTileIdRef.current++ });
      tilesDrawn++;
    }
    setTileRack(initialRack);
    setTilesRemaining(totalTilesInBag - tilesDrawn);
  }, [currentSeed]);

  const selectTile = useCallback(
    (index) => {
      setSelectedTiles((prev) => {
        if (prev.includes(index)) return prev.filter((i) => i !== index);
        if (isSwapMode) {
          const maxSwap = Math.min(7, tilesRemaining);
          if (prev.length >= maxSwap) return prev;
        }
        return [...prev, index];
      });
    },
    [isSwapMode, tilesRemaining]
  );

  const placeTileOnBoard = useCallback(
    (tileIndex, row, col, chosenLetter = null) => {
      if (tileIndex === null || tileIndex < 0 || tileIndex >= tileRack.length)
        return;
      if (board[row][col] !== null) return;
      if (tilesUsedThisTurnRef.current.has(tileIndex)) {
        setMessage({
          title: "Tile Already Used",
          text: "This tile has already been placed this turn.",
        });
        return;
      }

      const tile = tileRack[tileIndex];
      const isBlank =
        tile.value === 0 &&
        (tile.letter === BLANK_LETTER || tile.letter === "");
      if (gameStartedAtMsRef.current == null) {
        gameStartedAtMsRef.current = Date.now();
      }
      if (isBlank) {
        if (
          !chosenLetter ||
          typeof chosenLetter !== "string" ||
          chosenLetter.length !== 1
        )
          return;
        const letter = chosenLetter.toUpperCase();
        if (letter < "A" || letter > "Z") return;
        tilesUsedThisTurnRef.current.add(tileIndex);
        setBoard((prev) => {
          const newBoard = prev.map((r) => [...r]);
          newBoard[row][col] = {
            letter,
            value: 0,
            isBlank: true,
            rackIndex: tileIndex,
            isFromRack: true,
          };
          return newBoard;
        });
      } else {
        tilesUsedThisTurnRef.current.add(tileIndex);
        setBoard((prev) => {
          const newBoard = prev.map((r) => [...r]);
          newBoard[row][col] = {
            ...tile,
            rackIndex: tileIndex,
            isFromRack: true,
          };
          return newBoard;
        });
      }

      setSelectedCells((prev) => [...prev, { row, col }]);
    },
    [board, tileRack]
  );

  const isBlankRackTile = useCallback((tile) => {
    return (
      tile &&
      tile.value === 0 &&
      (tile.letter === BLANK_LETTER || tile.letter === "")
    );
  }, []);

  const handleCellClick = useCallback(
    (row, col) => {
      if (board[row][col] !== null) {
        // Don't allow selecting already-scored tiles (they can't be moved/cleared)
        if (board[row][col].scored) return;
        // Toggle selection of occupied cell (for submit/clear)
        setSelectedCells((prev) => {
          const index = prev.findIndex((c) => c.row === row && c.col === col);
          if (index >= 0) {
            return prev.filter((_, i) => i !== index);
          } else {
            return [...prev, { row, col }];
          }
        });
      }
      // Placement is done via drag-and-drop from the rack only
    },
    [board]
  );

  const removeTileFromBoard = useCallback((row, col) => {
    setBoard((prev) => {
      const newBoard = prev.map((r) => [...r]);
      const tile = newBoard[row][col];
      if (tile?.scored) return prev; // can't remove already-scored tiles
      if (tile && tile.isFromRack && tile.rackIndex !== undefined) {
        tilesUsedThisTurnRef.current.delete(tile.rackIndex);
      }
      newBoard[row][col] = null;
      return newBoard;
    });

    setSelectedCells((prev) =>
      prev.filter((c) => !(c.row === row && c.col === col))
    );
  }, []);

  const moveTileOnBoard = useCallback((fromRow, fromCol, toRow, toCol) => {
    if (fromRow === toRow && fromCol === toCol) return;
    unstable_batchedUpdates(() => {
      setBoard((prev) => {
        const sourceRow = prev[fromRow];
        const targetRow = prev[toRow];
        const tile = sourceRow?.[fromCol];
        if (
          !tile ||
          !tile.isFromRack ||
          tile.scored ||
          targetRow?.[toCol] !== null
        ) {
          return prev;
        }

        const next = [...prev];
        if (fromRow === toRow) {
          const row = [...sourceRow];
          row[fromCol] = null;
          row[toCol] = tile;
          next[fromRow] = row;
          return next;
        }

        const nextSourceRow = [...sourceRow];
        const nextTargetRow = [...targetRow];
        nextSourceRow[fromCol] = null;
        nextTargetRow[toCol] = tile;
        next[fromRow] = nextSourceRow;
        next[toRow] = nextTargetRow;
        return next;
      });
      setSelectedCells((prev) => {
        const without = prev.filter(
          (c) => !(c.row === fromRow && c.col === fromCol)
        );
        return [...without, { row: toRow, col: toCol }];
      });
    });
  }, []);

  const clearSelection = useCallback(() => {
    selectedCells.forEach(({ row, col }) => {
      removeTileFromBoard(row, col);
    });
    setSelectedTiles([]);
    setSelectedCells([]);
  }, [selectedCells, removeTileFromBoard]);

  const shuffleRack = useCallback(() => {
    if (randomRef.current) {
      setTileRack((prev) => shuffleArray(prev, randomRef.current.next));
    }
  }, []);

  const reorderRack = useCallback(
    (fromIndex, toIndex, releasedIndex = null) => {
      setTileRack((prev) => {
        const usedIndices = new Set();
        for (let row = 0; row < boardSizeRef.current; row++) {
          for (let col = 0; col < boardSizeRef.current; col++) {
            const tile = board[row][col];
            if (
              tile?.isFromRack &&
              !tile.scored &&
              tile.rackIndex !== undefined
            ) {
              usedIndices.add(tile.rackIndex);
            }
          }
        }
        if (releasedIndex != null) {
          usedIndices.delete(releasedIndex);
        }

        const visibleIndices = prev
          .map((_, index) => index)
          .filter((index) => !usedIndices.has(index));
        const fromVisibleIndex = visibleIndices.indexOf(fromIndex);
        const clampedToIndex = Math.max(
          0,
          Math.min(toIndex, visibleIndices.length - 1)
        );
        if (fromVisibleIndex === -1 || fromVisibleIndex === clampedToIndex)
          return prev;

        const reorderedVisibleTiles = visibleIndices.map(
          (index) => prev[index]
        );
        const [removed] = reorderedVisibleTiles.splice(fromVisibleIndex, 1);
        reorderedVisibleTiles.splice(clampedToIndex, 0, removed);

        const next = [...prev];
        visibleIndices.forEach((index, visibleIndex) => {
          next[index] = reorderedVisibleTiles[visibleIndex];
        });
        return next;
      });
    },
    [board]
  );

  const prepareSwapTiles = useCallback(() => {
    if (!isSwapMode) return null;

    const bagLen = tileBagRef.current.length;
    if (selectedTiles.length === 0) {
      setIsSwapMode(false);
      pendingSwapRef.current = null;
      return null;
    }
    if (bagLen === 0) {
      setMessage({ title: "Swap Tiles", text: "The bag is empty." });
      pendingSwapRef.current = null;
      return null;
    }

    const swapTileCount = Math.min(selectedTiles.length, bagLen);
    const indicesToRemove = [...selectedTiles]
      .sort((a, b) => a - b)
      .slice(0, swapTileCount);
    const removedTiles = indicesToRemove
      .map((rackIndex) => tileRack[rackIndex])
      .filter(Boolean)
      .map((tile, idx) => ({ ...tile, rackIndex: indicesToRemove[idx] }));
    const returnedTiles = removedTiles.map((tile) => ({
      letter: tile.letter,
      value: tile.value,
    }));
    const nextBag = shuffleArray(
      [...tileBagRef.current, ...returnedTiles],
      randomRef.current.next
    );
    const drawnTiles = [];
    let nextTileId = nextTileIdRef.current;

    for (let i = 0; i < swapTileCount; i++) {
      const tile = nextBag.pop();
      if (!tile) break;
      drawnTiles.push({ ...tile, id: nextTileId++ });
    }

    const remainingRack = tileRack.filter(
      (_, index) => !indicesToRemove.includes(index)
    );
    const multiplier = swapCount + 1;
    const baseScorePenalty = removedTiles.reduce(
      (sum, tile) => sum + (tile?.value ?? 0),
      0
    );
    const scorePenalty = baseScorePenalty * multiplier;
    const payload = {
      indicesToRemove,
      removedTiles,
      remainingRack,
      drawnTiles,
      resultingRack: [...remainingRack, ...drawnTiles],
      nextBag,
      nextTileId,
      nextTilesRemaining: nextBag.length,
      multiplier,
      baseScorePenalty,
      scorePenalty,
    };

    pendingSwapRef.current = payload;
    return payload;
  }, [isSwapMode, selectedTiles, swapCount, tileRack]);

  const commitPreparedSwap = useCallback((preparedSwap = null) => {
    const payload = preparedSwap ?? pendingSwapRef.current;
    if (!payload) return false;

    tileBagRef.current = payload.nextBag;
    nextTileIdRef.current = payload.nextTileId;
    pendingSwapRef.current = null;

    setTileRack(payload.resultingRack);
    setTilesRemaining(payload.nextTilesRemaining);
    setTotalScore((prev) => prev - payload.scorePenalty);
    setSwapPenaltyTotal((prev) => prev + payload.scorePenalty);
    setSwapCount((prev) => prev + 1);
    setTurnCount((prev) => prev + 1);
    currentConsistencyStreakRef.current = 0;
    setIsSwapMode(false);
    setSelectedTiles([]);
    return true;
  }, []);

  const swapTiles = useCallback(() => {
    if (isSwapMode) {
      const payload = prepareSwapTiles();
      if (payload) commitPreparedSwap(payload);
      return;
    }
    // Enter swap mode: clear board placement and allow selecting rack tiles
    clearSelection();
    setIsSwapMode(true);
  }, [clearSelection, commitPreparedSwap, isSwapMode, prepareSwapTiles]);

  const prepareSubmitWord = useCallback(() => {
    if (gameOver) return null;
    const validation = validateSubmitTurn({
      board,
      isFirstTurn,
      boardAtTurnStart: boardAtTurnStartRef.current,
      dictionary,
      boardSize: boardSizeRef.current,
    });
    if (!validation.ok) {
      if (validation?.error?.title === "Invalid Word") {
        invalidWordAttemptsRef.current += 1;
      }
      setMessage(validation.error);
      return null;
    }

    const { placedCells, words, newWords } = validation;
    const payload = buildResolvedSubmitPayload({
      board,
      tileRack,
      tileBag: tileBagRef.current,
      nextTileId: nextTileIdRef.current,
      premiumSquares: premiumSquaresRef.current,
      turnCount,
      placedCells,
      words,
      newWords,
      bonusMode: gameModeRef.current === GAME_MODE_MINI ? "mini" : "classic",
    });

    pendingSubmitRef.current = payload;
    return payload;
  }, [
    gameOver,
    isFirstTurn,
    board,
    tileRack,
    turnCount,
  ]);

  const commitPreparedSubmitWord = useCallback((preparedSubmit = null) => {
    const payload = preparedSubmit ?? pendingSubmitRef.current;
    if (!payload) return false;
    const completesGame =
      payload.nextTilesRemaining === 0 && payload.resultingRack.length === 0;
    let perTurnConsistencyBonus = 0;

    pendingSubmitRef.current = payload;
    setTotalScore((prev) => prev + payload.turnScore);
    setWordPointsTotal((prev) => prev + payload.baseWordScore);
    if (payload.scrabbleBonus > 0) {
      setScrabbleBonusTotal((prev) => prev + payload.scrabbleBonus);
    }
    setWordCount((prev) => prev + payload.newWords.length);
    setTurnCount((prev) => prev + 1);
    if (payload.turnScore >= CONSISTENCY_THRESHOLD) {
      currentConsistencyStreakRef.current += 1;
      if (currentConsistencyStreakRef.current >= 3) {
        perTurnConsistencyBonus =
          CONSISTENCY_BONUS_STEP * (currentConsistencyStreakRef.current - 2);
        consistencyBonusTotalRef.current += perTurnConsistencyBonus;
      }
    } else {
      currentConsistencyStreakRef.current = 0;
    }
    setIsFirstTurn(false);
    setWordHistory((prev) => [...prev, ...payload.newHistory]);
    setTileRack(payload.remainingRack);
    tilesUsedThisTurnRef.current.clear();
    setSelectedCells([]);
    setSelectedTiles([]);

    setBoard((prev) => {
      const next = prev.map((r) => [...r]);
      payload.placedCells.forEach(({ row, col }) => {
        const t = next[row][col];
        if (t) next[row][col] = { ...t, scored: true };
      });
      return next;
    });

    boardAtTurnStartRef.current = payload.nextBoardAtTurnStart;
    premiumSquaresRef.current = payload.newPremiumSquares;
    if (!completesGame) {
      const scrabbleBonusMessage =
        payload.earnedScrabbleBonus && payload.scrabbleBonus > 0
          ? payload.scrabbleBonusType === "lite"
            ? `Scrabble Lite bonus +${payload.scrabbleBonus}`
            : `Scrabble bonus +${payload.scrabbleBonus}`
          : null;
      setMessage({
        title: "Word Accepted!",
        text: `Words: ${payload.newWords
          .map((w) => w.word.toUpperCase())
          .join(", ")}`,
        turnPoints: payload.turnScore,
        consistencyBonus: perTurnConsistencyBonus,
        scrabbleBonusMessage,
      });
    }
    return true;
  }, []);

  const finalizePreparedSubmitRack = useCallback((preparedSubmit = null) => {
    const payload = preparedSubmit ?? pendingSubmitRef.current;
    if (!payload) return false;

    tileBagRef.current = payload.nextBag;
    nextTileIdRef.current = payload.nextTileId;
    pendingSubmitRef.current = null;
    setTileRack(payload.resultingRack);
    setTilesRemaining(payload.nextTilesRemaining);
    return true;
  }, []);

  const submitWord = useCallback(() => {
    const payload = prepareSubmitWord();
    if (!payload) return;
    commitPreparedSubmitWord(payload);
    finalizePreparedSubmitRack(payload);
  }, [commitPreparedSubmitWord, finalizePreparedSubmitRack, prepareSubmitWord]);

  const finishGame = useCallback(() => {
    if (gameOver || tilesRemaining > 0) return; // Only when bag is empty and game not already over
    const durationMs =
      gameStartedAtMsRef.current == null
        ? null
        : Math.max(0, Date.now() - gameStartedAtMsRef.current);
    const breakdown = buildFinalScoreBreakdown({
      wordPointsTotal,
      swapPenaltyTotal,
      scrabbleBonusTotal,
      turnCount,
      rackTiles: tileRack,
      durationMs,
      invalidWordAttempts: invalidWordAttemptsRef.current,
      wordHistory,
      comboBonusTotal: consistencyBonusTotalRef.current,
      timeBonusProfile: timeBonusProfileRef.current,
    });
    setFinalScoreBreakdown(breakdown);
    setFinalScore(breakdown.finalScore);
    setGameOver(true);
  }, [
    gameOver,
    scrabbleBonusTotal,
    swapPenaltyTotal,
    tileRack,
    tilesRemaining,
    turnCount,
    wordHistory,
    wordPointsTotal,
  ]);

  useEffect(() => {
    if (
      gameOver ||
      tilesRemaining !== 0 ||
      tileRack.length !== 0 ||
      selectedCells.length > 0
    ) {
      return;
    }

    finishGame();
  }, [
    finishGame,
    gameOver,
    selectedCells.length,
    tileRack.length,
    tilesRemaining,
  ]);

  useEffect(() => {
    if (gameOver || isSwapMode) {
      setSubmitScorePreview(null);
      return;
    }

    if (selectedCells.length === 0) {
      setSubmitScorePreview(null);
      return;
    }

    // Hide stale preview immediately while recalculating for the latest board state.
    setSubmitScorePreview(null);

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;

      const validation = validateSubmitTurn({
        board,
        isFirstTurn,
        boardAtTurnStart: boardAtTurnStartRef.current,
        dictionary: PREVIEW_DICTIONARY,
        boardSize: boardSizeRef.current,
      });

      if (!validation.ok) {
        setSubmitScorePreview(null);
        return;
      }

      const previewScoring = scoreSubmittedWords({
        board,
        newWords: validation.newWords,
        premiumSquares: premiumSquaresRef.current,
        turnCount,
        placedCells: validation.placedCells,
      });

      setSubmitScorePreview(previewScoring.turnScore);
    }, PREVIEW_COMPUTE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [board, gameOver, isFirstTurn, isSwapMode, selectedCells.length, turnCount]);

  const getStableSnapshot = useCallback(() => {
    if (!currentSeed) {
      return null;
    }

    if (isSwapMode || selectedCells.length > 0 || selectedTiles.length > 0) {
      return null;
    }

    const hasPendingBoardPlacements = board.some((row) =>
      row.some((tile) => tile?.isFromRack && !tile?.scored)
    );
    if (hasPendingBoardPlacements) {
      return null;
    }

    return {
      board,
      tileRack,
      selectedTiles: [],
      selectedCells: [],
      totalScore,
      wordPointsTotal,
      swapPenaltyTotal,
      scrabbleBonusTotal,
      wordCount,
      turnCount,
      tilesRemaining,
      wordHistory,
      isFirstTurn,
      currentSeed,
      gameOver,
      finalScore,
      finalScoreBreakdown,
      isSwapMode: false,
      swapCount,
      premiumSquares: premiumSquaresRef.current,
      boardSize: boardSizeRef.current,
      gameMode: gameModeRef.current,
      boardVariant: boardVariantRef.current,
      timeBonusProfile: timeBonusProfileRef.current,
      tileBag: tileBagRef.current,
      nextTileId: nextTileIdRef.current,
      boardAtTurnStart: boardAtTurnStartRef.current,
      randomState: randomRef.current?.getState?.() ?? null,
      gameStartedAtMs: gameStartedAtMsRef.current,
      invalidWordAttempts: invalidWordAttemptsRef.current,
      currentConsistencyStreak: currentConsistencyStreakRef.current,
      consistencyBonusTotal: consistencyBonusTotalRef.current,
    };
  }, [
    board,
    currentSeed,
    finalScore,
    finalScoreBreakdown,
    gameOver,
    isFirstTurn,
    isSwapMode,
    scrabbleBonusTotal,
    selectedCells.length,
    selectedTiles.length,
    swapCount,
    swapPenaltyTotal,
    tileRack,
    tilesRemaining,
    totalScore,
    turnCount,
    wordCount,
    wordHistory,
    wordPointsTotal,
  ]);

  const resumeSavedGame = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object" || !snapshot.currentSeed) {
      return false;
    }

    randomRef.current = createSeededRandom(
      snapshot.currentSeed,
      snapshot.randomState
    );
    tileBagRef.current = Array.isArray(snapshot.tileBag)
      ? snapshot.tileBag
      : [];
    nextTileIdRef.current =
      typeof snapshot.nextTileId === "number" ? snapshot.nextTileId : 0;
    pendingSwapRef.current = null;
    pendingSubmitRef.current = null;
    tilesUsedThisTurnRef.current = new Set();
    boardAtTurnStartRef.current = Array.isArray(snapshot.boardAtTurnStart)
      ? snapshot.boardAtTurnStart
      : null;
    boardSizeRef.current =
      typeof snapshot.boardSize === "number" && snapshot.boardSize > 0
        ? snapshot.boardSize
        : Array.isArray(snapshot.board)
          ? snapshot.board.length
          : CLASSIC_BOARD_SIZE;
    gameModeRef.current =
      snapshot.gameMode === GAME_MODE_MINI ? GAME_MODE_MINI : GAME_MODE_CLASSIC;
    boardVariantRef.current = sanitizeBoardVariant(
      snapshot.boardVariant,
      gameModeRef.current
    );
    boardVariantRef.current.boardSize = boardSizeRef.current;
    boardVariantRef.current.mode = gameModeRef.current;
    timeBonusProfileRef.current =
      snapshot.timeBonusProfile === TIME_BONUS_PROFILE_MINI
        ? TIME_BONUS_PROFILE_MINI
        : TIME_BONUS_PROFILE_CLASSIC;
    premiumSquaresRef.current =
      snapshot.premiumSquares && typeof snapshot.premiumSquares === "object"
        ? snapshot.premiumSquares
        : gameModeRef.current === GAME_MODE_MINI
          ? createMiniPremiumSquares()
          : createClassicPremiumSquares();
    gameStartedAtMsRef.current =
      typeof snapshot.gameStartedAtMs === "number"
        ? snapshot.gameStartedAtMs
        : null;
    invalidWordAttemptsRef.current =
      typeof snapshot.invalidWordAttempts === "number"
        ? snapshot.invalidWordAttempts
        : 0;
    currentConsistencyStreakRef.current =
      typeof snapshot.currentConsistencyStreak === "number"
        ? snapshot.currentConsistencyStreak
        : 0;
    consistencyBonusTotalRef.current =
      typeof snapshot.consistencyBonusTotal === "number"
        ? snapshot.consistencyBonusTotal
        : 0;

    setBoard(snapshot.board);
    setTileRack(snapshot.tileRack ?? []);
    setSelectedTiles([]);
    setSelectedCells([]);
    setTotalScore(snapshot.totalScore ?? 0);
    setWordPointsTotal(snapshot.wordPointsTotal ?? 0);
    setSwapPenaltyTotal(snapshot.swapPenaltyTotal ?? 0);
    setScrabbleBonusTotal(snapshot.scrabbleBonusTotal ?? 0);
    setWordCount(snapshot.wordCount ?? 0);
    setTurnCount(snapshot.turnCount ?? 0);
    setTilesRemaining(snapshot.tilesRemaining ?? tileBagRef.current.length);
    setWordHistory(snapshot.wordHistory ?? []);
    setIsFirstTurn(Boolean(snapshot.isFirstTurn));
    setCurrentSeed(snapshot.currentSeed);
    setMessage(null);
    setGameOver(Boolean(snapshot.gameOver));
    setFinalScore(snapshot.finalScore ?? null);
    setFinalScoreBreakdown(snapshot.finalScoreBreakdown ?? null);
    setIsSwapMode(false);
    setSwapCount(snapshot.swapCount ?? 0);
    return true;
  }, []);

  return {
    board,
    tileRack,
    selectedTiles,
    selectedCells,
    totalScore,
    wordPointsTotal,
    swapPenaltyTotal,
    scrabbleBonusTotal,
    wordCount,
    turnCount,
    tilesRemaining,
    wordHistory,
    isFirstTurn,
    currentSeed,
    message,
    gameOver,
    finalScore,
    finalScoreBreakdown,
    submitScorePreview,
    isSwapMode,
    swapCount,
    premiumSquares: premiumSquaresRef.current,
    boardVariant: boardVariantRef.current,
    getStableSnapshot,
    resumeSavedGame,
    startNewGame,
    resetGame,
    selectTile,
    handleCellClick,
    placeTileOnBoard,
    removeTileFromBoard,
    moveTileOnBoard,
    clearSelection,
    shuffleRack,
    reorderRack,
    prepareSwapTiles,
    commitPreparedSwap,
    swapTiles,
    prepareSubmitWord,
    commitPreparedSubmitWord,
    finalizePreparedSubmitRack,
    submitWord,
    finishGame,
    setMessage,
    BOARD_SIZE: boardSizeRef.current,
    isBlankRackTile,
  };
};
