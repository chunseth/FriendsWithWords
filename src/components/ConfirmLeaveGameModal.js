import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const ConfirmLeaveGameModal = ({
  visible,
  onCancel,
  onConfirm,
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: theme.title }]}>Start New Game?</Text>
          <Text style={[styles.body, { color: theme.body }]}>
            Starting a new game will replace your current game or saved
            progress.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
            <Text style={styles.primaryButtonText}>Start New Game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: theme.secondaryButtonBackground,
                borderColor: theme.secondaryButtonBorder,
              },
            ]}
            onPress={onCancel}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>
              Keep Playing
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const LIGHT_THEME = {
  cardBackground: "#fffaf2",
  cardBorder: "#eadfcd",
  title: "#2c3e50",
  body: "#6b7280",
  secondaryButtonBackground: "#fff",
  secondaryButtonBorder: "#e2d3bb",
  secondaryButtonText: "#2c3e50",
};

const DARK_THEME = {
  cardBackground: "#1a2431",
  cardBorder: "#334155",
  title: "#f8fafc",
  body: "#cbd5e1",
  secondaryButtonBackground: "#111827",
  secondaryButtonBorder: "#334155",
  secondaryButtonText: "#f8fafc",
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
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
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2c3e50",
    textAlign: "center",
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#6b7280",
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#d97706",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2d3bb",
  },
  secondaryButtonText: {
    color: "#2c3e50",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
});

export default ConfirmLeaveGameModal;
