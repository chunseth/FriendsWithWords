import AsyncStorage from "@react-native-async-storage/async-storage";

const DARK_MODE_ENABLED_KEY = "wwrf.darkModeEnabled.v1";
const MUSIC_ENABLED_KEY = "wwrf.musicEnabled.v1";

export const loadDarkModeEnabledPreference = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(DARK_MODE_ENABLED_KEY);
    if (storedValue == null) {
      return true;
    }

    return storedValue === "true";
  } catch (error) {
    console.warn("Failed to load dark mode preference", error);
    return true;
  }
};

export const saveDarkModeEnabledPreference = async (enabled) => {
  const normalizedEnabled = enabled === true;

  try {
    await AsyncStorage.setItem(
      DARK_MODE_ENABLED_KEY,
      normalizedEnabled ? "true" : "false"
    );
  } catch (error) {
    console.warn("Failed to save dark mode preference", error);
  }

  return normalizedEnabled;
};

export const loadMusicEnabledPreference = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(MUSIC_ENABLED_KEY);
    if (storedValue == null) {
      return true;
    }

    return storedValue === "true";
  } catch (error) {
    console.warn("Failed to load music preference", error);
    return true;
  }
};

export const saveMusicEnabledPreference = async (enabled) => {
  const normalizedEnabled = enabled === true;

  try {
    await AsyncStorage.setItem(
      MUSIC_ENABLED_KEY,
      normalizedEnabled ? "true" : "false"
    );
  } catch (error) {
    console.warn("Failed to save music preference", error);
  }

  return normalizedEnabled;
};
