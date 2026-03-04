import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PendingGameRequestModal = ({
  visible,
  friendName,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  title = "Unsend Game Request?",
  body = null,
  confirmLabel = "Unsend Request",
  confirmBusyLabel = "Unsending",
  cancelLabel = "Keep Waiting",
}) => {
  if (!visible) {
    return null;
  }

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
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            {body ??
              (friendName
                ? `This will cancel your pending game request to @${friendName}.`
                : "This will cancel your pending game request.")}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              confirmDisabled && styles.primaryButtonDisabled,
            ]}
            onPress={onConfirm}
            disabled={confirmDisabled}
          >
            <Text style={styles.primaryButtonText}>
              {confirmDisabled ? confirmBusyLabel : confirmLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
            <Text style={styles.secondaryButtonText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
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
    backgroundColor: "#b42318",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
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

export default PendingGameRequestModal;
