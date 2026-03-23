import {
  BOARD_SIZE,
  MINI_BOARD_SIZE,
  createClassicPremiumSquares,
  createMiniPremiumSquares,
} from "../shared/premiumSquares";

const clonePremiumSquares = (premiumSquares) => {
  const cloned = {};
  Object.entries(premiumSquares || {}).forEach(([key, value]) => {
    cloned[key] = value;
  });
  return cloned;
};

export const BOARD_LAYOUTS = {
  classic: {
    id: "classic",
    boardSize: BOARD_SIZE,
    premiumSquares: createClassicPremiumSquares(),
  },
  mini: {
    id: "mini",
    boardSize: MINI_BOARD_SIZE,
    premiumSquares: createMiniPremiumSquares(),
  },
};

export const getBoardLayout = ({ mode = "classic", layoutId = null } = {}) => {
  const preferredId = layoutId || mode;
  const selected = BOARD_LAYOUTS[preferredId] || BOARD_LAYOUTS[mode] || BOARD_LAYOUTS.classic;

  return {
    id: selected.id,
    boardSize: selected.boardSize,
    premiumSquares: clonePremiumSquares(selected.premiumSquares),
  };
};

export const registerBoardLayout = ({ id, boardSize, premiumSquares }) => {
  if (!id || typeof id !== "string") {
    throw new Error("board layout id is required");
  }
  if (!Number.isInteger(boardSize) || boardSize <= 0) {
    throw new Error("board layout boardSize must be a positive integer");
  }
  if (!premiumSquares || typeof premiumSquares !== "object") {
    throw new Error("board layout premiumSquares must be an object");
  }

  BOARD_LAYOUTS[id] = {
    id,
    boardSize,
    premiumSquares: clonePremiumSquares(premiumSquares),
  };

  return getBoardLayout({ layoutId: id });
};

export const exportBoardLayoutRegistry = () => {
  return Object.values(BOARD_LAYOUTS).map((layout) => ({
    id: layout.id,
    boardSize: layout.boardSize,
    premiumSquares: clonePremiumSquares(layout.premiumSquares),
  }));
};

const parseCoord = (key) => key.split(",").map((value) => Number(value));
const toKey = (row, col) => `${row},${col}`;

export const getRotationalSymmetryPoints = (row, col, boardSize) => {
  const points = [
    [row, col],
    [boardSize - 1 - row, boardSize - 1 - col],
  ];
  const deduped = new Map();
  points.forEach(([r, c]) => {
    deduped.set(toKey(r, c), [r, c]);
  });
  return [...deduped.values()];
};

export const mutateBoardLayout = ({
  basePremiumSquares,
  boardSize,
  mutationCount = 1,
  preserveSymmetry = true,
  random = Math.random,
}) => {
  // Layout Lab constraints: always keep rotational symmetry and avoid
  // orthogonally-adjacent premium squares.
  const enforceSymmetry = true;
  const next = clonePremiumSquares(basePremiumSquares);
  const keys = Object.keys(next);
  if (keys.length === 0) return next;
  const maxAttempts = Math.max(30, mutationCount * 40);
  let attempts = 0;
  let appliedMutations = 0;
  const centerIndex = Math.floor(boardSize / 2);
  const centerKey = toKey(centerIndex, centerIndex);

  const hasAdjacentPremium = (premiumSquares, row, col, ignoreKeys = new Set()) => {
    const neighbors = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];

    return neighbors.some(([r, c]) => {
      if (r < 0 || c < 0 || r >= boardSize || c >= boardSize) {
        return false;
      }
      const neighborKey = toKey(r, c);
      if (ignoreKeys.has(neighborKey)) return false;
      return Boolean(premiumSquares[neighborKey]);
    });
  };

  const isRimCell = (row, col) =>
    row === 0 || col === 0 || row === boardSize - 1 || col === boardSize - 1;

  const satisfiesGlobalConstraints = (premiumSquares) => {
    // Center premium must remain fixed.
    if (premiumSquares[centerKey] !== "center") {
      return false;
    }

    // Triple-word premiums must stay on the board rim.
    const twOffRim = Object.entries(premiumSquares).some(([key, value]) => {
      if (value !== "tw") return false;
      const [row, col] = parseCoord(key);
      return !isRimCell(row, col);
    });

    if (twOffRim) {
      return false;
    }

    return true;
  };

  while (appliedMutations < mutationCount && attempts < maxAttempts) {
    attempts += 1;
    const sourceKey = keys[Math.floor(random() * keys.length)];
    const premiumType = next[sourceKey];
    if (sourceKey === centerKey || premiumType === "center") {
      continue;
    }
    const [sourceRow, sourceCol] = parseCoord(sourceKey);

    const targetRow = Math.floor(random() * boardSize);
    const targetCol = Math.floor(random() * boardSize);
    const targetKey = toKey(targetRow, targetCol);

    if (targetKey === sourceKey || next[targetKey]) {
      continue;
    }
    if (targetKey === centerKey) {
      continue;
    }

    const sourcePoints = enforceSymmetry
      ? getRotationalSymmetryPoints(sourceRow, sourceCol, boardSize)
      : [[sourceRow, sourceCol]];
    const targetPoints = enforceSymmetry
      ? getRotationalSymmetryPoints(targetRow, targetCol, boardSize)
      : [[targetRow, targetCol]];

    const sourceTypes = sourcePoints
      .map(([r, c]) => next[toKey(r, c)])
      .filter(Boolean);

    if (sourceTypes.length === 0) {
      continue;
    }

    const targetKeySet = new Set(targetPoints.map(([r, c]) => toKey(r, c)));
    const tentative = clonePremiumSquares(next);

    sourcePoints.forEach(([r, c]) => {
      delete tentative[toKey(r, c)];
    });

    targetPoints.forEach(([r, c], index) => {
      tentative[toKey(r, c)] =
        sourceTypes[index % sourceTypes.length] || premiumType;
    });

    if (!satisfiesGlobalConstraints(tentative)) {
      continue;
    }

    const violatesAdjacency = targetPoints.some(([r, c]) =>
      hasAdjacentPremium(tentative, r, c, targetKeySet)
    );
    if (violatesAdjacency) {
      continue;
    }

    // Keep existing board valid too for safety.
    const globalViolation = Object.keys(tentative).some((key) => {
      const [r, c] = parseCoord(key);
      return hasAdjacentPremium(tentative, r, c);
    });
    if (globalViolation) {
      continue;
    }

    Object.keys(next).forEach((key) => delete next[key]);
    Object.entries(tentative).forEach(([key, value]) => {
      next[key] = value;
    });
    appliedMutations += 1;
  }

  return next;
};
