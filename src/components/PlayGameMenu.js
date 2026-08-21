import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PlayGameMenu = ({
  visible,
  isDarkMode = false,
  dailyHighScore,
  dailyMiniHighScore,
  hasSavedGame,
  savedGameSeed,
  onClose,
  onDailyGame,
  onDailyMiniGame,
  onResumeSavedGame,
  onMoreOptions,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [activePanel, setActivePanel] = useState("main");

  const handleBackdropPress = () => {
    setActivePanel("main");
    onClose?.();
  };

  const closeMenu = () => {
    setActivePanel("main");
    onClose?.();
  };

  useEffect(() => {
    if (!visible) {
      setActivePanel("main");
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleBackdropPress}>
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
            {activePanel === "daily" ? "Daily Games" : "Play Game"}
          </Text>

          {activePanel === "daily" ? (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={onDailyGame}>
                <View style={styles.buttonRow}>
                  <Text style={styles.primaryButtonText}>Daily Classic</Text>
                  {dailyHighScore != null ? (
                    <Text style={styles.primaryButtonScore}>{dailyHighScore}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                  styles.orangeBorderButton,
                ]}
                onPress={onDailyMiniGame}
              >
                <View style={styles.buttonRow}>
                  <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                    Daily Mini
                  </Text>
                  {dailyMiniHighScore != null ? (
                    <Text style={[styles.secondaryButtonMeta, { color: theme.meta }]}>
                      {dailyMiniHighScore}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={styles.footerButton}
                  onPress={() => setActivePanel("main")}
                >
                  <Text style={[styles.footerButtonText, { color: theme.closeText }]}>
                    Back
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerButton} onPress={closeMenu}>
                  <Text style={[styles.footerButtonText, { color: theme.closeText }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setActivePanel("daily")}
              >
                <View style={styles.buttonRow}>
                  <Text style={styles.primaryButtonText}>Daily Games</Text>
                </View>
              </TouchableOpacity>

              {hasSavedGame ? (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.surfaceBorder,
                    },
                  ]}
                  onPress={onResumeSavedGame}
                >
                  <View style={styles.buttonRow}>
                    <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                      Resume Game
                    </Text>
                    <Text style={[styles.secondaryButtonMeta, { color: theme.meta }]}>
                      {savedGameSeed ? `Seed ${savedGameSeed}` : "Saved board"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                  styles.orangeBorderButton,
                ]}
                onPress={onMoreOptions}
              >
                <View style={styles.buttonRow}>
                  <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                    Other Modes
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeButton} onPress={closeMenu}>
                <Text style={[styles.closeButtonText, { color: theme.closeText }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
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
  closeText: "#9a6b2f",
};

const DARK_THEME = {
  modalBackground: "#1a2431",
  modalBorder: "#334155",
  surface: "#0f172a",
  surfaceBorder: "#334155",
  eyebrow: "#fdba74",
  title: "#f8fafc",
  meta: "#94a3b8",
  closeText: "#fdba74",
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
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
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 38,
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
    fontSize: 19,
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
  orangeBorderButton: {
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
  closeButton: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 16,
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

export default PlayGameMenu;
