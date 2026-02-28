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

const StatsCard = ({ label, value, accent = false }) => (
  <View style={[styles.card, accent && styles.cardAccent]}>
    <Text style={[styles.cardLabel, accent && styles.cardLabelAccent]}>
      {label}
    </Text>
    <Text style={[styles.cardValue, accent && styles.cardValueAccent]}>
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
  onBack,
}) => {
  const wordsPlayed = stats?.wordsPlayed ?? 0;
  const highestScore = stats?.highestScore ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>
        Your running totals across completed boards.
      </Text>

      <View style={styles.grid}>
        <StatsCard label="Highest Score" value={highestScore} accent />
        <StatsCard label="Words Played" value={wordsPlayed} />
        <StatsCard label="Games Played" value={gamesPlayed} />
        <StatsCard
          label="High Score Rank"
          value={formatLeaderboardPosition({
            backendConfigured,
            loading: leaderboardPositionLoading,
            error: leaderboardPositionError,
            leaderboardPosition,
          })}
        />
      </View>

      {leaderboardPositionError ? (
        <Text style={styles.footnote}>{leaderboardPositionError}</Text>
      ) : !backendConfigured ? (
        <Text style={styles.footnote}>
          Connect Supabase to see your leaderboard rank.
        </Text>
      ) : (
        <Text style={styles.footnote}>
          Rank is based on your best submitted overall score.
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f4ed",
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 42,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backButton: {
    color: "#2f6f4f",
    fontSize: 18,
    fontWeight: "800",
  },
  title: {
    marginTop: 18,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    color: "#22313f",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: "#6a736f",
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
  footnote: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
    color: "#7f8c8d",
  },
});

export default StatsScreen;
