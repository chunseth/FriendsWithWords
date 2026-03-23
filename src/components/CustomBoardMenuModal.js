import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PREMIUM_COLORS = {
  tw: "#d90429",
  dw: "#ec4899",
  tl: "#1d4ed8",
  dl: "#7dd3fc",
  center: "#f59e0b",
};

const toCellKey = (row, col) => `${row},${col}`;

const BoardPreview = ({
  boardSize = 15,
  premiumSquares = {},
  previewBoardBackground = "#fff",
  previewBoardBorder = "#cbd5e1",
  previewEmptyCell = "#f8fafc",
  previewCellBorder = "#e2e8f0",
}) => {
  const indices = useMemo(
    () => Array.from({ length: boardSize }, (_, index) => index),
    [boardSize]
  );
  const cellSize = boardSize <= 11 ? 16 : 12;

  return (
    <View
      style={[
        styles.previewGrid,
        {
          width: boardSize * cellSize,
          borderColor: previewBoardBorder,
          backgroundColor: previewBoardBackground,
        },
      ]}
    >
      {indices.map((row) => (
        <View key={`row-${row}`} style={styles.previewRow}>
          {indices.map((col) => {
            const premium = premiumSquares[toCellKey(row, col)] || null;
            return (
              <View
                key={`${row}-${col}`}
                style={[
                  styles.previewCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: premium
                      ? PREMIUM_COLORS[premium] || "#e2e8f0"
                      : previewEmptyCell,
                    borderColor: previewCellBorder,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const CustomBoardMenuModal = ({
  visible,
  isDarkMode = false,
  variantsByMode = { classic: [], mini: [] },
  highScoresByMode = { classic: {}, mini: {} },
  loading = false,
  error = null,
  onRefresh,
  onPlayVariant,
  onClose,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [activeMode, setActiveMode] = useState("classic");
  const [indicesByMode, setIndicesByMode] = useState({ classic: 0, mini: 0 });
  const variants = variantsByMode[activeMode] ?? [];
  const currentIndex = Math.min(
    indicesByMode[activeMode] ?? 0,
    Math.max(variants.length - 1, 0)
  );
  const currentVariant = variants[currentIndex] ?? null;
  const currentHighScore = currentVariant
    ? highScoresByMode[activeMode]?.[currentVariant.id] ?? null
    : null;

  useEffect(() => {
    setIndicesByMode((prev) => ({
      classic: Math.min(prev.classic, Math.max((variantsByMode.classic ?? []).length - 1, 0)),
      mini: Math.min(prev.mini, Math.max((variantsByMode.mini ?? []).length - 1, 0)),
    }));
  }, [variantsByMode.classic, variantsByMode.mini]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setActiveMode("classic");
    setIndicesByMode({ classic: 0, mini: 0 });
  }, [visible]);

  const updateIndex = (nextIndex) => {
    if (variants.length === 0) {
      return;
    }
    const wrappedIndex =
      ((nextIndex % variants.length) + variants.length) % variants.length;
    setIndicesByMode((prev) => ({
      ...prev,
      [activeMode]: wrappedIndex,
    }));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.modalBackground,
              borderColor: theme.modalBorder,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeMode === "classic" ? styles.activeTabButton : null,
              ]}
              onPress={() => setActiveMode("classic")}
            >
              <Text style={[styles.tabText, { color: theme.title }]}>Classic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeMode === "mini" ? styles.activeTabButton : null,
              ]}
              onPress={() => setActiveMode("mini")}
            >
              <Text style={[styles.tabText, { color: theme.title }]}>Mini</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <Text style={[styles.messageText, { color: theme.meta }]}>Loading boards...</Text>
          ) : variants.length === 0 ? (
            <Text style={[styles.messageText, { color: theme.meta }]}>
              No playable boards found for this mode.
            </Text>
          ) : (
            <>
              <View style={styles.carouselRow}>
                <TouchableOpacity
                  style={styles.arrowButton}
                  onPress={() => updateIndex(currentIndex - 1)}
                >
                  <Text style={styles.arrowText}>{"<"}</Text>
                </TouchableOpacity>
                <Text style={[styles.variantTitle, { color: theme.title }]}>
                  {currentVariant?.layoutName || "Unnamed Board"}
                </Text>
                <TouchableOpacity
                  style={styles.arrowButton}
                  onPress={() => updateIndex(currentIndex + 1)}
                >
                  <Text style={styles.arrowText}>{">"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.scoreLine, { color: theme.meta }]}>
                {typeof currentHighScore === "number"
                  ? `Global high score: ${currentHighScore}`
                  : "Global high score: —"}
              </Text>
              <View style={styles.previewContainer}>
                <BoardPreview
                  boardSize={currentVariant?.boardSize ?? (activeMode === "mini" ? 11 : 15)}
                  premiumSquares={currentVariant?.premiumSquares ?? {}}
                  previewBoardBackground={theme.previewBoardBackground}
                  previewBoardBorder={theme.previewBoardBorder}
                  previewEmptyCell={theme.previewEmptyCell}
                  previewCellBorder={theme.previewCellBorder}
                />
              </View>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => currentVariant && onPlayVariant?.(currentVariant)}
              >
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerButton} onPress={onRefresh}>
              <Text style={[styles.footerText, { color: theme.footerText }]}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={onClose}>
              <Text style={[styles.footerText, { color: theme.footerText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const LIGHT_THEME = {
  modalBackground: "#fffaf2",
  modalBorder: "#eadfcd",
  title: "#2c3e50",
  meta: "#6b7280",
  footerText: "#9a6b2f",
  previewBoardBackground: "#fffdf8",
  previewBoardBorder: "#d9c7ac",
  previewEmptyCell: "#f5efe3",
  previewCellBorder: "#e4d8c6",
};

const DARK_THEME = {
  modalBackground: "#1a2431",
  modalBorder: "#334155",
  title: "#f8fafc",
  meta: "#94a3b8",
  footerText: "#fdba74",
  previewBoardBackground: "#0f172a",
  previewBoardBorder: "#475569",
  previewEmptyCell: "#1e293b",
  previewCellBorder: "#334155",
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 8,
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: "rgba(47, 111, 79, 0.12)",
    borderColor: "#2f6f4f",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "700",
  },
  messageText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 24,
  },
  carouselRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  arrowButton: {
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2f6f4f",
  },
  variantTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  scoreLine: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  previewContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  previewGrid: {
    borderWidth: 1,
    overflow: "hidden",
  },
  previewRow: {
    flexDirection: "row",
  },
  previewCell: {
    borderWidth: 0.5,
  },
  playButton: {
    alignSelf: "center",
    backgroundColor: "#2f6f4f",
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 10,
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  footerText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CustomBoardMenuModal;
