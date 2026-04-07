import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SFSymbolIcon from "./components/SFSymbolIcon";
import BoardPlayerDevScreen from "./devtools/BoardPlayerDevScreen";
import LayoutLabDevScreen from "./devtools/LayoutLabDevScreen";

const TAB_BOARD_PLAYER = "board-player";
const TAB_LAYOUT_LAB = "layout-lab";

const formatDateSeed = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const DevBoardPlayerApp = () => {
  const [activeTool, setActiveTool] = useState(TAB_BOARD_PLAYER);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTab, setMenuTab] = useState(TAB_BOARD_PLAYER);

  const [boardMode, setBoardMode] = useState("classic");
  const [boardSeed, setBoardSeed] = useState(formatDateSeed());
  const [boardConfig, setBoardConfig] = useState({
    mode: "classic",
    seed: formatDateSeed(),
    loadNonce: 1,
  });

  const [layoutMode, setLayoutMode] = useState("classic");
  const [layoutConfig, setLayoutConfig] = useState({
    mode: "classic",
    seed: formatDateSeed(),
    loadNonce: 1,
  });

  const menuTabTitle = useMemo(
    () => (menuTab === TAB_LAYOUT_LAB ? "Layout Lab" : "Board Player"),
    [menuTab]
  );

  const handleLoadBoard = () => {
    const normalizedSeed = String(boardSeed || "").trim();
    if (!normalizedSeed) return;

    setBoardConfig((prev) => ({
      mode: boardMode === "mini" ? "mini" : "classic",
      seed: normalizedSeed,
      loadNonce: (prev?.loadNonce || 0) + 1,
    }));
    setActiveTool(TAB_BOARD_PLAYER);
    setMenuVisible(false);
  };

  const handleLoadLayout = () => {
    setLayoutConfig((prev) => ({
      mode: layoutMode === "mini" ? "mini" : "classic",
      seed: prev?.seed || formatDateSeed(),
      loadNonce: (prev?.loadNonce || 0) + 1,
    }));
    setActiveTool(TAB_LAYOUT_LAB);
    setMenuVisible(false);
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
        <View style={styles.menuRow}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              setMenuTab(activeTool);
              setMenuVisible(true);
            }}
            accessibilityLabel="Open dev tools menu"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {Platform.OS === "ios" ? (
              <SFSymbolIcon
                name="list.bullet"
                size={22}
                color="#f8fafc"
                weight="medium"
                scale="medium"
              />
            ) : (
              <Text style={styles.menuButtonText}>☰</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.screenWrap}>
          {activeTool === TAB_BOARD_PLAYER ? (
            <BoardPlayerDevScreen config={boardConfig} />
          ) : (
            <LayoutLabDevScreen config={layoutConfig} />
          )}
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dev Tools</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabButton, menuTab === TAB_BOARD_PLAYER ? styles.tabButtonActive : null]}
                onPress={() => setMenuTab(TAB_BOARD_PLAYER)}
              >
                <Text style={styles.tabButtonText}>Board Player</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, menuTab === TAB_LAYOUT_LAB ? styles.tabButtonActive : null]}
                onPress={() => setMenuTab(TAB_LAYOUT_LAB)}
              >
                <Text style={styles.tabButtonText}>Layout Lab</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>{menuTabTitle}</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeButton, (menuTab === TAB_BOARD_PLAYER ? boardMode : layoutMode) === "classic" ? styles.modeButtonActive : null]}
                onPress={() => {
                  if (menuTab === TAB_BOARD_PLAYER) setBoardMode("classic");
                  else setLayoutMode("classic");
                }}
              >
                <Text style={styles.modeButtonText}>Classic</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, (menuTab === TAB_BOARD_PLAYER ? boardMode : layoutMode) === "mini" ? styles.modeButtonActive : null]}
                onPress={() => {
                  if (menuTab === TAB_BOARD_PLAYER) setBoardMode("mini");
                  else setLayoutMode("mini");
                }}
              >
                <Text style={styles.modeButtonText}>Mini</Text>
              </TouchableOpacity>
            </View>

            {menuTab === TAB_BOARD_PLAYER ? (
              <>
                <TextInput
                  style={styles.input}
                  value={boardSeed}
                  onChangeText={setBoardSeed}
                  placeholder="Seed"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.loadButton} onPress={handleLoadBoard}>
                  <Text style={styles.loadButtonText}>Load</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.loadButton} onPress={handleLoadLayout}>
                  <Text style={styles.loadButtonText}>Load</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  menuRow: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 16,
    left: 12,
    zIndex: 20,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  menuButtonText: {
    fontSize: 20,
    color: "#f8fafc",
    lineHeight: 22,
  },
  screenWrap: {
    flex: 1,
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
    marginTop: Platform.OS === "ios" ? 100 : 74,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    gap: 8,
  },
  modalTitle: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 16,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#0f766e",
  },
  tabButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#0f766e",
  },
  modeButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  loadButton: {
    marginTop: 2,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  loadButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});

export default DevBoardPlayerApp;
