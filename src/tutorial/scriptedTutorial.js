export const TUTORIAL_GAME_SEED = "100187";

export const TUTORIAL_GAME_TYPE = "tutorial";

export const TUTORIAL_STEPS = [
  {
    word: "FISH",
    expectedScore: 20,
    expectedComboBonus: 0,
    instruction:
      "Drag F, I, S, H onto the center row, then submit FISH.",
    success:
      "That was 20 points. Score 20+ on consecutive turns to build a combo.",
    placements: [
      { row: 7, col: 7, letter: "F" },
      { row: 7, col: 8, letter: "I" },
      { row: 7, col: 9, letter: "S" },
      { row: 7, col: 10, letter: "H" },
    ],
  },
  {
    word: "TIME",
    expectedScore: 31,
    expectedComboBonus: 0,
    instruction:
      "Build TIME above FISH. Place T, I, M, E across the highlighted row.",
    success:
      "Two 20+ turns in a row. One more starts the combo bonus.",
    placements: [
      { row: 6, col: 6, letter: "T" },
      { row: 6, col: 7, letter: "I" },
      { row: 6, col: 8, letter: "M" },
      { row: 6, col: 9, letter: "E" },
    ],
  },
  {
    word: "RED",
    expectedScore: 26,
    expectedComboBonus: 2,
    instruction:
      "Play RED for another 20+ turn. Three in a row earns +2.",
    success:
      "Combo started: +2. Keep the streak alive and the next bonus grows.",
    placements: [
      { row: 8, col: 6, letter: "R" },
      { row: 8, col: 7, letter: "E" },
      { row: 8, col: 8, letter: "D" },
    ],
  },
  {
    word: "SAW",
    expectedScore: 42,
    expectedComboBonus: 4,
    instruction:
      "Play SAW for a fourth 20+ turn. The combo bonus increases by +2 each turn.",
    success:
      "Combo boosted: +4. Your bonus so far totals +6.",
    placements: [
      { row: 5, col: 7, letter: "S" },
      { row: 5, col: 8, letter: "A" },
      { row: 5, col: 9, letter: "W" },
    ],
  },
];

const buildCellKey = ({ row, col }) => `${row},${col}`;

export const getTutorialStepTargetCells = (step) =>
  new Set((step?.placements ?? []).map(buildCellKey));

export const validateTutorialMove = (step, preparedSubmit) => {
  if (!step || !preparedSubmit) {
    return {
      ok: false,
      message: "Place the highlighted tutorial word before submitting.",
    };
  }

  const expectedCells = getTutorialStepTargetCells(step);
  const placedCells = preparedSubmit.placedCells ?? [];
  const playedWords = (preparedSubmit.newWords ?? []).map((wordData) =>
    String(wordData?.word ?? "").toUpperCase()
  );

  if (!playedWords.includes(step.word)) {
    return {
      ok: false,
      message: `This step needs ${step.word}. Move your tiles to spell ${step.word}.`,
    };
  }

  if (placedCells.length !== expectedCells.size) {
    return {
      ok: false,
      message: `Use exactly the highlighted squares for ${step.word}.`,
    };
  }

  const allCellsMatch = placedCells.every((cell) =>
    expectedCells.has(buildCellKey(cell))
  );

  if (!allCellsMatch) {
    return {
      ok: false,
      message: `Place ${step.word} on the highlighted squares.`,
    };
  }

  if (preparedSubmit.turnScore !== step.expectedScore) {
    return {
      ok: false,
      message: `This should score ${step.expectedScore}. Check the highlighted placement.`,
    };
  }

  return { ok: true };
};
