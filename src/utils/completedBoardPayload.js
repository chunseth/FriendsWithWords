export const buildCompletedBoardTilesPayload = ({
  board,
  boardSize,
  mode = "classic",
} = {}) => {
  if (!Array.isArray(board)) {
    return null;
  }

  const resolvedBoardSize =
    typeof boardSize === "number" && boardSize > 0 ? boardSize : board.length;
  const tiles = [];

  for (let row = 0; row < board.length; row += 1) {
    const boardRow = board[row];
    if (!Array.isArray(boardRow)) continue;

    for (let col = 0; col < boardRow.length; col += 1) {
      const tile = boardRow[col];
      if (!tile || tile.scored !== true || typeof tile.letter !== "string") {
        continue;
      }

      const letter = tile.letter.trim().toUpperCase();
      if (letter.length !== 1) continue;

      const payloadTile = { row, col, letter };
      if (tile.isBlank === true) {
        payloadTile.isBlank = true;
      }
      tiles.push(payloadTile);
    }
  }

  if (tiles.length === 0) {
    return null;
  }

  return {
    boardSize: resolvedBoardSize,
    mode: mode === "mini" ? "mini" : "classic",
    tiles,
  };
};

export const isValidCompletedBoardTilesPayload = (payload) => {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.boardSize !== "number" || payload.boardSize <= 0) {
    return false;
  }
  if (!Array.isArray(payload.tiles) || payload.tiles.length === 0) {
    return false;
  }

  return payload.tiles.every((tile) => {
    if (!tile || typeof tile !== "object") return false;
    if (!Number.isInteger(tile.row) || !Number.isInteger(tile.col)) return false;
    if (tile.row < 0 || tile.col < 0) return false;
    if (tile.row >= payload.boardSize || tile.col >= payload.boardSize) {
      return false;
    }
    return typeof tile.letter === "string" && tile.letter.trim().length === 1;
  });
};

export const buildBoardFromCompletedBoardTiles = (payload) => {
  if (!isValidCompletedBoardTilesPayload(payload)) {
    return null;
  }

  const board = Array(payload.boardSize)
    .fill(null)
    .map(() => Array(payload.boardSize).fill(null));

  payload.tiles.forEach((tile, index) => {
    board[tile.row][tile.col] = {
      id: `completed-${index}`,
      letter: tile.letter.trim().toUpperCase(),
      value:
        tile.isBlank === true
          ? 0
          : TILE_DISTRIBUTION[tile.letter.trim().toUpperCase()]?.value ?? 0,
      isBlank: tile.isBlank === true,
      scored: true,
    };
  });

  return board;
};
import { TILE_DISTRIBUTION } from "../game/shared/bag";
