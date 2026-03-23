import { BLANK_LETTER } from "../shared/bag";
import { scoreSubmittedWords } from "../shared/scoring";
import { validateSubmitTurn } from "../shared/validation";

const DIRECTIONS = {
  horizontal: { dr: 0, dc: 1 },
  vertical: { dr: 1, dc: 0 },
};

const normalizeLetter = (letter) => String(letter || "").trim().toUpperCase();

const cloneBoard = (board) => board.map((row) => row.map((cell) => (cell == null ? null : { ...cell })));

const boardSnapshot = (board) => board.map((row) => row.map((cell) => cell != null));

const isInBounds = (boardSize, row, col) => row >= 0 && row < boardSize && col >= 0 && col < boardSize;

const makeDictionaryAdapter = (lexicon) => ({
  isValid: (word) => lexicon.isValid(String(word || "").toLowerCase()),
});

const buildRackPools = (tileRack = []) => {
  const letterPools = new Map();
  const blankPool = [];

  tileRack.forEach((tile, rackIndex) => {
    const letter = normalizeLetter(tile?.letter);
    const isBlank = tile?.isBlank || tile?.value === 0 || letter === normalizeLetter(BLANK_LETTER);
    if (isBlank) {
      blankPool.push(rackIndex);
      return;
    }

    if (!letterPools.has(letter)) {
      letterPools.set(letter, []);
    }
    letterPools.get(letter).push(rackIndex);
  });

  return { letterPools, blankPool };
};

const buildRackCounts = (tileRack = []) => {
  const counts = new Map();
  let blankCount = 0;

  tileRack.forEach((tile) => {
    const letter = normalizeLetter(tile?.letter);
    const isBlank = tile?.isBlank || tile?.value === 0 || letter === normalizeLetter(BLANK_LETTER);
    if (isBlank) {
      blankCount += 1;
      return;
    }

    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  });

  return { counts, blankCount };
};

const hasAdjacentExistingTile = ({ board, boardSize, row, col }) => {
  const neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];

  return neighbors.some(([r, c]) => isInBounds(boardSize, r, c) && board[r][c] != null);
};

const collectAnchors = ({ board, boardSize, isFirstTurn }) => {
  if (isFirstTurn) {
    const center = Math.floor(boardSize / 2);
    return [{ row: center, col: center }];
  }

  const anchors = [];
  for (let row = 0; row < boardSize; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      if (board[row][col] != null) continue;
      if (hasAdjacentExistingTile({ board, boardSize, row, col })) {
        anchors.push({ row, col });
      }
    }
  }

  return anchors;
};

const buildSlotKey = ({ direction, startRow, startCol, length }) =>
  `${direction}:${startRow}:${startCol}:${length}`;

const buildSlotsFromAnchor = ({
  board,
  boardSize,
  anchor,
  direction,
  isFirstTurn,
}) => {
  const slots = [];
  const { dr, dc } = DIRECTIONS[direction];

  for (let length = 2; length <= boardSize; length += 1) {
    for (let anchorOffset = 0; anchorOffset < length; anchorOffset += 1) {
      const startRow = anchor.row - dr * anchorOffset;
      const startCol = anchor.col - dc * anchorOffset;
      const endRow = startRow + dr * (length - 1);
      const endCol = startCol + dc * (length - 1);

      if (!isInBounds(boardSize, startRow, startCol) || !isInBounds(boardSize, endRow, endCol)) {
        continue;
      }

      const beforeRow = startRow - dr;
      const beforeCol = startCol - dc;
      if (isInBounds(boardSize, beforeRow, beforeCol) && board[beforeRow][beforeCol] != null) {
        continue;
      }

      const afterRow = endRow + dr;
      const afterCol = endCol + dc;
      if (isInBounds(boardSize, afterRow, afterCol) && board[afterRow][afterCol] != null) {
        continue;
      }

      const pattern = [];
      const cells = [];
      let hasEmptyCell = false;
      let hasExistingTileInSlot = false;

      for (let index = 0; index < length; index += 1) {
        const row = startRow + dr * index;
        const col = startCol + dc * index;
        const tile = board[row][col];
        if (tile == null) {
          pattern.push(null);
          hasEmptyCell = true;
        } else {
          pattern.push(normalizeLetter(tile.letter));
          hasExistingTileInSlot = true;
        }
        cells.push({ row, col });
      }

      if (!hasEmptyCell) continue;
      if (!isFirstTurn && !hasExistingTileInSlot) {
        const hasPerpendicularConnection = cells.some(({ row, col }) =>
          hasAdjacentExistingTile({ board, boardSize, row, col })
        );
        if (!hasPerpendicularConnection) continue;
      }

      slots.push({
        direction,
        startRow,
        startCol,
        length,
        pattern,
        cells,
      });
    }
  }

  return slots;
};

