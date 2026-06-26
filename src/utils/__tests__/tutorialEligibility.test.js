jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import { resolveTutorialStartupEligibility } from "../tutorialEligibility";
import { getDefaultScoreRecords } from "../scoreStorage";
import { getDefaultStats } from "../statsStorage";

const baseInput = () => ({
  tutorialSeen: false,
  hadStoredPlayerProfile: false,
  scoreRecords: getDefaultScoreRecords(),
  playerStats: getDefaultStats(),
  savedGamePayload: null,
  leaderboardConsentStatus: null,
});

describe("tutorialEligibility", () => {
  it("auto-shows for a truly fresh local user", () => {
    expect(resolveTutorialStartupEligibility(baseInput())).toEqual({
      shouldShow: true,
      shouldMarkSeen: false,
    });
  });

  it("does nothing when the tutorial was already seen", () => {
    expect(
      resolveTutorialStartupEligibility({
        ...baseInput(),
        tutorialSeen: true,
      })
    ).toEqual({
      shouldShow: false,
      shouldMarkSeen: false,
    });
  });

  it.each([
    ["stored profile", { hadStoredPlayerProfile: true }],
    ["score record", { scoreRecords: { ...getDefaultScoreRecords(), overallHighScore: 10 } }],
    ["stats", { playerStats: { ...getDefaultStats(), gamesPlayed: 1 } }],
    ["saved game", { savedGamePayload: { snapshot: { currentSeed: "1234" } } }],
    ["leaderboard consent", { leaderboardConsentStatus: "granted" }],
  ])("suppresses and marks seen for %s history", (_label, override) => {
    expect(
      resolveTutorialStartupEligibility({
        ...baseInput(),
        ...override,
      })
    ).toEqual({
      shouldShow: false,
      shouldMarkSeen: true,
    });
  });
});
