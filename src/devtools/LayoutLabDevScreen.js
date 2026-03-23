import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import DraggablePremiumToken from "./DraggablePremiumToken";
import {
  fetchSavedLayoutLabLayouts,
  saveLayoutLabLayout,
} from "../services/layoutLabLayoutService";
import { runLayoutLabSeedScoreTestWithProgress } from "./layoutLab";
import { PREMIUM_TILE_DEFS, usePremiumTileDragDrop } from "./usePremiumTileDragDrop";

const toKey = (row, col) => `${row},${col}`;
const getBoardSizeFromMode = (mode) => (mode === "mini" ? 11 : 15);

const BOARD_PADDING = 6;
const BASE_CELL_MARGIN = 0.5;
const CELL_MARGIN = 1.5;
const MAX_CELL_SIZE = 35;

const getBoardMetrics = (boardSize) => {
  const screenWidth = Dimensions.get("window").width;
  const baseCellSize = Math.min(
    (screenWidth -
      40 -
      (boardSize - 1) * 2 * BASE_CELL_MARGIN -
      2 * BOARD_PADDING) /
      boardSize,
    MAX_CELL_SIZE
  );
  const tileSize = baseCellSize - 2;
  const cellStep = tileSize + 2 * CELL_MARGIN;
  const boardContentWidth = boardSize * cellStep;
  const boardPixelSize = 2 * BOARD_PADDING + Math.ceil(boardContentWidth) + 3;
  const boardInnerSize = boardPixelSize - 2 * BOARD_PADDING;

  return {
    boardPadding: BOARD_PADDING,
    cellMargin: CELL_MARGIN,
    tileSize,
    boardPixelSize,
    boardInnerSize,
  };
};

const DARK_SLOT_GRADIENT = [
  "rgba(255,255,255,0.22)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0)",
];

const toDateLabel = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
};

