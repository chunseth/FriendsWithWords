import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MultiplayerPlayGamePanel = ({
  visible,
  friendName,
  dailySeed,
  onClose,
  onDailyGame,
  onNewGameRandom,
  onNewGameWithSeed,
}) => {
  const [seedInput, setSeedInput] = useState("");

  const trimmedSeed = useMemo(() => seedInput.trim(), [seedInput]);
  const canPlayCustomSeed = trimmedSeed.length > 0;

  const handleDailyGame = () => {
    onDailyGame?.();
    setSeedInput("");
  };

  const handleNewGameRandom = () => {
    onNewGameRandom?.();
    setSeedInput("");
  };

  const handlePlayWithSeed = () => {
    if (!canPlayCustomSeed) {
      return;
    }
    onNewGameWithSeed?.(trimmedSeed);
    setSeedInput("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>Friends With Words</Text>
            <Text style={styles.title}>Play Game</Text>
            <Text style={styles.subtitle}>
              {friendName ? `Start a run with ${friendName}.` : "Start a multiplayer run."}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleDailyGame}
            >
              <View style={styles.buttonRow}>
                <Text style={styles.primaryButtonText}>Daily Game</Text>
                <Text style={styles.primaryButtonMeta}>{dailySeed}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleNewGameRandom}
            >
              <View style={styles.buttonRow}>
                <Text style={styles.secondaryButtonText}>New Game</Text>
                <Text style={styles.secondaryButtonMeta}>Random seed</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.seedSection}>
              <Text style={styles.seedSectionLabel}>Seeded run</Text>
              <View style={styles.seedRow}>
                <TextInput
                  style={styles.seedInput}
                  value={seedInput}
                  onChangeText={setSeedInput}
                  placeholder="000000"
                  placeholderTextColor="#95a5a6"
                  keyboardType={
                    Platform.OS === "ios" ? "number-pad" : "numeric"
                  }
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

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
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
    maxHeight: "88%",
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
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 4,
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
  primaryButtonMeta: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e4d7c2",
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#2c3e50",
    fontSize: 18,
    fontWeight: "800",
  },
  secondaryButtonMeta: {
    color: "#7f8c8d",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  seedSection: {
    marginTop: 6,
  },
  seedSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7a5d33",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  seedRow: {
    flexDirection: "row",
    gap: 10,
  },
  seedInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dcc9ac",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 18,
    color: "#2c3e50",
    fontWeight: "700",
  },
  playButton: {
    minWidth: 92,
    borderRadius: 14,
    backgroundColor: "#2f6f4f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  disabledButton: {
    opacity: 0.45,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  closeButton: {
    marginTop: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#9a6b2f",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default MultiplayerPlayGamePanel;
