import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import LeaderboardScreen from "../LeaderboardScreen";

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
}));

describe("Leaderboard details overlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildProps = () => ({
    globalLeaderboardEntries: [
      {
        display_name: "Seth",
        seed: "20260307",
        final_score: 123,
        points_earned: 160,
        swap_penalties: 5,
        turn_penalties: 20,
        rack_penalty: 12,
        scrabble_bonus: 50,
        completed_at: "2026-03-07T00:00:00.000Z",
      },
    ],
    globalLeaderboardLoading: false,
    globalLeaderboardError: null,
    multiplayerLeaderboardEntries: [],
    multiplayerLeaderboardLoading: false,
    multiplayerLeaderboardError: null,
    selectedDailySeed: "20260307",
    dailyLeaderboardEntries: [],
    dailyLeaderboardLoading: false,
    dailyLeaderboardError: null,
    backendConfigured: true,
    canGoPreviousDailySeed: false,
    canGoNextDailySeed: false,
    onPreviousDailySeed: jest.fn(),
    onNextDailySeed: jest.fn(),
    onBack: jest.fn(),
    onRefresh: jest.fn(),
  });

  it("opens details overlay on row press and copies seed from icon action", () => {
    const tree = renderer.create(<LeaderboardScreen {...buildProps()} />);

    const rowTouchables = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) =>
        node.findAllByType(Text).some((textNode) => textNode.props.children === "Seth")
      );

    expect(rowTouchables.length).toBeGreaterThan(0);

    act(() => {
      rowTouchables[0].props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("20260307");

    const copyButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "Copy seed"
    );
    act(() => {
      copyButton.props.onPress();
    });

    expect(Clipboard.setString).toHaveBeenCalledWith("20260307");

    act(() => {
      tree.unmount();
    });
  });

  it("hides time and perfection rows in multiplayer details", () => {
    const tree = renderer.create(
      <LeaderboardScreen
        {...buildProps()}
        initialPage="multiplayer"
        multiplayerLeaderboardEntries={[
          {
            display_name: "Multi",
            seed: "20260307",
            final_score: 222,
            points_earned: 180,
            swap_penalties: 0,
            turn_penalties: 10,
            rack_penalty: 8,
            scrabble_bonus: 50,
            time_bonus: 15,
            perfection_bonus: 50,
            consistency_bonus: 6,
            completed_at: "2026-03-07T00:00:00.000Z",
          },
        ]}
      />
    );

    const rowTouchables = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) =>
        node.findAllByType(Text).some((textNode) => textNode.props.children === "Multi")
      );

    act(() => {
      rowTouchables[0].props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("Consistency bonus");
    expect(texts).not.toContain("Time bonus");
    expect(texts).not.toContain("Perfection bonus");

    act(() => {
      tree.unmount();
    });
  });

  it("opens details overlay from a daily leaderboard row tap", () => {
    const tree = renderer.create(
      <LeaderboardScreen
        {...buildProps()}
        initialPage="daily"
        dailyLeaderboardEntries={[
          {
            display_name: "Daily Champ",
            seed: "20260307",
            final_score: 301,
            points_earned: 320,
            swap_penalties: 2,
            turn_penalties: 18,
            rack_penalty: 7,
            scrabble_bonus: 50,
            consistency_bonus: 8,
            completed_at: "2026-03-07T00:00:00.000Z",
          },
        ]}
      />
    );

    const rowTouchables = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) =>
        node
          .findAllByType(Text)
          .some((textNode) => textNode.props.children === "Daily Champ")
      );

    expect(rowTouchables.length).toBeGreaterThan(0);

    act(() => {
      rowTouchables[0].props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map((node) => {
      const value = node.props.children;
      return Array.isArray(value) ? value.join("") : String(value);
    });

    expect(texts).toContain("Daily Champ");
    expect(texts).toContain("301");
    expect(texts).toContain("Points earned");

    act(() => {
      tree.unmount();
    });
  });
});
