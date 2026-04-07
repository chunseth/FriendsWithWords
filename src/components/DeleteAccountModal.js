import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LIGHT_THEME = {
  cardBackground: "#fffaf2",
  cardBorder: "#eadfcd",
  title: "#2c3e50",
  body: "#475569",
  detail: "#6b7280",
  deleteButtonBackground: "#b42318",
  deleteButtonText: "#fff",
  cancelButtonBackground: "#fff",
  cancelButtonBorder: "#e2d3bb",
  cancelButtonText: "#2c3e50",
};

const DARK_THEME = {
  cardBackground: "#1a2431",
  cardBorder: "#334155",
  title: "#f8fafc",
  body: "#cbd5e1",
  detail: "#94a3b8",
  deleteButtonBackground: "#ef4444",
  deleteButtonText: "#fff",
  cancelButtonBackground: "#0f172a",
  cancelButtonBorder: "#334155",
  cancelButtonText: "#f8fafc",
};

const DeleteAccountModal = ({
  visible,
  deleting = false,
  darkModeEnabled = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const theme = darkModeEnabled ? DARK_THEME : LIGHT_THEME;

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
          <Text style={[styles.title, { color: theme.title }]}>Delete Account?</Text>
          <Text style={[styles.body, { color: theme.body }]}>
            This removes your username, friend connections, friend requests, and
            active multiplayer games from Supabase.
          </Text>
          <Text style={[styles.detail, { color: theme.detail }]}>
            Leaderboard scores already submitted will stay in Supabase.
          </Text>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              { backgroundColor: theme.deleteButtonBackground },
              deleting && styles.buttonDisabled,
            ]}
            onPress={onConfirm}
            disabled={deleting}
          >
            <Text style={[styles.deleteButtonText, { color: theme.deleteButtonText }]}>
              {deleting ? "Deleting..." : "Delete Account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelButton,
              {
                backgroundColor: theme.cancelButtonBackground,
                borderColor: theme.cancelButtonBorder,
              },
              deleting && styles.buttonDisabled,
            ]}
            onPress={onCancel}
            disabled={deleting}
          >
            <Text style={[styles.cancelButtonText, { color: theme.cancelButtonText }]}>
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
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  detail: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  deleteButton: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});

export default DeleteAccountModal;
