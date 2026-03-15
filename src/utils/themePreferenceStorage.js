import AsyncStorage from "@react-native-async-storage/async-storage";

const DARK_MODE_ENABLED_KEY = "wwrf.darkModeEnabled.v1";

export const loadDarkModeEnabledPreference = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(DARK_MODE_ENABLED_KEY);
    return storedValue === "true";
  } catch (error) {
    console.warn("Failed to load dark mode preference", error);
    return false;
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
