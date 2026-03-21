import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
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

const BUCKET_SIZE = 50;

const buildScoreDistribution = (scoreHistory) => {
  if (!Array.isArray(scoreHistory) || scoreHistory.length === 0) {
    return [];
  }

  const bucketCounts = new Map();
  scoreHistory.forEach((score) => {
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return;
    }
    const normalizedScore = Math.max(1, Math.trunc(score));
    const bucketEnd = Math.ceil(normalizedScore / BUCKET_SIZE) * BUCKET_SIZE;
    const bucketStart = bucketEnd - (BUCKET_SIZE - 1);
    const bucketKey = `${bucketStart}-${bucketEnd}`;
    bucketCounts.set(bucketKey, (bucketCounts.get(bucketKey) ?? 0) + 1);
  });

  return [...bucketCounts.entries()]
    .map(([rangeLabel, count]) => {
      const [rangeStartText, rangeEndText] = rangeLabel.split("-");
      const rangeStart = Number(rangeStartText);
      const rangeEnd = Number(rangeEndText);
      return {
        rangeLabel,
        rangeStart: Number.isFinite(rangeStart) ? rangeStart : 0,
        rangeEnd: Number.isFinite(rangeEnd) ? rangeEnd : 0,
        count,
      };
    })
    .sort((a, b) => a.rangeStart - b.rangeStart);
};