const getPerpendicularWord = ({ board, boardSize, row, col, direction, letter }) => {
  const isHorizontal = direction === "horizontal";
  const dr = isHorizontal ? 1 : 0;
  const dc = isHorizontal ? 0 : 1;

  let startRow = row;
  let startCol = col;
  while (isInBounds(boardSize, startRow - dr, startCol - dc) && board[startRow - dr][startCol - dc] != null) {
    startRow -= dr;
    startCol -= dc;
  }

  const chars = [];
  let cursorRow = startRow;
  let cursorCol = startCol;
  while (isInBounds(boardSize, cursorRow, cursorCol)) {
    if (cursorRow === row && cursorCol === col) {
      chars.push(letter);
    } else {
      const tile = board[cursorRow][cursorCol];
      if (!tile) break;
      chars.push(normalizeLetter(tile.letter));
    }

    const nextRow = cursorRow + dr;
    const nextCol = cursorCol + dc;
    if (!isInBounds(boardSize, nextRow, nextCol)) break;

    const nextTile = board[nextRow][nextCol];
    if (!nextTile && !(nextRow === row && nextCol === col)) break;

    cursorRow = nextRow;
    cursorCol = nextCol;
  }

  return chars.join("");
};

const buildWordFromPatternMatches = ({
  trie,
  pattern,
  counts,
  blankCount,
  maxMatches,
}) => {
  const matches = [];
  const letters = [];
  const blankMask = [];

  const walk = (node, index, rackCounts, remainingBlanks) => {
    if (matches.length >= maxMatches) return;

    if (index === pattern.length) {
      if (node.isWord) {
        matches.push({ word: letters.join(""), blankMask: [...blankMask] });
      }
      return;
    }

    const requiredLetter = pattern[index];
    if (requiredLetter) {
      const nextNode = node.children.get(requiredLetter.toLowerCase());
      if (!nextNode) return;
      letters.push(requiredLetter);
      blankMask.push(false);
      walk(nextNode, index + 1, rackCounts, remainingBlanks);
      letters.pop();
      blankMask.pop();
      return;
    }

    node.children.forEach((nextNode, lowerLetter) => {
      const letter = lowerLetter.toUpperCase();
      const available = rackCounts.get(letter) ?? 0;
      if (available > 0) {
        rackCounts.set(letter, available - 1);
        letters.push(letter);
        blankMask.push(false);
        walk(nextNode, index + 1, rackCounts, remainingBlanks);
        letters.pop();
        blankMask.pop();
        rackCounts.set(letter, available);
      } else if (remainingBlanks > 0) {
        letters.push(letter);
        blankMask.push(true);
        walk(nextNode, index + 1, rackCounts, remainingBlanks - 1);
        letters.pop();
        blankMask.pop();
      }
    });
  };

  walk(trie, 0, new Map(counts), blankCount);
  return matches;
};

const assignRackTilesToMatch = ({ tileRack, slot, match }) => {
  const pools = buildRackPools(tileRack);
  const placements = [];
  const usedRackIndices = [];

  for (let index = 0; index < slot.length; index += 1) {
    if (slot.pattern[index]) continue;

    const { row, col } = slot.cells[index];
    const letter = match.word[index];
    const needsBlank = match.blankMask[index] === true;

    let rackIndex = null;
    if (needsBlank) {
      rackIndex = pools.blankPool.shift();
    } else {
      const pool = pools.letterPools.get(letter);
      if (pool && pool.length > 0) {
        rackIndex = pool.shift();
      } else if (pools.blankPool.length > 0) {
        rackIndex = pools.blankPool.shift();
      }
    }

    if (rackIndex == null) {
      return null;
    }

    const sourceTile = tileRack[rackIndex];
    const isBlank = sourceTile?.isBlank || sourceTile?.value === 0 || normalizeLetter(sourceTile?.letter) === normalizeLetter(BLANK_LETTER);
    placements.push({
      row,
      col,
      rackIndex,
      letter,
      isBlank,
      value: isBlank ? 0 : sourceTile?.value ?? 0,
    });
    usedRackIndices.push(rackIndex);
  }

  return { placements, usedRackIndices };
};

