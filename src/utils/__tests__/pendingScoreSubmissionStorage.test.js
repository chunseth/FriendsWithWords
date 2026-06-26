jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
  enqueuePendingScoreSubmission,
  loadPendingScoreSubmissions,
  markPendingScoreSubmissionAttempted,
  removePendingScoreSubmission,
} from "../pendingScoreSubmissionStorage";

const basePayload = {
  seed: "20260528",
  finalScore: 180,
  finalScoreBreakdown: {
    pointsEarned: 190,
  },
  isDailySeed: true,
  scoreMode: "solo",
  completedAt: "2026-05-28T12:00:00.000Z",
};

describe("pendingScoreSubmissionStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it("dedupes the same pending leaderboard submission", async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(
      JSON.stringify([
        {
          id: "leaderboard:solo:20260528:180:",
          kind: PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
          payload: basePayload,
          queuedAt: "2026-05-28T12:00:00.000Z",
          lastAttemptAt: null,
          attemptCount: 0,
        },
      ])
    );

    await enqueuePendingScoreSubmission(
      PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
      basePayload
    );
    await enqueuePendingScoreSubmission(
      PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
      basePayload
    );

    const lastSaved = JSON.parse(AsyncStorage.setItem.mock.calls.at(-1)[1]);
    expect(lastSaved).toHaveLength(1);
    expect(lastSaved[0].payload.completedAt).toBe(basePayload.completedAt);
  });

  it("tracks attempts and removes successful submissions", async () => {
    const storedQueue = [
      {
        id: "leaderboard:solo:20260528:180:",
        kind: PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
        payload: basePayload,
        queuedAt: "2026-05-28T12:00:00.000Z",
        lastAttemptAt: null,
        attemptCount: 0,
      },
    ];
    AsyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify(storedQueue))
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            ...storedQueue[0],
            lastAttemptAt: "2026-05-28T12:01:00.000Z",
            attemptCount: 1,
          },
        ])
      )
      .mockResolvedValueOnce(JSON.stringify(storedQueue));

    await markPendingScoreSubmissionAttempted(
      storedQueue[0].id,
      "2026-05-28T12:01:00.000Z"
    );
    const attemptedQueue = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(attemptedQueue[0].attemptCount).toBe(1);
    expect(attemptedQueue[0].lastAttemptAt).toBe("2026-05-28T12:01:00.000Z");

    await removePendingScoreSubmission(storedQueue[0].id);
    const remainingQueue = JSON.parse(AsyncStorage.setItem.mock.calls[1][1]);
    expect(remainingQueue).toEqual([]);
  });

  it("drops invalid stored entries when loading", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        { id: "broken", payload: null },
        {
          id: "leaderboard:solo:20260528:180:",
          kind: PENDING_SCORE_SUBMISSION_KIND_LEADERBOARD,
          payload: basePayload,
          queuedAt: "2026-05-28T12:00:00.000Z",
        },
      ])
    );

    const loaded = await loadPendingScoreSubmissions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("leaderboard:solo:20260528:180:");
  });
});
