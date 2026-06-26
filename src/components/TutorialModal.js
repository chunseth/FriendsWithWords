import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LIGHT_THEME = {
  cardBackground: "#fffaf2",
  cardBorder: "#eadfcd",
  eyebrow: "#9a6b2f",
  title: "#2c3e50",
  body: "#52616b",
  feedback: "#2f6f4f",
  warning: "#b45309",
  secondaryText: "#9a6b2f",
  secondaryBorder: "#e2d3bb",
  secondaryBackground: "#fff",
};

const DARK_THEME = {
  cardBackground: "#1a2431",
  cardBorder: "#334155",
  eyebrow: "#fdba74",
  title: "#f8fafc",
  body: "#cbd5e1",
  feedback: "#86efac",
  warning: "#fbbf24",
  secondaryText: "#fdba74",
  secondaryBorder: "#334155",
  secondaryBackground: "#0f172a",
};

const TutorialModal = ({
  visible,
  isDarkMode = false,
  step = null,
  stepIndex = 0,
  totalSteps = 0,
  feedback = null,
  completed = false,
  collapsed = false,
  onHide,
  onShow,
  onSkip,
}) => {
  if (!visible) return null;

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const title = completed
    ? "Combo increased to +4"
    : step?.word
      ? `Play ${step.word}`
      : "Tutorial";
  const body = completed
    ? "You are ready for a real board. Keep scoring 20+ to grow the combo."
    : step?.instruction ?? "Follow the highlighted move.";

  if (collapsed) {
    return (
      <View pointerEvents="box-none" style={styles.floatingOverlay}>
        <TouchableOpacity
          pointerEvents="auto"
          style={styles.floatingButton}
          onPress={onShow}
        >
          <Text style={styles.floatingButtonText}>Tutorial</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        pointerEvents="auto"
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>
          {completed
            ? "Tutorial finished"
            : `Tutorial ${stepIndex + 1} of ${totalSteps}`}
        </Text>
        <Text style={[styles.title, { color: theme.title }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.body }]}>{body}</Text>

        {step?.expectedScore != null && !completed ? (
          <Text style={[styles.meta, { color: theme.body }]}>
            Target score: {step.expectedScore}
            {step.expectedComboBonus > 0
              ? ` | Combo bonus: +${step.expectedComboBonus}`
              : ""}
          </Text>
        ) : null}

        {feedback ? (
          <Text
            style={[
              styles.feedback,
              { color: feedback.type === "error" ? theme.warning : theme.feedback },
            ]}
          >
            {feedback.text}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: theme.secondaryBackground,
                borderColor: theme.secondaryBorder,
              },
            ]}
            onPress={onSkip}
          >
            <Text
              style={[styles.secondaryButtonText, { color: theme.secondaryText }]}
            >
              {completed ? "Done" : "Skip"}
            </Text>
          </TouchableOpacity>
          {!completed ? (
            <TouchableOpacity style={styles.primaryButton} onPress={onHide}>
              <Text style={styles.primaryButtonText}>OK</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 175,
    paddingHorizontal: 12,
    alignItems: "center",
    zIndex: 2500,
  },
  floatingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 175,
    paddingHorizontal: 12,
    alignItems: "center",
    zIndex: 2500,
  },
  floatingButton: {
    backgroundColor: "#d97706",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
  },
  body: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  feedback: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1.25,
    backgroundColor: "#d97706",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});

export default TutorialModal;