const LayoutLabDevScreen = ({ config }) => {
  const mode = config?.mode === "mini" ? "mini" : "classic";
  const boardSize = getBoardSizeFromMode(mode);
  const boardMetrics = getBoardMetrics(boardSize);
  const boardPixelSize = boardMetrics.boardPixelSize;
  const boardRef = useRef(null);

  const [saveState, setSaveState] = useState({ isSaving: false, message: "", kind: "idle" });
  const [layoutName, setLayoutName] = useState("");
  const [loadState, setLoadState] = useState({ isLoading: false, message: "", kind: "idle" });
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [testState, setTestState] = useState({
    isTesting: false,
    message: "",
    kind: "idle",
    results: [],
    yMin: 0,
    yMax: 0,
  });

  const {
    premiumSquares,
    draggingTile,
    placementCountsByType,
    premiumTileLimits,
    resetBoard,
    setPremiumSquares,
    setBoardLayout,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    centerKey,
  } = usePremiumTileDragDrop({ boardSize });

  useEffect(() => {
    resetBoard();
    setSaveState({ isSaving: false, message: "", kind: "idle" });
    setLoadState({ isLoading: false, message: "", kind: "idle" });
    setLayoutName("");
    setSavedLayouts([]);
    setLoadModalVisible(false);
    setChartModalVisible(false);
    setTestState({ isTesting: false, message: "", kind: "idle", results: [], yMin: 0, yMax: 0 });
  }, [config?.loadNonce, mode, resetBoard]);

  const placedPremiumCount = useMemo(
    () =>
      Object.values(placementCountsByType).reduce(
        (sum, count) => sum + (typeof count === "number" ? count : 0),
        0
      ),
    [placementCountsByType]
  );

  const updateBoardLayout = () => {
    if (!boardRef.current) return;
    boardRef.current.measureInWindow((x, y, width, height) => {
      const size = Math.min(width, height);
      setBoardLayout({
        x,
        y,
        size,
        width,
        height,
        boardPad: boardMetrics.boardPadding,
        cellGap: boardMetrics.cellMargin,
        cellSize: boardMetrics.tileSize,
      });
    });
  };

  const handleSaveLayout = async () => {
    if (saveState.isSaving) return;
    const trimmedName = String(layoutName || "").trim();
    if (!trimmedName) {
      setSaveState({
        isSaving: false,
        message: "Please enter a board name before saving.",
        kind: "error",
      });
      return;
    }

    setSaveState({ isSaving: true, message: "Saving layout...", kind: "pending" });

    const result = await saveLayoutLabLayout({
      mode,
      seed: config?.seed || null,
      premiumSquares,
      layoutName: trimmedName,
      metadata: {
        source: "layout_lab_dev",
        placedPremiumCount,
      },
    });

    if (!result.ok) {
      setSaveState({
        isSaving: false,
        message: `Save failed (${result.reason || "write_failed"})`,
        kind: "error",
      });
      return;
    }

    setSaveState({
      isSaving: false,
      message: `Saved ${result.layoutName}`,
      kind: "success",
    });
  };

  const handleOpenLoadLayouts = async () => {
    if (loadState.isLoading) return;
    setLoadState({ isLoading: true, message: "Loading saved layouts...", kind: "pending" });

    const result = await fetchSavedLayoutLabLayouts({ mode, limit: 100 });
    if (!result.ok) {
      setLoadState({
        isLoading: false,
        message: `Load failed (${result.reason || "fetch_failed"})`,
        kind: "error",
      });
      return;
    }

    setSavedLayouts(result.layouts || []);
    setLoadModalVisible(true);
    setLoadState({
      isLoading: false,
      message: `Loaded ${result.layouts?.length || 0} layout(s)`,
      kind: "success",
    });
  };

  const handleSelectSavedLayout = (entry) => {
    const incoming = entry?.premiumSquares;
    if (!incoming || typeof incoming !== "object") {
      setLoadState({
        isLoading: false,
        message: "Selected layout has no board data.",
        kind: "error",
      });
      return;
    }

    const next = {};
    const counts = { tw: 0, dw: 0, tl: 0, dl: 0 };

    for (const [key, value] of Object.entries(incoming)) {
      if (value === "center") continue;
      if (counts[value] == null) continue;
      if (counts[value] >= premiumTileLimits[value]) continue;
      if (!/^[0-9]+,[0-9]+$/.test(key)) continue;

      const [row, col] = key.split(",").map(Number);
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(col) ||
        row < 0 ||
        col < 0 ||
        row >= boardSize ||
        col >= boardSize
      ) {
        continue;
      }

      next[key] = value;
      counts[value] += 1;
    }

    next[centerKey] = "center";
    setPremiumSquares(next);
    setLoadModalVisible(false);
    setLoadState({
      isLoading: false,
      message: `Loaded layout from ${toDateLabel(entry.savedAt)}`,
      kind: "success",
    });
  };

  const handleTestBoard = async () => {
    if (testState.isTesting) return;

    setTestState({
      isTesting: true,
      message: "Simulating seed 1 - 0%",
      kind: "pending",
      results: [],
      yMin: 0,
      yMax: 0,
    });

    try {
      const report = await runLayoutLabSeedScoreTestWithProgress({
        mode,
        premiumSquares,
        seedCount: 5,
        yieldMs: 0,
        onProgress: ({ seedIndex, percentage }) => {
          setTestState((prev) => ({
            ...prev,
            message: `Simulating seed ${seedIndex} - ${percentage}%`,
            kind: "pending",
          }));
        },
      });

      const scores = report.results.map((entry) => entry.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);

      setTestState({
        isTesting: false,
        message: `Test complete. Min ${minScore}, Max ${maxScore}`,
        kind: "success",
        results: report.results,
        yMin: minScore - 50,
        yMax: maxScore + 50,
      });
      setChartModalVisible(true);
    } catch (error) {
      setTestState((prev) => ({
        ...prev,
        isTesting: false,
        message: `Test failed (${error?.message || "unknown_error"})`,
        kind: "error",
      }));
    }
  };

  const chartPoints = useMemo(() => {
    if (chartSize.width <= 0 || chartSize.height <= 0 || testState.results.length === 0) {
      return [];
    }

    const span = Math.max(1, testState.yMax - testState.yMin);
    const count = testState.results.length;
    const paddingX = 18;
    const width = Math.max(1, chartSize.width - paddingX * 2);

    return testState.results.map((entry, index) => {
      const xRatio = count <= 1 ? 0 : index / (count - 1);
      const yRatio = (entry.score - testState.yMin) / span;
      return {
        x: paddingX + xRatio * width,
        y: chartSize.height - yRatio * chartSize.height,
        label: String(index + 1),
      };
    });
  }, [chartSize.height, chartSize.width, testState.results, testState.yMax, testState.yMin]);

  const chartSegments = useMemo(() => {
    if (chartPoints.length < 2) return [];
    const segments = [];
    for (let index = 0; index < chartPoints.length - 1; index += 1) {
      const start = chartPoints[index];
      const end = chartPoints[index + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      segments.push({
        id: `seg-${index}`,
        left: (start.x + end.x) / 2 - length / 2,
        top: (start.y + end.y) / 2 - 1,
        width: length,
        angle,
      });
    }
    return segments;
  }, [chartPoints]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Layout Lab</Text>

      <View
        ref={boardRef}
        style={[styles.board, { width: boardPixelSize, height: boardPixelSize }]}
        onLayout={updateBoardLayout}
      >
        <View
          style={[
            styles.boardInner,
            {
              width: boardMetrics.boardInnerSize,
              height: boardMetrics.boardInnerSize,
            },
          ]}
        >
          {Array.from({ length: boardSize }).map((_, row) => (
            <View key={`row-${row}`} style={styles.row}>
              {Array.from({ length: boardSize }).map((__, col) => {
                const key = toKey(row, col);
                const tileType = premiumSquares[key] || null;
                const tileDef = PREMIUM_TILE_DEFS.find((entry) => entry.type === tileType);
                const isCenter = key === centerKey;
                const isDraggingFromThisCell =
                  draggingTile?.source === "board" && draggingTile?.fromKey === key;

                return (
                  <View
                    key={key}
                    style={[
                      styles.cell,
                      {
                        width: boardMetrics.tileSize,
                        height: boardMetrics.tileSize,
                        margin: boardMetrics.cellMargin,
                      },
                      isCenter ? styles.premiumCenterDark : null,
                      tileType === "dw" ? styles.premiumDWDark : null,
                      tileType === "tw" ? styles.premiumTWDark : null,
                      tileType === "dl" ? styles.premiumDLDark : null,
                      tileType === "tl" ? styles.premiumTLDark : null,
                    ]}
                  >
                    {isCenter ? <Text style={styles.premiumLabel}>★</Text> : null}
                    {tileDef && !isCenter ? (
                      <DraggablePremiumToken
                        tileType={tileDef.type}
                        label={tileDef.label}
                        color={tileDef.color}
                        source="board"
                        fromKey={key}
                        hidden={isDraggingFromThisCell}
                        size={Math.max(1, boardMetrics.tileSize)}
                        borderRadius={4}
                        labelSize={Math.max(9, Math.round(boardMetrics.tileSize * 0.28))}
                        style={styles.boardToken}
                        textStyle={styles.boardTokenText}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                      />
                    ) : null}
                    <LinearGradient
                      pointerEvents="none"
                      colors={DARK_SLOT_GRADIENT}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={[
                        styles.tileGradient,
                        { height: Math.max(1, Math.floor(boardMetrics.tileSize * 0.5)) },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.paletteRow}>
        {PREMIUM_TILE_DEFS.map((tile) => (
          <View key={tile.type} style={styles.paletteItem}>
            <DraggablePremiumToken
              tileType={tile.type}
              label={tile.label}
              color={tile.color}
              source="palette"
              size={34}
              borderRadius={7}
              labelSize={10}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
            <Text style={styles.tileCount}>
              {placementCountsByType[tile.type] || 0}/{premiumTileLimits[tile.type]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.saveRow}>
        <TextInput
          style={styles.layoutNameInput}
          value={layoutName}
          onChangeText={setLayoutName}
          placeholder="Board name"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={60}
        />
      </View>

      <View style={styles.saveRowButtons}>
        <TouchableOpacity
          style={[styles.saveButton, saveState.isSaving ? styles.saveButtonDisabled : null]}
          onPress={handleSaveLayout}
          disabled={saveState.isSaving}
        >
          {saveState.isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Layout</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, loadState.isLoading ? styles.saveButtonDisabled : null]}
          onPress={handleOpenLoadLayouts}
          disabled={loadState.isLoading}
        >
          {loadState.isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Load Layouts</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.saveStatusText,
          saveState.kind === "error" ? styles.saveStatusError : null,
          saveState.kind === "success" ? styles.saveStatusSuccess : null,
        ]}
      >
        {saveState.message}
      </Text>
      <Text
        style={[
          styles.saveStatusText,
          loadState.kind === "error" ? styles.saveStatusError : null,
          loadState.kind === "success" ? styles.saveStatusSuccess : null,
        ]}
      >
        {loadState.message}
      </Text>

      <View style={styles.testRow}>
        <TouchableOpacity
          style={[styles.saveButton, testState.isTesting ? styles.saveButtonDisabled : null]}
          onPress={handleTestBoard}
          disabled={testState.isTesting}
        >
          {testState.isTesting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Test Board</Text>
          )}
        </TouchableOpacity>
      </View>
      <Text
        style={[
          styles.saveStatusText,
          testState.kind === "error" ? styles.saveStatusError : null,
          testState.kind === "success" ? styles.saveStatusSuccess : null,
        ]}
      >
        {testState.message}
      </Text>

      <View style={styles.bottomBlank} />

      {draggingTile ? (
        <View
          pointerEvents="none"
          style={[
            styles.dragOverlay,
            {
              left: draggingTile.pageX - 14,
              top: draggingTile.pageY - 14,
            },
          ]}
        >
          <DraggablePremiumToken
            tileType={draggingTile.tileType}
            label={
              PREMIUM_TILE_DEFS.find((entry) => entry.type === draggingTile.tileType)?.label || "?"
            }
            color={
              PREMIUM_TILE_DEFS.find((entry) => entry.type === draggingTile.tileType)?.color ||
              "#64748b"
            }
            source="overlay"
            size={28}
            borderRadius={6}
            labelSize={10}
          />
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={loadModalVisible}
        onRequestClose={() => setLoadModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLoadModalVisible(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Saved Layouts</Text>
          <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
            {savedLayouts.length === 0 ? (
              <Text style={styles.emptyModalText}>No saved layouts found.</Text>
            ) : (
              savedLayouts.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.modalItemButton}
                  onPress={() => handleSelectSavedLayout(entry)}
                >
                  <Text style={styles.modalItemText}>{toDateLabel(entry.savedAt)}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setLoadModalVisible(false)}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={chartModalVisible}
        onRequestClose={() => setChartModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChartModalVisible(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Score Distribution (Greedy)</Text>
          <View style={styles.chartHeader}>
            <Text style={styles.chartAxisText}>Y max: {testState.yMax}</Text>
            <Text style={styles.chartAxisText}>Y min: {testState.yMin}</Text>
          </View>
          <View
            style={styles.chartPlot}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setChartSize({ width, height });
            }}
          >
            {chartSegments.map((segment) => (
              <View
                key={segment.id}
                style={[
                  styles.chartLine,
                  {
                    left: segment.left,
                    top: segment.top,
                    width: segment.width,
                    transform: [{ rotate: `${segment.angle}deg` }],
                  },
                ]}
              />
            ))}
            {chartPoints.map((point) => (
              <View
                key={`pt-${point.label}`}
                style={[
                  styles.chartPoint,
                  {
                    left: point.x - 4,
                    top: point.y - 4,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.chartXAxis}>
            {testState.results.map((entry, index) => (
              <Text key={`chart-x-${entry.index}`} style={styles.chartAxisText}>
                {index + 1}
              </Text>
            ))}
          </View>
          <Text style={styles.chartFooterText}>X: Seed index (1-5)</Text>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setChartModalVisible(false)}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 52 : 44,
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  board: {
    alignSelf: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#4b5563",
    padding: BOARD_PADDING,
    position: "relative",
  },
  boardInner: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
    overflow: "hidden",
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    backgroundColor: "#000000",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  tileGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    borderRadius: 4,
    overflow: "hidden",
  },
  premiumDWDark: {
    backgroundColor: "#D07C9A",
  },
  premiumTWDark: {
    backgroundColor: "#B0374F",
  },
  premiumDLDark: {
    backgroundColor: "#65B2DB",
  },
  premiumTLDark: {
    backgroundColor: "#2D62AD",
  },
  premiumCenterDark: {
    backgroundColor: "#D07C9A",
  },
  premiumLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  paletteRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    width: "100%",
  },
  paletteItem: {
    alignItems: "center",
    minWidth: 52,
  },
  boardToken: {
    borderColor: "transparent",
  },
  boardTokenText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tileCount: {
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
    textAlign: "center",
  },
  bottomBlank: {
    flex: 1,
  },
  saveRow: {
    marginTop: 14,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  saveRowButtons: {
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  layoutNameInput: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 13,
  },
  saveButton: {
    minWidth: 152,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  saveStatusText: {
    minHeight: 18,
    marginTop: 8,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
  },
  saveStatusError: {
    color: "#fca5a5",
  },
  saveStatusSuccess: {
    color: "#86efac",
  },
  testRow: {
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  dragOverlay: {
    position: "absolute",
    width: 28,
    height: 28,
    zIndex: 40,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3,7,18,0.55)",
  },
  modalCard: {
    marginHorizontal: 16,
    marginTop: Platform.OS === "ios" ? 96 : 72,
    marginBottom: 28,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  modalList: {
    maxHeight: 320,
  },
  modalListContent: {
    gap: 8,
  },
  modalItemButton: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  modalItemText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyModalText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  modalCloseButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chartPlot: {
    height: 180,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    position: "relative",
    overflow: "hidden",
  },
  chartLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#0ea5e9",
  },
  chartPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38bdf8",
  },
  chartXAxis: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  chartAxisText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
  },
  chartFooterText: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
  },
});

export default LayoutLabDevScreen;
