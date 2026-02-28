import { useState, useCallback, useRef } from "react";
import { dictionary } from "../utils/dictionary";

// Blank tile sentinel (unplaced blank on rack)
export const BLANK_LETTER = " ";

// Official English Scrabble distribution (100 tiles including 2 blanks)
const TILE_DISTRIBUTION = {
  [BLANK_LETTER]: { count: 2, value: 0 },
  A: { count: 9, value: 1 },
  B: { count: 2, value: 3 },
  C: { count: 2, value: 3 },
  D: { count: 4, value: 2 },
  E: { count: 12, value: 1 },
  F: { count: 2, value: 4 },
  G: { count: 3, value: 2 },
  H: { count: 2, value: 4 },
  I: { count: 9, value: 1 },
  J: { count: 1, value: 8 },
  K: { count: 1, value: 5 },
  L: { count: 4, value: 1 },
  M: { count: 2, value: 3 },
  N: { count: 6, value: 1 },
  O: { count: 8, value: 1 },
  P: { count: 2, value: 3 },
  Q: { count: 1, value: 10 },
  R: { count: 6, value: 1 },
  S: { count: 4, value: 1 },
  T: { count: 6, value: 1 },
  U: { count: 4, value: 1 },
  V: { count: 2, value: 4 },
  W: { count: 2, value: 4 },
  X: { count: 1, value: 8 },
  Y: { count: 2, value: 4 },
  Z: { count: 1, value: 10 },
};

const BOARD_SIZE = 15;
const SCRABBLE_BONUS = 50;

// Premium square positions — classic Scrabble layout
const getPremiumSquares = () => {
  const premiumSquares = {};

  // Triple Word Score (TWS) — corners + mid-edges, 8 squares
  const twSquares = [
    [0, 0],
    [0, 7],
    [0, 14],
    [7, 0],
    [7, 14],
    [14, 0],
    [14, 7],
    [14, 14],
  ];
  twSquares.forEach(([r, c]) => (premiumSquares[`${r},${c}`] = "tw"));

  // Double Word Score (DWS) — diagonals from corners, 16 squares
  const dwSquares = [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [1, 13],
    [2, 12],
    [3, 11],
    [4, 10],
    [13, 1],
    [12, 2],
    [11, 3],
    [10, 4],
    [13, 13],
    [12, 12],
    [11, 11],
    [10, 10],
  ];
  dwSquares.forEach(([r, c]) => (premiumSquares[`${r},${c}`] = "dw"));

  // Triple Letter Score (TLS) — outer + inner cross pattern, 24 squares
  const tlSquares = [
    [1, 5],
    [1, 9],
    [5, 1],
    [5, 5],
    [5, 9],
    [5, 13],
    [9, 1],
    [9, 5],
    [9, 9],
    [9, 13],
    [13, 5],
    [13, 9],
    [2, 6],
    [2, 8],
    [6, 2],
    [6, 6],
    [6, 8],
    [6, 12],
    [8, 2],
    [8, 6],
    [8, 8],
    [8, 12],
    [12, 6],
    [12, 8],
  ];
  tlSquares.forEach(([r, c]) => (premiumSquares[`${r},${c}`] = "tl"));

  // Double Letter Score (DLS) — edges + inner clusters, 24 squares
  const dlSquares = [
    [0, 3],
    [0, 11],
    [3, 0],
    [3, 7],
    [3, 14],
    [7, 3],
    [7, 11],
    [11, 0],
    [11, 7],
    [11, 14],
    [14, 3],
    [14, 11],
    [2, 4],
    [2, 10],
    [4, 2],
    [4, 6],
    [4, 8],
    [4, 12],
    [6, 4],
    [6, 10],
    [8, 4],
    [8, 10],
    [10, 2],
    [10, 6],
    [10, 8],
    [10, 12],
    [12, 4],
    [12, 10],
  ];
  dlSquares.forEach(([r, c]) => (premiumSquares[`${r},${c}`] = "dl"));

  // Center star (overwrites 7,7)
  premiumSquares["7,7"] = "center";

  return premiumSquares;
};

// Seeded random number generator
const createSeededRandom = (seed) => {
  const hashSeed = (seed) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  let s = hashSeed(seed);
  return () => {
    s = (s * 1664525 + 1013904223) % Math.pow(2, 32);
    return s / Math.pow(2, 32);
  };
};

