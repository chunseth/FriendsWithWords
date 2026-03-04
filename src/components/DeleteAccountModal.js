import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const DeleteAccountModal = ({ visible, deleting = false, onConfirm, onCancel }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={deleting ? undefined : onCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={deleting ? undefined : onCancel}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Delete Account?</Text>
          <Text style={styles.body}>
            This removes your username, friend connections, friend requests, and
            active multiplayer games from Supabase.
          </Text>
          <Text style={styles.detail}>
            Leaderboard scores already submitted will stay in Supabase.
          </Text>

          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.buttonDisabled]}
            onPress={onConfirm}
            disabled={deleting}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? "Deleting..." : "Delete Account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, deleting && styles.buttonDisabled]}
            onPress={onCancel}
            disabled={deleting}
          >
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
  deleteButton: {
    marginTop: 22,
    backgroundColor: "#b42318",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 12,
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
  buttonDisabled: {
    opacity: 0.65,
  },
});

export default DeleteAccountModal;
