import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const SettingsModal = ({
  visible,
  leaderboardSharingEnabled = false,
  onManageLeaderboardSharing,
  onDeleteAccount,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Settings</Text>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={onManageLeaderboardSharing}
          >
            <View>
              <Text style={styles.optionLabel}>Leaderboard Sharing</Text>
              <Text style={styles.optionDetail}>
                {leaderboardSharingEnabled ? "On" : "Off"}
              </Text>
            </View>
            <Text style={styles.optionAction}>Manage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, styles.deleteOptionButton]}
            onPress={onDeleteAccount}
          >
            <View>
              <Text style={[styles.optionLabel, styles.deleteOptionLabel]}>
                Delete Account
              </Text>
              <Text style={styles.deleteOptionDetail}>
                Remove your username, friends, and multiplayer account data.
              </Text>
            </View>
            <Text style={styles.deleteOptionAction}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
  optionButton: {
    marginTop: 22,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2d3bb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "800",
    color: "#22313f",
  },
  optionDetail: {
    marginTop: 4,
    fontSize: 14,
    color: "#2f6f4f",
    fontWeight: "700",
  },
  optionAction: {
    fontSize: 15,
    color: "#d97706",
    fontWeight: "800",
  },
  deleteOptionButton: {
    marginTop: 12,
  },
  deleteOptionLabel: {
    color: "#b42318",
  },
  deleteOptionDetail: {
    marginTop: 4,
    fontSize: 14,
    color: "#7a2e1f",
    fontWeight: "600",
    maxWidth: 220,
  },
  deleteOptionAction: {
    fontSize: 15,
    color: "#b42318",
    fontWeight: "800",
  },
  cancelButton: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2d3bb",
  },
  cancelButtonText: {
    color: "#2c3e50",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
});

export default SettingsModal;
