import AsyncStorage from "@react-native-async-storage/async-storage";

const LEADERBOARD_CONSENT_KEY = "wwrf.leaderboardConsent.v1";

export const LEADERBOARD_CONSENT_GRANTED = "granted";
export const LEADERBOARD_CONSENT_DENIED = "denied";

const isValidConsentStatus = (value) =>
  value === LEADERBOARD_CONSENT_GRANTED ||
  value === LEADERBOARD_CONSENT_DENIED;

export const loadLeaderboardConsentStatus = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(LEADERBOARD_CONSENT_KEY);
    return isValidConsentStatus(storedValue) ? storedValue : null;
  } catch (error) {
    console.warn("Failed to load leaderboard consent status", error);
    return null;
  }
};

export const saveLeaderboardConsentStatus = async (status) => {
  if (!isValidConsentStatus(status)) {
    return null;
  }

  try {
    await AsyncStorage.setItem(LEADERBOARD_CONSENT_KEY, status);
  } catch (error) {
    console.warn("Failed to save leaderboard consent status", error);
  }

  return status;
};

export const clearLeaderboardConsentStatus = async () => {
  try {
    await AsyncStorage.removeItem(LEADERBOARD_CONSENT_KEY);
  } catch (error) {
    console.warn("Failed to clear leaderboard consent status", error);
  }
};