const shuffleArray = (array, randomFn) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const useGame = () => {
  const [board, setBoard] = useState(() =>
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null))
  );
  const [tileRack, setTileRack] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [tilesRemaining, setTilesRemaining] = useState(100);
  const [wordHistory, setWordHistory] = useState([]);
  const [isFirstTurn, setIsFirstTurn] = useState(true);
  const [currentSeed, setCurrentSeed] = useState(null);
  const [message, setMessage] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapCount, setSwapCount] = useState(0);

  const randomRef = useRef(null);
  const tileBagRef = useRef([]);
  const nextTileIdRef = useRef(0);
  const pendingSwapRef = useRef(null);
  const pendingSubmitRef = useRef(null);
  const tilesUsedThisTurnRef = useRef(new Set());
  const boardAtTurnStartRef = useRef(null);
  const premiumSquaresRef = useRef(getPremiumSquares());

  const initializeTileBag = useCallback(() => {
    const tileBag = [];
    for (const [letter, data] of Object.entries(TILE_DISTRIBUTION)) {
      for (let i = 0; i < data.count; i++) {
        tileBag.push({ letter, value: data.value });
      }
    }
    return tileBag;
  }, []);

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
    (seed = null) => {
      const gameSeed = seed || Math.floor(Math.random() * 1000000).toString();
      randomRef.current = createSeededRandom(gameSeed);
      setCurrentSeed(gameSeed);
      setTotalScore(0);
      setWordCount(0);
      setTurnCount(0);
      setTilesRemaining(100);
      setWordHistory([]);
      setSelectedTiles([]);
      setSelectedCells([]);
      setIsFirstTurn(true);
      setGameOver(false);
      setFinalScore(null);
      setIsSwapMode(false);
      setSwapCount(0);
      pendingSwapRef.current = null;
      pendingSubmitRef.current = null;
      tilesUsedThisTurnRef.current = new Set();
      boardAtTurnStartRef.current = null;
      premiumSquaresRef.current = getPremiumSquares();

      // Clear board
      setBoard(
        Array(BOARD_SIZE)
          .fill(null)
          .map(() => Array(BOARD_SIZE).fill(null))
      );

      // Initialize and shuffle tile bag
      tileBagRef.current = shuffleArray(initializeTileBag(), randomRef.current);

      // Draw initial 7 tiles (or fewer if bag has fewer)
      const initialRack = [];
      let tilesDrawn = 0;
      for (let i = 0; i < 7 && tileBagRef.current.length > 0; i++) {
        const tile = tileBagRef.current.pop();
        initialRack.push({ ...tile, id: nextTileIdRef.current++ });
        tilesDrawn++;
      }
      setTileRack(initialRack);
      setTilesRemaining(100 - tilesDrawn);
    },
    [initializeTileBag]
  );

  const resetGame = useCallback(() => {
    if (!currentSeed) {
      const gameSeed = Math.floor(Math.random() * 1000000).toString();
      randomRef.current = createSeededRandom(gameSeed);
      setCurrentSeed(gameSeed);
    } else {
      randomRef.current = createSeededRandom(currentSeed);
    }

    setTotalScore(0);
    setWordCount(0);
    setTurnCount(0);
    setTilesRemaining(100);
    setWordHistory([]);
    setSelectedTiles([]);
    setSelectedCells([]);
    setIsFirstTurn(true);
    setGameOver(false);
    setFinalScore(null);
    setIsSwapMode(false);
    setSwapCount(0);
    pendingSwapRef.current = null;
    pendingSubmitRef.current = null;
    tilesUsedThisTurnRef.current = new Set();
    boardAtTurnStartRef.current = null;
    premiumSquaresRef.current = getPremiumSquares();

    setBoard(
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null))
    );

    tileBagRef.current = shuffleArray(initializeTileBag(), randomRef.current);

    const initialRack = [];
    let tilesDrawn = 0;
    for (let i = 0; i < 7 && tileBagRef.current.length > 0; i++) {
      const tile = tileBagRef.current.pop();
      initialRack.push({ ...tile, id: nextTileIdRef.current++ });
      tilesDrawn++;
    }
    setTileRack(initialRack);
    setTilesRemaining(100 - tilesDrawn);
  }, [currentSeed, initializeTileBag]);

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
    setBoard((prev) => {
      const newBoard = prev.map((r) => [...r]);
      const tile = newBoard[fromRow][fromCol];
      if (
        !tile ||
        !tile.isFromRack ||
        tile.scored ||
        newBoard[toRow][toCol] !== null
      )
        return prev;
      newBoard[fromRow][fromCol] = null;
      newBoard[toRow][toCol] = {
        ...tile,
        rackIndex: tile.rackIndex,
        isFromRack: true,
      };
      return newBoard;
    });
    setSelectedCells((prev) => {
      const without = prev.filter(
        (c) => !(c.row === fromRow && c.col === fromCol)
      );
      return [...without, { row: toRow, col: toCol }];
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
      setTileRack((prev) => shuffleArray(prev, randomRef.current));
    }
  }, []);

  const reorderRack = useCallback(
    (fromIndex, toIndex, releasedIndex = null) => {
      setTileRack((prev) => {
        const usedIndices = new Set();
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE; col++) {
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
      randomRef.current
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
    setSwapCount((prev) => prev + 1);
    setTurnCount((prev) => prev + 1);
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

  const getWordsOnBoard = useCallback(() => {
    const words = [];
    const visited = new Set();

    // Horizontal words
    for (let row = 0; row < BOARD_SIZE; row++) {
      let word = [];
      let cells = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col]) {
          word.push(board[row][col].letter);
          cells.push({ row, col });
        } else {
          if (word.length >= 2) {
            const wordStr = word.join("");
            const key = `h-${row}-${cells[0].col}-${
              cells[cells.length - 1].col
            }`;
            if (!visited.has(key)) {
              words.push({
                word: wordStr,
                cells: [...cells],
                direction: "horizontal",
              });
              cells.forEach((c) => visited.add(`${c.row},${c.col}`));
            }
          }
          word = [];
          cells = [];
        }
      }
      if (word.length >= 2) {
        const wordStr = word.join("");
        const key = `h-${row}-${cells[0].col}-${cells[cells.length - 1].col}`;
        if (!visited.has(key)) {
          words.push({
            word: wordStr,
            cells: [...cells],
            direction: "horizontal",
          });
        }
      }
    }

    // Vertical words
    for (let col = 0; col < BOARD_SIZE; col++) {
      let word = [];
      let cells = [];
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (board[row][col]) {
          word.push(board[row][col].letter);
          cells.push({ row, col });
        } else {
          if (word.length >= 2) {
            const wordStr = word.join("");
            const key = `v-${col}-${cells[0].row}-${
              cells[cells.length - 1].row
            }`;
            if (!visited.has(key)) {
              words.push({
                word: wordStr,
                cells: [...cells],
                direction: "vertical",
              });
              cells.forEach((c) => visited.add(`${c.row},${c.col}`));
            }
          }
          word = [];
          cells = [];
        }
      }
      if (word.length >= 2) {
        const wordStr = word.join("");
        const key = `v-${col}-${cells[0].row}-${cells[cells.length - 1].row}`;
        if (!visited.has(key)) {
          words.push({
            word: wordStr,
            cells: [...cells],
            direction: "vertical",
          });
        }
      }
    }

    return words;
  }, [board]);

  const hasNewTiles = useCallback((wordData) => {
    if (!boardAtTurnStartRef.current) return true;
    // Snapshot stores true = had tile, false = was empty at turn start
    return wordData.cells.some(({ row, col }) => {
      return boardAtTurnStartRef.current[row][col] === false;
    });
  }, []);

  const calculateWordScore = useCallback(
    (wordData) => {
      let score = 0;
      let wordMultiplier = 1;

      wordData.cells.forEach(({ row, col }) => {
        const tile = board[row][col];
        if (!tile) return;

        const key = `${row},${col}`;
        const premium = premiumSquaresRef.current[key];

        if (premium === "dw" || premium === "center") {
          wordMultiplier *= 2;
        } else if (premium === "tw") {
          wordMultiplier *= 3;
        }

        // Blanks count as 0 and do not get letter multipliers (DL/TL)
        if (tile.isBlank) {
          score += 0;
        } else {
          let tileMultiplier = 1;
          if (premium === "dl") tileMultiplier = 2;
          else if (premium === "tl") tileMultiplier = 3;
          score += tile.value * tileMultiplier;
        }
      });

      return score * wordMultiplier;
    },
    [board]
  );

  const prepareSubmitWord = useCallback(() => {
    if (gameOver) return null;

    const placedCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const tile = board[r][c];
        if (tile && tile.isFromRack && !tile.scored) {
          placedCells.push({ row: r, col: c });
        }
      }
    }

    if (placedCells.length === 0) {
      setMessage({
        title: "No Word",
        text: "Please place tiles on the board first.",
      });
      return null;
    }

    const sameRow = placedCells.every(({ row }) => row === placedCells[0].row);
    const sameCol = placedCells.every(({ col }) => col === placedCells[0].col);
    if (!sameRow && !sameCol) {
      setMessage({
        title: "Invalid Placement",
        text: "Tiles must be placed in a single row or a single column.",
      });
      return null;
    }

    if (isFirstTurn) {
      const hasCenter = placedCells.some(
        ({ row, col }) => row === 7 && col === 7
      );
      if (!hasCenter) {
        setMessage({
          title: "First Word",
          text: "The first word must be placed on the center square (★).",
        });
        return null;
      }
    } else {
      const hasConnection = placedCells.some(({ row, col }) => {
        const adjacent = [
          { r: row - 1, c: col },
          { r: row + 1, c: col },
          { r: row, c: col - 1 },
          { r: row, c: col + 1 },
        ];
        return adjacent.some(({ r, c }) => {
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE)
            return false;
          return (
            board[r][c] !== null &&
            !placedCells.some((sc) => sc.row === r && sc.col === c)
          );
        });
      });

      if (!hasConnection) {
        setMessage({
          title: "Invalid Placement",
          text: "New words must connect to existing words.",
        });
        return null;
      }
    }

    const words = getWordsOnBoard();
    if (words.length === 0) {
      setMessage({
        title: "Invalid Word",
        text: "No valid words found on the board.",
      });
      return null;
    }

    const newWords = words.filter((wordData) => hasNewTiles(wordData));
    if (newWords.length === 0) {
      setMessage({
        title: "No New Words",
        text: "You must place at least one new tile.",
      });
      return null;
    }

    const invalidWords = [];
    for (const wordData of words) {
      if (!dictionary.isValid(wordData.word)) {
        invalidWords.push(wordData.word.toUpperCase());
      }
    }

    if (invalidWords.length > 0) {
      setMessage({
        title: "Invalid Word",
        text: `Invalid words: ${invalidWords.join(", ")}`,
      });
      return null;
    }

    let turnScore = 0;
    newWords.forEach((wordData) => {
      turnScore += calculateWordScore(wordData);
    });

    const earnedScrabbleBonus = placedCells.length === 7;
    if (earnedScrabbleBonus) {
      turnScore += SCRABBLE_BONUS;
    }

    const newHistory = newWords.map((wordData) => ({
      word: wordData.word.toUpperCase(),
      score: calculateWordScore(wordData),
      turn: turnCount + 1,
    }));
    if (earnedScrabbleBonus) {
      newHistory.push({
        word: "SCRABBLE BONUS",
        score: SCRABBLE_BONUS,
        turn: turnCount + 1,
      });
    }

    const usedIndices = new Set();
    placedCells.forEach(({ row, col }) => {
      const tile = board[row][col];
      if (tile && tile.isFromRack && tile.rackIndex !== undefined) {
        usedIndices.add(tile.rackIndex);
      }
    });

    const remainingRack = tileRack.filter(
      (_, index) => !usedIndices.has(index)
    );
    const nextBag = [...tileBagRef.current];
    const drawnTiles = [];
    let nextTileId = nextTileIdRef.current;

    for (let i = 0; i < usedIndices.size && nextBag.length > 0; i++) {
      const tile = nextBag.pop();
      drawnTiles.push({ ...tile, id: nextTileId++ });
    }

    const newPremiumSquares = { ...premiumSquaresRef.current };
    words.forEach((wordData) => {
      wordData.cells.forEach(({ row, col }) => {
        const key = `${row},${col}`;
        delete newPremiumSquares[key];
      });
    });

    const payload = {
      turnScore,
      earnedScrabbleBonus,
      newWords,
      newHistory,
      placedCells,
      remainingRack,
      drawnTiles,
      resultingRack: [...remainingRack, ...drawnTiles],
      nextBag,
      nextTileId,
      nextTilesRemaining: Math.max(0, tilesRemaining - drawnTiles.length),
      newPremiumSquares,
      nextBoardAtTurnStart: board.map((r) => r.map((c) => c !== null)),
    };

    pendingSubmitRef.current = payload;
    return payload;
  }, [
    gameOver,
    isFirstTurn,
    board,
    tileRack,
    tilesRemaining,
    getWordsOnBoard,
    hasNewTiles,
    calculateWordScore,
    turnCount,
  ]);

  const commitPreparedSubmitWord = useCallback((preparedSubmit = null) => {
    const payload = preparedSubmit ?? pendingSubmitRef.current;
    if (!payload) return false;

    pendingSubmitRef.current = payload;
    setTotalScore((prev) => prev + payload.turnScore);
    setWordCount((prev) => prev + payload.newWords.length);
    setTurnCount((prev) => prev + 1);
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
    if (!payload.earnedScrabbleBonus) {
      setMessage({
        title: "Word Accepted!",
        text: `You scored ${payload.turnScore} points! Words: ${payload.newWords
          .map((w) => w.word.toUpperCase())
          .join(", ")}`,
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
    const unusedPoints = tileRack.reduce((sum, t) => sum + (t?.value ?? 0), 0);
    const score = totalScore - turnCount * 2 - unusedPoints;
    setFinalScore(score);
    setGameOver(true);
    setMessage({
      title: "Game Over",
      text: `Final score: ${score}`,
    });
  }, [gameOver, tilesRemaining, tileRack, totalScore, turnCount]);

  return {
    board,
    tileRack,
    selectedTiles,
    selectedCells,
    totalScore,
    wordCount,
    turnCount,
    tilesRemaining,
    wordHistory,
    isFirstTurn,
    currentSeed,
    message,
    gameOver,
    finalScore,
    isSwapMode,
    swapCount,
    premiumSquares: premiumSquaresRef.current,
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
    BOARD_SIZE,
    isBlankRackTile,
  };
};
