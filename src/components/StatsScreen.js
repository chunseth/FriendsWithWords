import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const formatLeaderboardPosition = ({
  backendConfigured,
  loading,
  error,
  leaderboardPosition,
}) => {
  if (!backendConfigured) {
    return "Offline";
  }

  if (loading) {
    return "Loading...";
  }

  if (error) {
    return "Unavailable";
  }

  if (typeof leaderboardPosition === "number") {
    return `#${leaderboardPosition}`;
  }

  return "Unranked";
};

const StatsCard = ({ label, value, accent = false, isDarkMode = false }) => (
  <View
    style={[
      styles.card,
      accent && styles.cardAccent,
      isDarkMode && !accent ? styles.cardDark : null,
    ]}
  >
    <Text style={[styles.cardLabel, accent && styles.cardLabelAccent, isDarkMode && !accent ? styles.cardLabelDark : null]}>
      {label}
    </Text>
    <Text style={[styles.cardValue, accent && styles.cardValueAccent, isDarkMode && !accent ? styles.cardValueDark : null]}>
      {value}
    </Text>
  </View>
);

const StatsScreen = ({
  stats,
  leaderboardPosition,
  leaderboardPositionLoading,
  leaderboardPositionError,
  backendConfigured,
  isDarkMode = false,
  onBack,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const wordsPlayed = stats?.wordsPlayed ?? 0;
  const highestScore = stats?.highestScore ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backButton, { color: theme.backButton }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.title, { color: theme.title }]}>Stats</Text>
      <Text style={[styles.subtitle, { color: theme.subtitle }]}>
        Your running totals across completed boards.
      </Text>

      <View style={styles.grid}>
        <StatsCard label="Highest Score" value={highestScore} accent isDarkMode={isDarkMode} />
        <StatsCard label="Words Played" value={wordsPlayed} isDarkMode={isDarkMode} />
        <StatsCard label="Games Played" value={gamesPlayed} isDarkMode={isDarkMode} />
        <StatsCard
          label="High Score Rank"
          value={formatLeaderboardPosition({
            backendConfigured,
            loading: leaderboardPositionLoading,
            error: leaderboardPositionError,
            leaderboardPosition,
          })}
          isDarkMode={isDarkMode}
        />
      </View>

      {leaderboardPositionError ? (
        <Text style={[styles.footnote, { color: theme.footnote }]}>
          {leaderboardPositionError}
        </Text>
      ) : !backendConfigured ? (
        <Text style={[styles.footnote, { color: theme.footnote }]}>
          Connect Supabase to see your leaderboard rank.
        </Text>
      ) : (
        <Text style={[styles.footnote, { color: theme.footnote }]}>
          Rank is based on your best submitted overall score.
        </Text>
      )}
    </SafeAreaView>
  );
};

const LIGHT_THEME = {
  background: "#f8f4ed",
  backButton: "#2f6f4f",
  title: "#22313f",
  subtitle: "#6a736f",
  footnote: "#7f8c8d",
};

const DARK_THEME = {
  background: "#0b1220",
  backButton: "#86efac",
  title: "#f8fafc",
  subtitle: "#cbd5e1",
  footnote: "#94a3b8",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 42,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backButton: {
    fontSize: 18,
    fontWeight: "800",
  },
  title: {
    marginTop: 18,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 280,
  },
  grid: {
    marginTop: 28,
    gap: 16,
  },
  card: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#eadcc8",
  },
  cardAccent: {
    backgroundColor: "#d97706",
    borderColor: "#d97706",
  },
  cardDark: {
    backgroundColor: "#d1d5db",
    borderColor: "#9ca3af",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8f7a5b",
  },
  cardLabelAccent: {
    color: "rgba(255,255,255,0.76)",
  },
  cardLabelDark: {
    color: "#4b5563",
  },
  cardValue: {
    marginTop: 10,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    color: "#22313f",
  },
  cardValueAccent: {
    color: "#fff",
  },
  cardValueDark: {
    color: "#111827",
  },
  footnote: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default StatsScreen;
