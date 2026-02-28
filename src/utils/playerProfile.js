import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAYER_PROFILE_KEY = "wwrf.playerProfile.v1";

const createPlayerId = () =>
  `player_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createDefaultProfile = () => ({
  playerId: createPlayerId(),
  displayName: `Player ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
});

const sanitizeProfile = (value) => {
  if (
    value &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0
  ) {
    return {
      playerId: value.playerId,
      displayName: value.displayName.trim(),
    };
  }

  return null;
};

export const loadOrCreatePlayerProfile = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(PLAYER_PROFILE_KEY);
    if (storedValue) {
      const parsedValue = sanitizeProfile(JSON.parse(storedValue));
      if (parsedValue) {
        return parsedValue;
      }
    }
  } catch (error) {
    console.warn("Failed to load player profile", error);
  }

  const nextProfile = createDefaultProfile();

  try {
    await AsyncStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(nextProfile));
  } catch (error) {
    console.warn("Failed to save player profile", error);
  }

  return nextProfile;
};

export const savePlayerDisplayName = async (displayName) => {
  const currentProfile = await loadOrCreatePlayerProfile();
  const nextProfile = {
    ...currentProfile,
    displayName:
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : currentProfile.displayName,
  };

  try {
    await AsyncStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(nextProfile));
  } catch (error) {
    console.warn("Failed to save player profile", error);
  }

  return nextProfile;
};
