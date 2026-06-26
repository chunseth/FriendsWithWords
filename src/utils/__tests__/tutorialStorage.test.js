jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearTutorialSeen,
  loadTutorialSeen,
  saveTutorialSeen,
} from "../tutorialStorage";

describe("tutorialStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it("defaults to unseen when no value is stored", async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await expect(loadTutorialSeen()).resolves.toBe(false);
  });

  it("loads and saves the seen flag", async () => {
    AsyncStorage.getItem.mockResolvedValue("true");

    await expect(loadTutorialSeen()).resolves.toBe(true);
    await expect(saveTutorialSeen(true)).resolves.toBe(true);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "wwrf.tutorialSeen.v1",
      "true"
    );
  });

  it("can save false and clear the flag", async () => {
    await expect(saveTutorialSeen(false)).resolves.toBe(false);
    await clearTutorialSeen();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "wwrf.tutorialSeen.v1",
      "false"
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "wwrf.tutorialSeen.v1"
    );
  });

  it("falls back to unseen when storage read fails", async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error("nope"));

    await expect(loadTutorialSeen()).resolves.toBe(false);
  });
});
