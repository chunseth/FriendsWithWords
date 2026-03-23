import { useCallback, useMemo, useState } from "react";

const toKey = (row, col) => `${row},${col}`;

export const PREMIUM_TILE_DEFS = [
  { type: "tw", label: "TW", color: "#b0374f" },
  { type: "dw", label: "DW", color: "#d07c9a" },
  { type: "tl", label: "TL", color: "#2d62ad" },
  { type: "dl", label: "DL", color: "#65b2db" },
];

export const PREMIUM_TILE_LIMITS = {
  classic: {
    tw: 8,
    dw: 16,
    tl: 24,
    dl: 28,
  },
  mini: {
    tw: 4,
    dw: 8,
    tl: 8,
    dl: 12,
  },
};

const getLimitsByBoardSize = (boardSize) =>
  boardSize === 11 ? PREMIUM_TILE_LIMITS.mini : PREMIUM_TILE_LIMITS.classic;

export const usePremiumTileDragDrop = ({ boardSize }) => {
  const centerIndex = Math.floor(boardSize / 2);
  const centerKey = toKey(centerIndex, centerIndex);
  const premiumTileLimits = getLimitsByBoardSize(boardSize);

  const [premiumSquares, setPremiumSquares] = useState({ [centerKey]: "center" });
  const [draggingTile, setDraggingTile] = useState(null);
  const [boardRect, setBoardRect] = useState(null);

  const setBoardLayout = useCallback((layout) => {
    if (!layout) return;
    setBoardRect(layout);
  }, []);

  const resetBoard = useCallback(() => {
    setPremiumSquares({ [centerKey]: "center" });
    setDraggingTile(null);
  }, [centerKey]);

  const dropPointToCell = useCallback(
    (pageX, pageY, snapToNearest = false) => {
      if (!boardRect) return null;

      const boardWidth = boardRect.width ?? boardRect.size;
      const boardHeight = boardRect.height ?? boardRect.size;
      const withinX = pageX >= boardRect.x && pageX <= boardRect.x + boardWidth;
      const withinY = pageY >= boardRect.y && pageY <= boardRect.y + boardHeight;
      if (!withinX || !withinY) return null;

      const boardPad = boardRect.boardPad || 0;
      const cellGap = boardRect.cellGap || 0;
      const cellSize = boardRect.cellSize || boardRect.size / boardSize;
      const step = cellSize + cellGap * 2;
      const contentX = pageX - boardRect.x - boardPad;
      const contentY = pageY - boardRect.y - boardPad;
      const unclampedCol = snapToNearest
        ? Math.round((contentX - cellGap - cellSize / 2) / step)
        : Math.floor(contentX / step);
      const unclampedRow = snapToNearest
        ? Math.round((contentY - cellGap - cellSize / 2) / step)
        : Math.floor(contentY / step);
      const col = Math.max(0, Math.min(boardSize - 1, unclampedCol));
      const row = Math.max(0, Math.min(boardSize - 1, unclampedRow));
      const localX = contentX - col * step;
      const localY = contentY - row * step;

      if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) {
        return null;
      }

      if (snapToNearest) {
        return { row, col, key: toKey(row, col) };
      }

      const inCellX = localX >= cellGap && localX <= cellGap + cellSize;
      const inCellY = localY >= cellGap && localY <= cellGap + cellSize;
      if (!inCellX || !inCellY) return null;

      return { row, col, key: toKey(row, col) };
    },
    [boardRect, boardSize]
  );

  const handleDragStart = useCallback(({ tileType, source, fromKey, pageX, pageY }) => {
    if (!tileType) return;
    setDraggingTile({
      tileType,
      source,
      fromKey: fromKey || null,
      pageX,
      pageY,
    });
  }, []);

  const handleDragMove = useCallback(({ pageX, pageY }) => {
    setDraggingTile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pageX,
        pageY,
      };
    });
  }, []);

  const handleDragEnd = useCallback(
    ({ pageX, pageY }) => {
      setPremiumSquares((prev) => {
        if (!draggingTile) return prev;

        const next = { ...prev };
        if (
          draggingTile.source === "board" &&
          draggingTile.fromKey &&
          draggingTile.fromKey !== centerKey
        ) {
          delete next[draggingTile.fromKey];
        }

        const target = dropPointToCell(pageX, pageY, true);
        if (target && target.key !== centerKey) {
          const requestedType = draggingTile.tileType;
          const priorTypeAtTarget = next[target.key] || null;
          const typeCount = Object.values(next).filter((value) => value === requestedType)
            .length;
          const maxCount = premiumTileLimits[requestedType] || 0;
          const replacingSameType = priorTypeAtTarget === requestedType;

          if (maxCount > 0 && (typeCount < maxCount || replacingSameType)) {
            next[target.key] = requestedType;
          }
        } else if (
          draggingTile.source === "board" &&
          draggingTile.fromKey &&
          draggingTile.fromKey !== centerKey
        ) {
          // Allow removing a placed premium by dropping off-board.
          delete next[draggingTile.fromKey];
        }

        if (!next[centerKey]) {
          next[centerKey] = "center";
        }

        if (target && target.key === centerKey) {
          next[centerKey] = "center";
        }

        if (draggingTile.source === "board" && draggingTile.fromKey === centerKey) {
          next[centerKey] = "center";
        }

        return next;
      });

      setDraggingTile(null);
    },
    [centerKey, draggingTile, dropPointToCell, premiumTileLimits]
  );

  const placementCount = useMemo(
    () =>
      Object.entries(premiumSquares).reduce((count, [key, value]) => {
        if (key === centerKey || value === "center") return count;
        return count + 1;
      }, 0),
    [premiumSquares]
  );

  const placementCountsByType = useMemo(
    () =>
      Object.values(premiumSquares).reduce(
        (acc, type) => {
          if (acc[type] != null) {
            acc[type] += 1;
          }
          return acc;
        },
        { tw: 0, dw: 0, tl: 0, dl: 0 }
      ),
    [premiumSquares]
  );

  return {
    premiumSquares,
    draggingTile,
    placementCount,
    placementCountsByType,
    premiumTileLimits,
    centerKey,
    setPremiumSquares,
    setBoardLayout,
    resetBoard,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};
