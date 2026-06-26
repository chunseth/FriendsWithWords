export const hasScoreHistory = (scoreRecords) => {
  if (!scoreRecords || typeof scoreRecords !== "object") {
    return false;
  }

  return (
    typeof scoreRecords.overallHighScore === "number" ||
    typeof scoreRecords.miniOverallHighScore === "number" ||
    Object.keys(scoreRecords.dailySeedScores ?? {}).length > 0 ||
    Object.keys(scoreRecords.miniDailySeedScores ?? {}).length > 0
  );
};

export const hasStatsHistory = (stats) => {
  if (!stats || typeof stats !== "object") {
    return false;
  }

  return (
    (stats.gamesPlayed ?? 0) > 0 ||
    (stats.wordsPlayed ?? 0) > 0 ||
    typeof stats.highestScore === "number" ||
    (Array.isArray(stats.scoreHistory) && stats.scoreHistory.length > 0)
  );
};

export const hasAnyTutorialSuppressingHistory = ({
  hadStoredPlayerProfile = false,
  scoreRecords = null,
  playerStats = null,
  savedGamePayload = null,
  leaderboardConsentStatus = null,
} = {}) =>
  hadStoredPlayerProfile === true ||
  hasScoreHistory(scoreRecords) ||
  hasStatsHistory(playerStats) ||
  savedGamePayload?.snapshot != null ||
  leaderboardConsentStatus != null;

export const resolveTutorialStartupEligibility = ({
  tutorialSeen = false,
  hadStoredPlayerProfile = false,
  scoreRecords = null,
  playerStats = null,
  savedGamePayload = null,
  leaderboardConsentStatus = null,
} = {}) => {
  if (tutorialSeen === true) {
    return { shouldShow: false, shouldMarkSeen: false };
  }

  const hasExistingHistory = hasAnyTutorialSuppressingHistory({
    hadStoredPlayerProfile,
    scoreRecords,
    playerStats,
    savedGamePayload,
    leaderboardConsentStatus,
  });

  return {
    shouldShow: !hasExistingHistory,
    shouldMarkSeen: hasExistingHistory,
  };
};