const createsPerpendicularWordsOnlyValid = ({ board, boardSize, lexicon, slot, match }) => {
  for (let index = 0; index < slot.length; index += 1) {
    if (slot.pattern[index]) continue;

    const { row, col } = slot.cells[index];
    const letter = match.word[index];
    const perpendicularWord = getPerpendicularWord({
      board,
      boardSize,
      row,
      col,
      direction: slot.direction,
      letter,
    });

    if (perpendicularWord.length >= 2 && !lexicon.isValid(perpendicularWord.toLowerCase())) {
      return false;
    }
  }

  return true;
};

const buildBoardWithPlacements = ({ board, placements }) => {
  const nextBoard = cloneBoard(board);
  placements.forEach((placement) => {
    nextBoard[placement.row][placement.col] = {
      letter: placement.letter,
      value: placement.value,
      isBlank: placement.isBlank,
      rackIndex: placement.rackIndex,
      isFromRack: true,
      scored: false,
    };
  });
  return nextBoard;
};

const sortMoves = (moves) => {
  return [...moves].sort((left, right) => {
    if (right.turnScore !== left.turnScore) {
      return right.turnScore - left.turnScore;
    }
    if (right.baseWordScore !== left.baseWordScore) {
      return right.baseWordScore - left.baseWordScore;
    }
    return String(left.word).localeCompare(String(right.word));
  });
};

export const generateLegalMoves = ({
  state,
  lexicon,
  maxMoves = 200,
  maxMatchesPerSlot = 250,
} = {}) => {
  if (!state || !lexicon) {
    throw new Error("state and lexicon are required for move generation");
  }

  const board = state.board;
  const boardSize = state.boardSize;
  const tileRack = state.tileRack;
  const anchors = collectAnchors({ board, boardSize, isFirstTurn: state.isFirstTurn });
  if (anchors.length === 0) {
    return [];
  }

  const { counts, blankCount } = buildRackCounts(tileRack);
  const slotMap = new Map();

  anchors.forEach((anchor) => {
    Object.keys(DIRECTIONS).forEach((direction) => {
      buildSlotsFromAnchor({
        board,
        boardSize,
        anchor,
        direction,
        isFirstTurn: state.isFirstTurn,
      }).forEach((slot) => {
        const slotKey = buildSlotKey(slot);
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, slot);
        }
      });
    });
  });

  const boardAtTurnStart = boardSnapshot(board);
  const dictionaryAdapter = makeDictionaryAdapter(lexicon);
  const dedup = new Set();
  const acceptedMoves = [];

  for (const slot of slotMap.values()) {
    const matches = buildWordFromPatternMatches({
      trie: lexicon.trie,
      pattern: slot.pattern,
      counts,
      blankCount,
      maxMatches: maxMatchesPerSlot,
    });

    for (const match of matches) {
      if (!createsPerpendicularWordsOnlyValid({ board, boardSize, lexicon, slot, match })) {
        continue;
      }

      const assignment = assignRackTilesToMatch({ tileRack, slot, match });
      if (!assignment || assignment.placements.length === 0) {
        continue;
      }

      const candidateBoard = buildBoardWithPlacements({ board, placements: assignment.placements });
      const validation = validateSubmitTurn({
        board: candidateBoard,
        isFirstTurn: state.isFirstTurn,
        boardAtTurnStart,
        dictionary: dictionaryAdapter,
        boardSize,
      });

      if (!validation.ok) {
        continue;
      }

      const scoring = scoreSubmittedWords({
        board: candidateBoard,
        newWords: validation.newWords,
        premiumSquares: state.premiumSquares,
        turnCount: state.turnCount,
        placedCells: validation.placedCells,
        bonusMode: state.mode === "mini" ? "mini" : "classic",
      });

      const moveKey = `${slot.direction}:${slot.startRow}:${slot.startCol}:${match.word}:${assignment.usedRackIndices.join(".")}`;
      if (dedup.has(moveKey)) continue;
      dedup.add(moveKey);

      acceptedMoves.push({
        id: `move-${acceptedMoves.length + 1}`,
        direction: slot.direction,
        startRow: slot.startRow,
        startCol: slot.startCol,
        word: match.word,
        placements: assignment.placements,
        usedRackIndices: assignment.usedRackIndices,
        placedCells: validation.placedCells,
        words: validation.words,
        newWords: validation.newWords,
        turnScore: scoring.turnScore,
        baseWordScore: scoring.baseWordScore,
        scrabbleBonus: scoring.scrabbleBonus,
        newHistory: scoring.newHistory,
      });
    }
  }

  return sortMoves(acceptedMoves).slice(0, maxMoves);
};
