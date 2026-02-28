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
import Clipboard from "@react-native-clipboard/clipboard";

const MenuScreen = ({
  visible,
  canDismiss,
  currentSeed,
  dailySeed,
  onClose,
  onDailyGame,
  onNewGameRandom,
  onNewGameWithSeed,
  onResetSeed,
}) => {
  const [seedInput, setSeedInput] = useState("");

  const trimmedSeed = useMemo(() => seedInput.trim(), [seedInput]);
  const canPlayCustomSeed = trimmedSeed.length > 0;

  const handleDailyGame = () => {
    onDailyGame();
    setSeedInput("");
  };

  const handleNewGameRandom = () => {
    onNewGameRandom();
    setSeedInput("");
  };

  const handlePlayWithSeed = () => {
    if (!canPlayCustomSeed) {
      return;
    }
    onNewGameWithSeed(trimmedSeed);
    setSeedInput("");
  };

  const handleResetSeed = () => {
    onResetSeed();
    setSeedInput("");
    onClose?.();
  };

  const handleCopySeed = () => {
    if (currentSeed != null && currentSeed !== "") {
      Clipboard.setString(String(currentSeed));
    }
  };

  const handleBackdropPress = () => {
    if (canDismiss) {
      onClose?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackdropPress}
      >
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          <Text style={styles.eyebrow}>Words With Real Friends</Text>
          <Text style={styles.title}>Main Menu</Text>
          <Text style={styles.subtitle}>Choose a game mode to start.</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDailyGame}
          >
            <Text style={styles.primaryButtonText}>Daily Game</Text>
            <Text style={styles.buttonMeta}>Seed {dailySeed}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleNewGameRandom}
          >
            <Text style={styles.secondaryButtonText}>New Game</Text>
            <Text style={styles.secondaryButtonMeta}>Random seed</Text>
          </TouchableOpacity>

          <View style={styles.seedSection}>
            <Text style={styles.seedSectionLabel}>Play a specific seed</Text>
            <View style={styles.seedRow}>
              <TextInput
                style={styles.seedInput}
                value={seedInput}
                onChangeText={setSeedInput}
                placeholder="000000"
                placeholderTextColor="#95a5a6"
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handlePlayWithSeed}
              />
              <TouchableOpacity
                style={[
                  styles.playButton,
                  !canPlayCustomSeed && styles.disabledButton,
                ]}
                onPress={handlePlayWithSeed}
                disabled={!canPlayCustomSeed}
              >
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>
            </View>
          </View>

          {currentSeed != null && currentSeed !== "" && (
            <View style={styles.seedDisplayRow}>
              <Text style={styles.seedLabel}>Current seed</Text>
              <Text style={styles.seedValue} numberOfLines={1}>
                {String(currentSeed)}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopySeed}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
          )}

          {canDismiss && (
            <>
              <TouchableOpacity
                style={styles.tertiaryButton}
                onPress={handleResetSeed}
              >
                <Text style={styles.tertiaryButtonText}>
                  Reset Current Seed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.46)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fffaf2",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfcd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#9a6b2f",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2c3e50",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: "#d97706",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  buttonMeta: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    marginTop: 3,
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2d3bb",
  },
  secondaryButtonText: {
    color: "#2c3e50",
    fontSize: 18,
    fontWeight: "800",
  },
  secondaryButtonMeta: {
    color: "#7f8c8d",
    fontSize: 13,
    marginTop: 3,
  },
  seedSection: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2d3bb",
  },
  seedSectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 10,
  },
  seedRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  seedInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbb89a",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 18,
    color: "#2c3e50",
    backgroundColor: "#fffdf8",
  },
  playButton: {
    backgroundColor: "#2f6f4f",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.45,
  },
  seedDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f5f1e8",
    borderRadius: 10,
  },
  seedLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7f8c8d",
  },
  seedValue: {
    flex: 1,
    fontSize: 14,
    color: "#2c3e50",
  },
  copyButton: {
    backgroundColor: "#7f8c8d",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  copyButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  tertiaryButton: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2d3bb",
  },
  tertiaryButtonText: {
    color: "#2c3e50",
    fontWeight: "700",
    fontSize: 15,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#9a6b2f",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default MenuScreen;