const StatsCard = ({
  label,
  value,
  accent = false,
  highlight = false,
  isDarkMode = false,
  hint = null,
  onPress = null,
}) => {
  const sharedStyle = [
    styles.card,
    accent && styles.cardAccent,
    highlight && styles.cardHighlight,
    isDarkMode && !accent ? styles.cardDark : null,
  ];

  const content = (
    <>
      <Text
        style={[
          styles.cardLabel,
          accent && styles.cardLabelAccent,
          highlight && styles.cardLabelHighlight,
          isDarkMode && !accent ? styles.cardLabelDark : null,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.cardValue,
          accent && styles.cardValueAccent,
          highlight && styles.cardValueHighlight,
          isDarkMode && !accent ? styles.cardValueDark : null,
        ]}
      >
        {value}
      </Text>
      {hint ? (
        <Text
          style={[
            styles.cardHint,
            accent && styles.cardHintAccent,
            highlight && styles.cardHintHighlight,
            isDarkMode && !accent ? styles.cardHintDark : null,
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={sharedStyle} onPress={onPress} activeOpacity={0.86}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={sharedStyle}>{content}</View>;
};

const StatsScreen = ({
  stats,
  scoreHistory = [],
  scoreHistoryLoading = false,
  scoreHistoryError = null,
  leaderboardPosition,
  leaderboardPositionLoading,
  leaderboardPositionError,
  backendConfigured,
  isDarkMode = false,
  onBack,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [distributionModalVisible, setDistributionModalVisible] = useState(false);
  const wordsPlayed = stats?.wordsPlayed ?? 0;
  const highestScore = stats?.highestScore ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const scoreDistribution = useMemo(() => buildScoreDistribution(scoreHistory), [scoreHistory]);
  const hasDistributionData = scoreDistribution.length > 0;
  const isTopRank =
    backendConfigured &&
    !leaderboardPositionLoading &&
    !leaderboardPositionError &&
    leaderboardPosition === 1;
  const maxBucketCount = scoreDistribution.reduce(
    (maxValue, bucketEntry) => Math.max(maxValue, bucketEntry.count),
    1
  );

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
        <StatsCard
          label="Games Played"
          value={gamesPlayed}
          hint={
            scoreHistoryLoading
              ? "Loading score history..."
              : hasDistributionData
              ? "Tap to view score distribution"
              : scoreHistoryError
              ? "Score history unavailable"
              : "No submitted scores yet"
          }
          isDarkMode={isDarkMode}
          onPress={() => setDistributionModalVisible(true)}
        />
        <StatsCard
          label={isTopRank ? "High Score Rank - Leader" : "High Score Rank"}
          value={formatLeaderboardPosition({
            backendConfigured,
            loading: leaderboardPositionLoading,
            error: leaderboardPositionError,
            leaderboardPosition,
          })}
          hint={isTopRank ? "You're currently #1 overall." : null}
          highlight={isTopRank}
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

      <Modal
        visible={distributionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDistributionModalVisible(false)}
      >
        <View style={styles.chartOverlay}>
          <Pressable
            style={styles.chartBackdrop}
            onPress={() => setDistributionModalVisible(false)}
          />
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: theme.chartCardBackground,
                borderColor: theme.chartCardBorder,
              },
            ]}
          >
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: theme.chartTitle }]}>
                Score Distribution
              </Text>
              <TouchableOpacity onPress={() => setDistributionModalVisible(false)}>
                <Text style={[styles.chartClose, { color: theme.chartClose }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.chartSubtitle, { color: theme.chartSubtitle }]}>
              Buckets are grouped in {BUCKET_SIZE}-point ranges.
            </Text>

            {scoreHistoryLoading ? (
              <Text style={[styles.chartEmptyText, { color: theme.chartEmptyText }]}>
                Loading score history...
              </Text>
            ) : scoreHistoryError ? (
              <Text style={[styles.chartEmptyText, { color: theme.chartEmptyText }]}>
                {scoreHistoryError}
              </Text>
            ) : !hasDistributionData ? (
              <Text style={[styles.chartEmptyText, { color: theme.chartEmptyText }]}>
                Submit a score to populate your chart.
              </Text>
            ) : (
              <ScrollView
                style={styles.chartScroll}
                contentContainerStyle={styles.chartScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {scoreDistribution.map((bucketEntry) => (
                  <View key={bucketEntry.rangeLabel} style={styles.chartRow}>
                    <Text style={[styles.chartBucketLabel, { color: theme.chartBucketLabel }]}>
                      {bucketEntry.rangeLabel}
                    </Text>
                    <View
                      style={[
                        styles.chartBarTrack,
                        { backgroundColor: theme.chartBarTrack },
                      ]}
                    >
                      <View
                        style={[
                          styles.chartBarFill,
                          {
                            backgroundColor: theme.chartBarFill,
                            width: `${Math.max(
                              (bucketEntry.count / maxBucketCount) * 100,
                              6
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartCountLabel, { color: theme.chartCountLabel }]}>
                      {bucketEntry.count}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const LIGHT_THEME = {
  background: "#f8f4ed",
  backButton: "#2f6f4f",
  title: "#22313f",
  subtitle: "#6a736f",
  footnote: "#7f8c8d",
  chartCardBackground: "#fffdf8",
  chartCardBorder: "#eadcc8",
  chartTitle: "#22313f",
  chartClose: "#2f6f4f",
  chartSubtitle: "#6a736f",
  chartEmptyText: "#6a736f",
  chartBucketLabel: "#6b4f2c",
  chartBarTrack: "#f1e5d4",
  chartBarFill: "#d97706",
  chartCountLabel: "#22313f",
};

const DARK_THEME = {
  background: "#0b1220",
  backButton: "#86efac",
  title: "#f8fafc",
  subtitle: "#cbd5e1",
  footnote: "#94a3b8",
  chartCardBackground: "#111827",
  chartCardBorder: "#374151",
  chartTitle: "#f8fafc",
  chartClose: "#86efac",
  chartSubtitle: "#cbd5e1",
  chartEmptyText: "#cbd5e1",
  chartBucketLabel: "#cbd5e1",
  chartBarTrack: "#1f2937",
  chartBarFill: "#86efac",
  chartCountLabel: "#f8fafc",
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
  cardHighlight: {
    backgroundColor: "#fef3c7",
    borderColor: "#d97706",
    borderWidth: 2,
    shadowColor: "#d97706",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
  cardLabelHighlight: {
    color: "#92400e",
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
  cardValueHighlight: {
    color: "#7c2d12",
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#8f7a5b",
  },
  cardHintAccent: {
    color: "rgba(255,255,255,0.86)",
  },
  cardHintDark: {
    color: "#4b5563",
  },
  cardHintHighlight: {
    color: "#92400e",
  },
  footnote: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
  },
  chartOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  chartBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    maxHeight: "70%",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  chartClose: {
    fontSize: 16,
    fontWeight: "800",
  },
  chartSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  chartEmptyText: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 20,
  },
  chartScroll: {
    marginTop: 16,
  },
  chartScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartBucketLabel: {
    width: 78,
    fontSize: 13,
    fontWeight: "700",
  },
  chartBarTrack: {
    flex: 1,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
  },
  chartBarFill: {
    height: "100%",
    borderRadius: 11,
  },
  chartCountLabel: {
    width: 24,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
  },
});

export default StatsScreen;
