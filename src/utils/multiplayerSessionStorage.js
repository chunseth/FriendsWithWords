import AsyncStorage from "@react-native-async-storage/async-storage";

const MULTIPLAYER_SESSION_STORAGE_KEY = "wwrf.multiplayerSession.v1";

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const sanitizePlayer = (player) => {
  if (!player || typeof player !== "object" || typeof player.id !== "string") {
    return null;
  }

  return {
    id: player.id,
    username:
      typeof player.username === "string" && player.username.trim().length > 0
        ? player.username.trim()
        : null,
    displayName:
      typeof player.displayName === "string" ? player.displayName : "Player",
    rack: Array.isArray(player.rack) ? player.rack : [],
    contribution:
      player.contribution && typeof player.contribution === "object"
        ? player.contribution
        : {
            pointsScored: 0,
            wordsPlayed: 0,
            turnsTaken: 0,
            swapsUsed: 0,
          },
    readiness:
      typeof player.readiness === "string" ? player.readiness : "waiting",
  };
};

const sanitizeMultiplayerSession = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value.sessionId !== "string" || value.sessionId.length === 0) {
    return null;
  }

  return {
    schemaVersion:
      typeof value.schemaVersion === "number" ? value.schemaVersion : 1,
    modeId: typeof value.modeId === "string" ? value.modeId : null,
    sessionId: value.sessionId,
    seed: typeof value.seed === "string" ? value.seed : null,
    status: typeof value.status === "string" ? value.status : "active",
    sharedBoard: Array.isArray(value.sharedBoard) ? value.sharedBoard : [],
    sharedPremiumSquares:
      value.sharedPremiumSquares && typeof value.sharedPremiumSquares === "object"
        ? value.sharedPremiumSquares
        : {},
    sharedScore:
      value.sharedScore && typeof value.sharedScore === "object"
        ? value.sharedScore
        : {
            total: 0,
          },
    players: Array.isArray(value.players)
      ? value.players.map(sanitizePlayer).filter(Boolean)
      : [],
    turn:
      value.turn && typeof value.turn === "object"
        ? value.turn
        : {
            number: 1,
            activePlayerId: null,
            passStreak: 0,
          },
    bag: value.bag && typeof value.bag === "object" ? value.bag : {},
    history: Array.isArray(value.history) ? value.history : [],
    boardRevision: isFiniteNumber(value.boardRevision) ? value.boardRevision : 0,
    savedAt: isFiniteNumber(value.savedAt) ? value.savedAt : Date.now(),
    lastMoveSummary:
      value.lastMoveSummary && typeof value.lastMoveSummary === "object"
        ? value.lastMoveSummary
        : null,
  };
};

export const loadMultiplayerSession = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(
      MULTIPLAYER_SESSION_STORAGE_KEY
    );
    if (!storedValue) {
      return null;
    }

    return sanitizeMultiplayerSession(JSON.parse(storedValue));
  } catch (error) {
    console.warn("Failed to load multiplayer session", error);
    return null;
  }
};

export const saveMultiplayerSession = async (session) => {
  const sanitizedSession = sanitizeMultiplayerSession(session);
  if (!sanitizedSession) {
    return null;
  }

  try {
    await AsyncStorage.setItem(
      MULTIPLAYER_SESSION_STORAGE_KEY,
      JSON.stringify(sanitizedSession)
    );
  } catch (error) {
    console.warn("Failed to save multiplayer session", error);
  }

  return sanitizedSession;
};

export const clearMultiplayerSession = async () => {
  try {
    await AsyncStorage.removeItem(MULTIPLAYER_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear multiplayer session", error);
  }
};
