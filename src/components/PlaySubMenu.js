import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const PlaySubMenu = ({
  visible,
  isDarkMode = false,
  onClose,
  onBack,
  onNewGameRandom,
  onNewMiniRandom,
  onNewSprint,
  onNewRush,
  onNewGameWithSeed,
  onNewMiniWithSeed,
  onOpenCustomBoards,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [activePanel, setActivePanel] = useState("modes");
  const [seedInput, setSeedInput] = useState("");
  const [miniSeedInput, setMiniSeedInput] = useState("");
  const trimmedSeed = useMemo(() => seedInput.trim(), [seedInput]);
  const trimmedMiniSeed = useMemo(() => miniSeedInput.trim(), [miniSeedInput]);
  const canPlaySeededRun = trimmedSeed.length > 0;
  const canPlaySeededMiniRun = trimmedMiniSeed.length > 0;

  const closeMenu = () => {
    setActivePanel("modes");
    onClose?.();
  };

  const goBack = () => {
    if (activePanel === "standard") {
      setActivePanel("modes");
      return;
    }
    onBack?.();
  };

  const handlePlaySeededRun = () => {
    if (!canPlaySeededRun) return;
    onNewGameWithSeed?.(trimmedSeed);
    setSeedInput("");
    setActivePanel("modes");
  };

  const handlePlaySeededMiniRun = () => {
    if (!canPlaySeededMiniRun) return;
    onNewMiniWithSeed?.(trimmedMiniSeed);
    setMiniSeedInput("");
    setActivePanel("modes");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeMenu}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeMenu}>
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
          <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>
            Friends With Words
          </Text>
          <Text style={[styles.title, { color: theme.title }]}>
            {activePanel === "standard" ? "New Game" : "More Modes"}
          </Text>

          {activePanel === "standard" ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onNewGameRandom}
              >
                <View style={styles.buttonRow}>
                  <Text style={styles.primaryButtonText}>New Classic</Text>
                  <Text style={styles.primaryButtonScore}>Random seed</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                  styles.dailyMiniHighlight,
                ]}
                onPress={onNewMiniRandom}
              >
                <View style={styles.buttonRow}>
                  <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                    New Mini
                  </Text>
                  <Text style={[styles.secondaryButtonMeta, { color: theme.meta }]}>
                    Random seed
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.seedCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                  Seeded Classic
                </Text>
                <View style={styles.seedRow}>
                  <TextInput
                    style={[
                      styles.seedInput,
                      {
                        borderColor: theme.inputBorder,
                        color: theme.title,
                        backgroundColor: theme.inputBackground,
                      },
                    ]}
                    value={seedInput}
                    onChangeText={setSeedInput}
                    placeholder="000000"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={handlePlaySeededRun}
                  />
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      !canPlaySeededRun ? styles.playButtonDisabled : null,
                    ]}
                    onPress={handlePlaySeededRun}
                    disabled={!canPlaySeededRun}
                  >
                    <Text style={styles.playButtonText}>Play</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View
                style={[
                  styles.seedCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                  Seeded Mini
                </Text>
                <View style={styles.seedRow}>
                  <TextInput
                    style={[
                      styles.seedInput,
                      {
                        borderColor: theme.inputBorder,
                        color: theme.title,
                        backgroundColor: theme.inputBackground,
                      },
                    ]}
                    value={miniSeedInput}
                    onChangeText={setMiniSeedInput}
                    placeholder="000000"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={handlePlaySeededMiniRun}
                  />
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      !canPlaySeededMiniRun ? styles.playButtonDisabled : null,
                    ]}
                    onPress={handlePlaySeededMiniRun}
                    disabled={!canPlaySeededMiniRun}
                  >
                    <Text style={styles.playButtonText}>Play</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setActivePanel("standard")}
              >
                <View style={styles.buttonRow}>
                  <Text style={styles.primaryButtonText}>New Game</Text>
                  <Text style={styles.primaryButtonScore}>Seeded Games</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
                onPress={onOpenCustomBoards}
              >
                <View style={styles.buttonRow}>
                  <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                    Custom Boards
                  </Text>
                  <Text style={[styles.secondaryButtonMeta, { color: theme.meta }]}>
                    Browse boards
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
                onPress={onNewSprint}
              >
                <View style={styles.buttonRow}>
                  <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                    Sprint Mode
                  </Text>
                  <Text style={[styles.secondaryButtonMeta, { color: theme.meta }]}>
                    200 points
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.seedCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                  Rush Mode
                </Text>
                <View style={styles.rushRow}>
                  <TouchableOpacity
                    style={[styles.playButton, styles.rushButton]}
                    onPress={() => onNewRush?.(300)}
                  >
                    <Text style={styles.playButtonText}>5 min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playButton, styles.rushButton]}
                    onPress={() => onNewRush?.(600)}
                  >
                    <Text style={styles.playButtonText}>10 min</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerButton} onPress={goBack}>
              <Text style={[styles.footerButtonText, { color: theme.footerText }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={closeMenu}>
              <Text style={[styles.footerButtonText, { color: theme.footerText }]}>Close</Text>
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
  surface: "#fff",
  surfaceBorder: "#d89f5f",
  eyebrow: "#9a6b2f",
  title: "#2c3e50",
  meta: "#7f8c8d",
  inputBorder: "#cbb89a",
  inputBackground: "#fffdf8",
  inputPlaceholder: "#95a5a6",
  footerText: "#9a6b2f",
};

const DARK_THEME = {
  modalBackground: "#1a2431",
  modalBorder: "#334155",
  surface: "#0f172a",
  surfaceBorder: "#334155",
  eyebrow: "#fdba74",
  title: "#f8fafc",
  meta: "#94a3b8",
  inputBorder: "#334155",
  inputBackground: "#0b1220",
  inputPlaceholder: "#64748b",
  footerText: "#fdba74",
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#c77a2a",
    borderColor: "#9a5a1a",
    borderWidth: 1,
    borderRadius: 14,
    width: "92%",
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  primaryButtonScore: {
    color: "#fff3e0",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    width: "92%",
    alignSelf: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  dailyMiniHighlight: {
    borderColor: "#c77a2a",
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 19,
    fontWeight: "800",
  },
  secondaryButtonMeta: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  seedCard: {
    borderRadius: 14,
    borderWidth: 1,
    width: "92%",
    alignSelf: "center",
    padding: 14,
    gap: 10,
    marginBottom: 6,
  },
  seedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rushRow: {
    flexDirection: "row",
    gap: 8,
  },
  seedInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  playButton: {
    height: 42,
    minWidth: 80,
    borderRadius: 12,
    backgroundColor: "#c77a2a",
    borderColor: "#9a5a1a",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rushButton: {
    flex: 1,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  footerRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
});

export default PlaySubMenu;
