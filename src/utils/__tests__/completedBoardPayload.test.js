import {
  buildBoardFromCompletedBoardTiles,
  buildCompletedBoardTilesPayload,
  isValidCompletedBoardTilesPayload,
} from "../completedBoardPayload";

describe("completed board payload helpers", () => {
  it("serializes scored occupied board tiles only", () => {
    const board = [
      [
        { letter: "a", scored: true },
        { letter: "B", scored: false },
        null,
      ],
      [
        null,
        { letter: "c", scored: true, isBlank: true },
        { letter: "DE", scored: true },
      ],
      [null, null, null],
    ];

    expect(
      buildCompletedBoardTilesPayload({ board, boardSize: 3, mode: "mini" })
    ).toEqual({
      boardSize: 3,
      mode: "mini",
      tiles: [
        { row: 0, col: 0, letter: "A" },
        { row: 1, col: 1, letter: "C", isBlank: true },
      ],
    });
  });

  it("returns null when there are no scored tiles", () => {
    expect(
      buildCompletedBoardTilesPayload({
        board: [[{ letter: "A", scored: false }]],
        boardSize: 1,
      })
    ).toBeNull();
  });

  it("validates and reconstructs completed boards", () => {
    const payload = {
      boardSize: 2,
      mode: "classic",
      tiles: [
        { row: 0, col: 0, letter: "Q" },
        { row: 1, col: 1, letter: "I", isBlank: true },
      ],
    };

    expect(isValidCompletedBoardTilesPayload(payload)).toBe(true);
    expect(buildBoardFromCompletedBoardTiles(payload)).toEqual([
      [
        {
          id: "completed-0",
          letter: "Q",
          value: 10,
          isBlank: false,
          scored: true,
        },
        null,
      ],
      [
        null,
        {
          id: "completed-1",
          letter: "I",
          value: 0,
          isBlank: true,
          scored: true,
        },
      ],
    ]);
  });
});
