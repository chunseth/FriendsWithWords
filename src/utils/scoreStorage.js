import AsyncStorage from "@react-native-async-storage/async-storage";

const SCORE_STORAGE_KEY = "wwrf.scoreRecords.v1";

const createDefaultScoreRecords = () => ({
  overallHighScore: null,
  dailySeedScores: {},
  miniOverallHighScore: null,
  miniDailySeedScores: {},
});

const sanitizeScoreRecords = (value) => {
  if (!value || typeof value !== "object") {
    return createDefaultScoreRecords();
  }

  const overallHighScore =
    typeof value.overallHighScore === "number" ? value.overallHighScore : null;
  const dailySeedScores =
    value.dailySeedScores && typeof value.dailySeedScores === "object"
      ? Object.fromEntries(
          Object.entries(value.dailySeedScores).filter(
            ([seed, score]) =>
              typeof seed === "string" && typeof score === "number"
          )
        )
      : {};
  const miniOverallHighScore =
    typeof value.miniOverallHighScore === "number"
      ? value.miniOverallHighScore
      : null;
  const miniDailySeedScores =
    value.miniDailySeedScores && typeof value.miniDailySeedScores === "object"
      ? Object.fromEntries(
          Object.entries(value.miniDailySeedScores).filter(
            ([seed, score]) =>
              typeof seed === "string" && typeof score === "number"
          )
        )
      : {};

  return {
    overallHighScore,
    dailySeedScores,
    miniOverallHighScore,
    miniDailySeedScores,
  };
};

export const getDefaultScoreRecords = createDefaultScoreRecords;

export const loadScoreRecords = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(SCORE_STORAGE_KEY);
    if (!storedValue) {
      return createDefaultScoreRecords();
    }

    return sanitizeScoreRecords(JSON.parse(storedValue));
  } catch (error) {
    console.warn("Failed to load score records", error);
    return createDefaultScoreRecords();
  }
};

export const saveScoreRecords = async (records) => {
  const sanitizedRecords = sanitizeScoreRecords(records);

  try {
    await AsyncStorage.setItem(
      SCORE_STORAGE_KEY,
      JSON.stringify(sanitizedRecords)
    );
  } catch (error) {
    console.warn("Failed to save score records", error);
  }

  return sanitizedRecords;
};

export const buildUpdatedScoreRecords = (
  existingRecords,
  finalScore,
  { dailySeed = null, mode = "classic" } = {}
) => {
  const records = sanitizeScoreRecords(existingRecords);
  const nextRecords = { ...records };
  const isMiniMode = mode === "mini";

  if (isMiniMode) {
    nextRecords.miniOverallHighScore =
      records.miniOverallHighScore == null
        ? finalScore
        : Math.max(records.miniOverallHighScore, finalScore);
    nextRecords.miniDailySeedScores = { ...records.miniDailySeedScores };

    if (dailySeed) {
      const existingDailyScore = nextRecords.miniDailySeedScores[dailySeed];
      nextRecords.miniDailySeedScores[dailySeed] =
        typeof existingDailyScore === "number"
          ? Math.max(existingDailyScore, finalScore)
          : finalScore;
    }
    return nextRecords;
  }

  nextRecords.overallHighScore =
    records.overallHighScore == null
      ? finalScore
      : Math.max(records.overallHighScore, finalScore);
  nextRecords.dailySeedScores = { ...records.dailySeedScores };

  if (dailySeed) {
    const existingDailyScore = nextRecords.dailySeedScores[dailySeed];
    nextRecords.dailySeedScores[dailySeed] =
      typeof existingDailyScore === "number"
        ? Math.max(existingDailyScore, finalScore)
        : finalScore;
  }

  return nextRecords;
};

export const getSavedDailySeeds = (records) => {
  const normalizedRecords = sanitizeScoreRecords(records);
  return Object.keys(normalizedRecords.dailySeedScores).sort((a, b) =>
    b.localeCompare(a)
  );
};
