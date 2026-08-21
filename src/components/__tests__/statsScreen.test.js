import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import StatsScreen from "../StatsScreen";

jest.mock("../../services/playerStatsService", () => ({
  PLAYER_STATS_MODE_ALL: "all",
  PLAYER_STATS_MODE_CLASSIC: "classic",
  PLAYER_STATS_MODE_CUSTOM: "custom",
  PLAYER_STATS_MODE_MINI: "mini",
  PLAYER_STATS_MODE_MULTIPLAYER: "multiplayer",
  PLAYER_STATS_MODE_RUSH: "rush",
  PLAYER_STATS_MODE_SPRINT: "sprint",
}));

const collectText = (tree) =>
  tree.root.findAllByType(Text).map((node) => {
    const value = node.props.children;
    return Array.isArray(value) ? value.join("") : String(value);
  });

describe("StatsScreen", () => {
  it("renders database-backed overview and recent results", () => {
    const tree = renderer.create(
      <StatsScreen
        statsViewModel={{
          status: "ready",
          source: "database",
          overview: {
            totalGames: 4,
            bestScore: 240,
            recentAverage: 206.7,
            bestRankLabel: "#2",
            last30Days: 4,
          },
          modeBreakdowns: {
            all: {
              gamesPlayed: 4,
              bestScore: 240,
              averageScore: 206.7,
              last7Days: 2,
              bestSprintTurns: 9,
              bestSprintDurationSeconds: 280,
            },
            rush: {
              gamesPlayed: 1,
              bestScore: 180,
              averageScore: 180,
              last7Days: 1,
            },
          },
          distribution: [{ rangeLabel: "151-200", count: 2 }],
          recentResults: [
            {
              id: "rush-1",
              sourceTable: "rush_scores",
              mode: "rush",
              seed: "20260703",
              finalScore: 180,
              durationSeconds: 300,
              completedAt: "2026-07-03T12:00:00.000Z",
            },
          ],
          rankSummaries: [],
        }}
        onBack={jest.fn()}
      />
    );

    const texts = collectText(tree);

    expect(texts).toContain("Submitted Games");
    expect(texts).toContain("4");
    expect(texts).toContain("Best Score");
    expect(texts).toContain("240");
    expect(texts).toContain("Best Global Rank");
    expect(texts).toContain("#2");
    expect(texts).toContain("Rush · 5m · 20260703");

    act(() => {
      tree.unmount();
    });
  });

  it("filters recent results when a mode tab is selected", () => {
    const tree = renderer.create(
      <StatsScreen
        statsViewModel={{
          status: "ready",
          source: "database",
          overview: {
            totalGames: 2,
            bestScore: 240,
            recentAverage: 210,
            bestRankLabel: "Unranked",
            last30Days: 2,
          },
          modeBreakdowns: {
            all: { gamesPlayed: 2, bestScore: 240, averageScore: 210, last7Days: 2 },
            sprint: {
              gamesPlayed: 1,
              bestScore: 150,
              averageScore: 150,
              last7Days: 1,
              bestSprintTurns: 9,
              bestSprintDurationSeconds: 280,
            },
          },
          distribution: [],
          recentResults: [
            {
              id: "classic-1",
              sourceTable: "scores",
              mode: "classic",
              seed: "20260701",
              finalScore: 240,
              completedAt: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "sprint-1",
              sourceTable: "sprint_scores",
              mode: "sprint",
              seed: "20260702",
              finalScore: 150,
              turnCount: 9,
              durationSeconds: 280,
              completedAt: "2026-07-02T12:00:00.000Z",
            },
          ],
          rankSummaries: [],
        }}
        onBack={jest.fn()}
      />
    );

    const sprintTab = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) =>
        node.findAllByType(Text).some((textNode) => textNode.props.children === "Sprint")
      );

    act(() => {
      sprintTab.props.onPress();
    });

    const texts = collectText(tree);

    expect(texts).toContain("9 turns");
    expect(texts).not.toContain("240 pts");

    act(() => {
      tree.unmount();
    });
  });

  it("renders local fallback notice", () => {
    const tree = renderer.create(
      <StatsScreen
        statsViewModel={{
          status: "offline",
          source: "local_fallback",
          message: "Supabase is not configured. Showing local v1 stats.",
          overview: {
            totalGames: 3,
            bestScore: 210,
            recentAverage: 165,
            bestRankLabel: "Unranked",
            last30Days: 0,
          },
          modeBreakdowns: {
            all: { gamesPlayed: 3, bestScore: 210, averageScore: 165, last7Days: 0 },
          },
          distribution: [],
          recentResults: [],
          rankSummaries: [],
        }}
        onBack={jest.fn()}
      />
    );

    expect(collectText(tree)).toContain(
      "Supabase is not configured. Showing local v1 stats."
    );

    act(() => {
      tree.unmount();
    });
  });
});
