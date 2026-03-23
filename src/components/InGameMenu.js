import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const InGameMenu = ({
  visible,
  isDarkMode = false,
  onClose,
  onOpenPlayMenu,
  onReturnToMultiplayerMenu,
  onReturnToMainMenu,
  onArchiveGame,
}) => {
  if (!visible) return null;
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

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
          <Text style={[styles.title, { color: theme.title }]}>Menu</Text>

          {onOpenPlayMenu || onReturnToMultiplayerMenu ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onReturnToMultiplayerMenu ?? onOpenPlayMenu}
            >
              <Text style={styles.primaryButtonText}>
                {onReturnToMultiplayerMenu
                  ? "Return to Multiplayer Menu"
                  : "Play Menu"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
              },
            ]}
            onPress={onReturnToMainMenu}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
              Return to Main Menu
            </Text>
          </TouchableOpacity>

          {onArchiveGame ? (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.surfaceBorder,
                },
              ]}
              onPress={onArchiveGame}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.title }]}>
                Archive Game
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.closeText }]}>
              Close
            </Text>
          </TouchableOpacity>
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
    fontSize: 26,
    fontWeight: "800",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: "#d97706",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
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
  closeButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#9a6b2f",
    fontWeight: "700",
    fontSize: 15,
  },
});

const LIGHT_THEME = {
  cardBackground: "#fffaf2",
  cardBorder: "#eadfcd",
  surface: "#fff",
  surfaceBorder: "#e2d3bb",
  title: "#2c3e50",
  closeText: "#9a6b2f",
};

const DARK_THEME = {
  cardBackground: "#1a2431",
  cardBorder: "#334155",
  surface: "#0f172a",
  surfaceBorder: "#334155",
  title: "#f8fafc",
  closeText: "#fdba74",
};

export default InGameMenu;
