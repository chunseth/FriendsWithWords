import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LeaderboardConsentModal = ({
  visible,
  onAllow,
  onDeny,
  onCancel,
  showCancel = false,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={showCancel ? onCancel : onDeny}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={showCancel ? onCancel : onDeny}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Share Scores Online?</Text>
          <Text style={styles.body}>
            To join the global leaderboard, the app uploads your chosen
            username, score, board seed, and completion time to our server.
          </Text>
          <Text style={styles.detail}>
            If you keep scores private, your results stay on this device and are
            not uploaded.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onAllow}>
            <Text style={styles.primaryButtonText}>Share Scores</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onDeny}>
            <Text style={styles.secondaryButtonText}>Keep Scores Private</Text>
          </TouchableOpacity>

          {showCancel ? (
            <TouchableOpacity style={styles.tertiaryButton} onPress={onCancel}>
              <Text style={styles.tertiaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.footer}>
              You can change this later from the main menu.
            </Text>
          )}
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
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
  },
  detail: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#6b7280",
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 22,
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
  tertiaryButton: {
    marginTop: 10,
    paddingVertical: 10,
  },
  tertiaryButtonText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#6b7280",
    textAlign: "center",
  },
});

export default LeaderboardConsentModal;
