import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameBoard from "../components/GameBoard";
import GameBoardMini from "../components/GameBoardMini";
import {
  buildBoardPlayerScript,
  commitCandidateForPosition,
  getCandidateMovesForPosition,
  previewCandidateForPosition,
} from "../game/analysis/boardPlayer";
import { getBoardLayout } from "../game/analysis/boardLayouts";

const createEmptyBoard = (size) =>
  Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));

const BoardPlayerDevScreen = ({ config }) => {
  const [error, setError] = useState(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [script, setScript] = useState(() =>
    buildBoardPlayerScript({
      seed: config?.seed || "",
      mode: config?.mode === "mini" ? "mini" : "classic",
      topWordCount: 30,
    })
  );

  useEffect(() => {
    try {
      const nextScript = buildBoardPlayerScript({
        seed: config?.seed || "",
        mode: config?.mode === "mini" ? "mini" : "classic",
        topWordCount: 30,
      });
      setScript(nextScript);
      setTurnIndex(0);
      setSelectedCandidateIndex(0);
      setError(null);
    } catch (loadError) {
      setError(loadError?.message || "Failed to build board player script.");
    }
  }, [config?.loadNonce, config?.mode, config?.seed]);

  const mode = script?.mode === "mini" ? "mini" : "classic";
  const currentTurn = script?.turns?.[turnIndex] ?? null;
  const layout = useMemo(
    () => getBoardLayout({ mode, layoutId: script?.layoutId || mode }),
    [mode, script?.layoutId]
  );

  const candidateMoves = useMemo(
    () =>
      getCandidateMovesForPosition({
        script,
        positionTurnIndex: turnIndex,
      }),
    [script, turnIndex]
  );

  const boundedCandidateIndex = useMemo(() => {
    if (!candidateMoves.length) return -1;
    return Math.min(
      Math.max(0, selectedCandidateIndex),
      candidateMoves.length - 1
    );
  }, [candidateMoves.length, selectedCandidateIndex]);

  const candidatePreview = useMemo(() => {
    if (boundedCandidateIndex < 0) return null;
    return previewCandidateForPosition({
      script,
      positionTurnIndex: turnIndex,
      candidateIndex: boundedCandidateIndex,
    });
  }, [boundedCandidateIndex, script, turnIndex]);

  const currentBoard =
    candidatePreview?.board ||
    currentTurn?.board ||
    createEmptyBoard(mode === "mini" ? 11 : 15);

  const canGoPrevious = turnIndex > 0;
  const canCommitNext = candidateMoves.length > 0;
  const pointsTotal =
    candidatePreview?.totalScoreAfterMove ??
    currentTurn?.positionState?.totalScore ??
    0;

  const handleCommitNextTurn = () => {
    if (!canCommitNext || boundedCandidateIndex < 0) return;

    try {
      const nextScript = commitCandidateForPosition({
        script,
        positionTurnIndex: turnIndex,
        candidateIndex: boundedCandidateIndex,
      });
      setScript(nextScript);
      setTurnIndex((prev) => Math.min(prev + 1, nextScript.turns.length - 1));
      setSelectedCandidateIndex(0);
      setError(null);
    } catch (commitError) {
      setError(commitError?.message || "Could not commit selected word.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Dev Board Player</Text>
      <Text style={styles.pointsValue}>{pointsTotal}</Text>
      <Text style={styles.pointsLabel}>Points</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.boardWrap}>
        {mode === "mini" ? (
          <GameBoardMini
            board={currentBoard}
            selectedCells={[]}
            premiumSquares={layout.premiumSquares}
            onCellClick={undefined}
            isDarkMode
            disableOverlayInteractions
          />
        ) : (
          <GameBoard
            board={currentBoard}
            selectedCells={[]}
            premiumSquares={layout.premiumSquares}
            onCellClick={undefined}
            BOARD_SIZE={15}
            isDarkMode
            disableOverlayInteractions
          />
        )}
      </View>

      <View style={styles.turnRow}>
        <TouchableOpacity
          style={[styles.arrowButton, !canGoPrevious ? styles.arrowDisabled : null]}
          disabled={!canGoPrevious}
          onPress={() => {
            setTurnIndex((prev) => Math.max(0, prev - 1));
            setSelectedCandidateIndex(0);
          }}
        >
          <Text style={styles.arrowText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.turnText}>Turn {turnIndex + 1}</Text>
        <TouchableOpacity
          style={[styles.arrowButton, !canCommitNext ? styles.arrowDisabled : null]}
          disabled={!canCommitNext}
          onPress={handleCommitNextTurn}
        >
          <Text style={styles.arrowText}>▶</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.playedText}>
        Last committed move: {script?.lastCommittedMove?.word || "-"}
      </Text>

      <ScrollView
        style={styles.candidateScroll}
        contentContainerStyle={styles.candidateScrollContent}
      >
        {candidateMoves.map((entry, index) => (
          <TouchableOpacity
            key={entry.id}
            style={[
              styles.candidateButton,
              index === boundedCandidateIndex ? styles.candidateButtonSelected : null,
            ]}
            onPress={() => setSelectedCandidateIndex(index)}
          >
            <Text style={styles.candidateButtonText}>
              {index + 1}. {entry.word} (+{entry.score})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 52 : 44,
  },
  title: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  pointsValue: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },
  pointsLabel: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    color: "#fca5a5",
    marginBottom: 8,
  },
  boardWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  turnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#475569",
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  turnText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
  },
  playedText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  candidateScroll: {
    flex: 1,
  },
  candidateScrollContent: {
    paddingBottom: 20,
    gap: 6,
  },
  candidateButton: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  candidateButtonSelected: {
    borderColor: "#0ea5e9",
    backgroundColor: "#172554",
  },
  candidateButtonText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 13,
  },
});

export default BoardPlayerDevScreen;
