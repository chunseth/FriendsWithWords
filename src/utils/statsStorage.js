import AsyncStorage from "@react-native-async-storage/async-storage";

const STATS_STORAGE_KEY = "wwrf.playerStats.v1";

const createDefaultStats = () => ({
  gamesPlayed: 0,
  wordsPlayed: 0,
  highestScore: null,
  scoreHistory: [],
});

const sanitizeStats = (value) => {
  if (!value || typeof value !== "object") {
    return createDefaultStats();
  }

  return {
    gamesPlayed:
      typeof value.gamesPlayed === "number" && value.gamesPlayed >= 0
        ? value.gamesPlayed
        : 0,
    wordsPlayed:
      typeof value.wordsPlayed === "number" && value.wordsPlayed >= 0
        ? value.wordsPlayed
        : 0,
    highestScore:
      typeof value.highestScore === "number" ? value.highestScore : null,
    scoreHistory: Array.isArray(value.scoreHistory)
      ? value.scoreHistory.filter(
          (score) => typeof score === "number" && Number.isFinite(score)
        )
      : [],
  };
};

export const getDefaultStats = createDefaultStats;

export const loadStats = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(STATS_STORAGE_KEY);
    if (!storedValue) {
      return createDefaultStats();
    }

    return sanitizeStats(JSON.parse(storedValue));
  } catch (error) {
    console.warn("Failed to load player stats", error);
    return createDefaultStats();
  }
};

export const saveStats = async (stats) => {
  const sanitizedStats = sanitizeStats(stats);

  try {
    await AsyncStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify(sanitizedStats)
    );
  } catch (error) {
    console.warn("Failed to save player stats", error);
  }

  return sanitizedStats;
};

export const buildUpdatedStats = (existingStats, { finalScore, wordCount }) => {
  const stats = sanitizeStats(existingStats);
  const hasValidFinalScore =
    typeof finalScore === "number" && Number.isFinite(finalScore);
  const nextScoreHistory = hasValidFinalScore
    ? [...stats.scoreHistory, finalScore]
    : [...stats.scoreHistory];

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wordsPlayed:
      stats.wordsPlayed + (typeof wordCount === "number" ? wordCount : 0),
    highestScore:
      hasValidFinalScore
        ? stats.highestScore == null
          ? finalScore
          : Math.max(stats.highestScore, finalScore)
        : stats.highestScore,
    scoreHistory: nextScoreHistory,
  };
};
