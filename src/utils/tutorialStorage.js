import AsyncStorage from "@react-native-async-storage/async-storage";

const TUTORIAL_SEEN_KEY = "wwrf.tutorialSeen.v1";

export const loadTutorialSeen = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(TUTORIAL_SEEN_KEY);
    return storedValue === "true";
  } catch (error) {
    console.warn("Failed to load tutorial seen preference", error);
    return false;
  }
};

export const saveTutorialSeen = async (seen) => {
  const normalizedSeen = seen === true;

  try {
    await AsyncStorage.setItem(
      TUTORIAL_SEEN_KEY,
      normalizedSeen ? "true" : "false"
    );
  } catch (error) {
    console.warn("Failed to save tutorial seen preference", error);
  }

  return normalizedSeen;
};

export const clearTutorialSeen = async () => {
  try {
    await AsyncStorage.removeItem(TUTORIAL_SEEN_KEY);
  } catch (error) {
    console.warn("Failed to clear tutorial seen preference", error);
  }
};
