import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LIGHT_THEME = {
  cardBackground: "#fffaf2",
  cardBorder: "#eadfcd",
  title: "#2c3e50",
  optionBackground: "#fff",
  optionBorder: "#e2d3bb",
  optionLabel: "#22313f",
  optionDetail: "#2f6f4f",
  optionAction: "#d97706",
  deleteLabel: "#b42318",
  deleteDetail: "#7a2e1f",
  deleteAction: "#b42318",
  cancelBackground: "#fff",
  cancelBorder: "#e2d3bb",
  cancelText: "#2c3e50",
};

const DARK_THEME = {
  cardBackground: "#1a2431",
  cardBorder: "#334155",
  title: "#f8fafc",
  optionBackground: "#0f172a",
  optionBorder: "#334155",
  optionLabel: "#f1f5f9",
  optionDetail: "#86efac",
  optionAction: "#f59e0b",
  deleteLabel: "#fca5a5",
  deleteDetail: "#fecaca",
  deleteAction: "#fca5a5",
  cancelBackground: "#0f172a",
  cancelBorder: "#334155",
  cancelText: "#f8fafc",
};

const SettingsModal = ({
  visible,
  leaderboardSharingEnabled = false,
  multiplayerNotificationsEnabled = true,
  darkModeEnabled = false,
  musicEnabled = true,
  onToggleMultiplayerNotifications,
  onToggleDarkMode,
  onToggleMusic,
  onManageLeaderboardSharing,
  onDeleteAccount,
  onClose,
}) => {
  if (!visible) return null;

  const theme = darkModeEnabled ? DARK_THEME : LIGHT_THEME;

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
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: theme.title }]}>Settings</Text>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: theme.optionBackground,
                borderColor: theme.optionBorder,
              },
            ]}
            onPress={() =>
              onToggleMultiplayerNotifications?.(!multiplayerNotificationsEnabled)
            }
          >
            <Text style={[styles.optionLabel, { color: theme.optionLabel }]}>
              Notifications
            </Text>
            <Text style={[styles.optionValue, { color: theme.optionDetail }]}>
              {multiplayerNotificationsEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: theme.optionBackground,
                borderColor: theme.optionBorder,
              },
            ]}
            onPress={() => onToggleMusic?.(!musicEnabled)}
          >
            <Text style={[styles.optionLabel, { color: theme.optionLabel }]}>
              Music
            </Text>
            <Text style={[styles.optionValue, { color: theme.optionDetail }]}>
              {musicEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: theme.optionBackground,
                borderColor: theme.optionBorder,
              },
            ]}
            onPress={() => onToggleDarkMode?.(!darkModeEnabled)}
          >
            <Text style={[styles.optionLabel, { color: theme.optionLabel }]}>
              Dark Mode
            </Text>
            <Text style={[styles.optionValue, { color: theme.optionDetail }]}>
              {darkModeEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              {
                backgroundColor: theme.optionBackground,
                borderColor: theme.optionBorder,
              },
            ]}
            onPress={onManageLeaderboardSharing}
          >
            <Text style={[styles.optionLabel, { color: theme.optionLabel }]}>
              Leaderboard Sharing
            </Text>
            <Text style={[styles.optionValue, { color: theme.optionDetail }]}>
              {leaderboardSharingEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              styles.deleteOptionButton,
              {
                backgroundColor: theme.optionBackground,
                borderColor: theme.optionBorder,
              },
            ]}
            onPress={onDeleteAccount}
          >
            <Text style={[styles.centeredActionLabel, { color: theme.deleteAction }]}>
              Delete Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelButton,
              {
                backgroundColor: theme.cancelBackground,
                borderColor: theme.cancelBorder,
              },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.centeredActionLabel, { color: theme.cancelText }]}>
              Cancel
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
    backgroundColor: "rgba(15, 23, 42, 0.56)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  optionButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "800",
  },
  optionValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  deleteOptionButton: {
    marginTop: 12,
    justifyContent: "center",
  },
  cancelButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centeredActionLabel: {
    fontSize: 17,
    fontWeight: "800",
  },
});

export default SettingsModal;
