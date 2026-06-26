import React, { useMemo, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameBoard from "./GameBoard";
import GameBoardMini from "./GameBoardMini";
import {
  BOARD_SIZE as CLASSIC_BOARD_SIZE,
  MINI_BOARD_SIZE,
  createClassicPremiumSquares,
  createMiniPremiumSquares,
} from "../game/shared/premiumSquares";
import { buildBoardFromCompletedBoardTiles } from "../utils/completedBoardPayload";

const CompletedBoardScreen = ({ entry, isDarkMode = false, onBack }) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const boardLayoutRef = useRef(null);
  const boardPayload = entry?.board_tiles ?? entry?.boardTiles ?? null;
  const mode = boardPayload?.mode === "mini" ? "mini" : "classic";
  const boardSize =
    typeof boardPayload?.boardSize === "number" && boardPayload.boardSize > 0
      ? boardPayload.boardSize
      : mode === "mini"
        ? MINI_BOARD_SIZE
        : CLASSIC_BOARD_SIZE;
  const board = useMemo(
    () => buildBoardFromCompletedBoardTiles(boardPayload),
    [boardPayload]
  );
  const premiumSquares = useMemo(
    () =>
      mode === "mini" ? createMiniPremiumSquares() : createClassicPremiumSquares(),
    [mode]
  );
  const turns =
    typeof entry?.turn_penalties === "number" ? entry.turn_penalties / 2 : "-";
  const skillBonus =
    typeof entry?.skill_bonus_total === "number"
      ? entry.skill_bonus_total
      : (entry?.scrabble_bonus ?? 0) +
        (entry?.time_bonus ?? 0) +
        (entry?.consistency_bonus ?? 0);

  if (!board) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, { color: theme.backText }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>
            Completed board unavailable
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topPanel, { backgroundColor: theme.panelBackground }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityLabel="Back to high scores"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backButtonText, { color: theme.backText }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.playerInfo}>
          <Text
            style={[styles.playerName, { color: theme.primaryText }]}
            numberOfLines={1}
          >
            {entry?.display_name ?? "Player"}
          </Text>
          <Text style={[styles.playerMeta, { color: theme.secondaryText }]}>
            {mode === "mini" ? "Mini" : "Classic"} completed board
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Turns" value={turns} theme={theme} />
        <Metric label="Skill Bonus" value={skillBonus} theme={theme} />
        <Metric label="Seed" value={entry?.seed ?? "-"} theme={theme} />
      </View>

      <View style={styles.scoreSection}>
        <Text style={[styles.scoreValue, { color: theme.scoreText }]}>
          {entry?.final_score ?? "-"}
        </Text>
        <Text style={[styles.scoreLabel, { color: theme.secondaryText }]}>
          Final Score
        </Text>
      </View>

      <View style={styles.boardSection}>
        {mode === "mini" ? (
          <GameBoardMini
            board={board}
            selectedCells={[]}
            premiumSquares={premiumSquares}
            onCellClick={() => {}}
            boardLayoutRef={boardLayoutRef}
            disableOverlayInteractions
            isDarkMode={isDarkMode}
          />
        ) : (
          <GameBoard
            board={board}
            selectedCells={[]}
            premiumSquares={premiumSquares}
            onCellClick={() => {}}
            BOARD_SIZE={boardSize}
            boardLayoutRef={boardLayoutRef}
            disableOverlayInteractions
            isDarkMode={isDarkMode}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const Metric = ({ label, value, theme }) => (
  <View style={[styles.metric, { backgroundColor: theme.metricBackground }]}>
    <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>{label}</Text>
    <Text
      style={[styles.metricValue, { color: theme.primaryText }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

const LIGHT_THEME = {
  background: "#f8f4ed",
  panelBackground: "#fffaf2",
  metricBackground: "#ffffff",
  primaryText: "#22313f",
  secondaryText: "#7f8c8d",
  scoreText: "#2f6f4f",
  backText: "#9a6b2f",
};

const DARK_THEME = {
  background: "#0b1220",
  panelBackground: "#1a2431",
  metricBackground: "#4b5563",
  primaryText: "#f8fafc",
  secondaryText: "#cbd5e1",
  scoreText: "#86efac",
  backText: "#fdba74",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topPanel: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backButton: {
    minWidth: 52,
    minHeight: 40,
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "900",
  },
  playerMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  metric: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  metricValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "900",
  },
  scoreSection: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: "900",
  },
  scoreLabel: {
    marginTop: -2,
    fontSize: 13,
    fontWeight: "800",
  },
  boardSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
});

export default CompletedBoardScreen;
