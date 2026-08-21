import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PLAYER_STATS_MODE_ALL,
  PLAYER_STATS_MODE_CLASSIC,
  PLAYER_STATS_MODE_CUSTOM,
  PLAYER_STATS_MODE_MINI,
  PLAYER_STATS_MODE_MULTIPLAYER,
  PLAYER_STATS_MODE_RUSH,
  PLAYER_STATS_MODE_SPRINT,
} from "../services/playerStatsService";

const MODE_TABS = [
  PLAYER_STATS_MODE_ALL,
  PLAYER_STATS_MODE_CLASSIC,
  PLAYER_STATS_MODE_MINI,
  PLAYER_STATS_MODE_MULTIPLAYER,
  PLAYER_STATS_MODE_SPRINT,
  PLAYER_STATS_MODE_RUSH,
  PLAYER_STATS_MODE_CUSTOM,
];

const emptyStatsViewModel = {
  status: "loading",
  source: "database",
  message: null,
  overview: {
    totalGames: 0,
    bestScore: null,
    recentAverage: null,
    bestRankLabel: "Unranked",
    last7Days: 0,
    last30Days: 0,
  },
  modeBreakdowns: {},
  recentResults: [],
  distribution: [],
  rankSummaries: [],
};

const formatNumber = (value, fallback = "N/A") =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;

const formatAverage = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "N/A";

const formatDate = (value) => {
  if (!value) {
    return "Local v1";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDuration = (seconds) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatModeLabel = (mode) => {
  switch (mode) {
    case PLAYER_STATS_MODE_CLASSIC:
      return "Classic";
    case PLAYER_STATS_MODE_MINI:
      return "Mini";
    case PLAYER_STATS_MODE_MULTIPLAYER:
      return "Multiplayer";
    case PLAYER_STATS_MODE_SPRINT:
      return "Sprint";
    case PLAYER_STATS_MODE_RUSH:
      return "Rush";
    case PLAYER_STATS_MODE_CUSTOM:
      return "Custom";
    default:
      return "All";
  }
};

const formatResultTitle = (entry) => {
  if (entry?.mode === PLAYER_STATS_MODE_SPRINT) {
    return `${formatNumber(entry.turnCount)} turns`;
  }

  return `${formatNumber(entry?.finalScore)} pts`;
};

const formatResultMeta = (entry) => {
  const parts = [formatModeLabel(entry?.mode)];
  if (entry?.mode === PLAYER_STATS_MODE_RUSH) {
    const duration = formatDuration(entry.durationSeconds);
    if (duration) {
      parts.push(duration);
    }
  }
  if (entry?.mode === PLAYER_STATS_MODE_CUSTOM && entry.modeId) {
    parts.push(entry.modeId === "mini" ? "Mini board" : "Classic board");
  }
  if (entry?.seed) {
    parts.push(entry.seed);
  }

  return parts.join(" · ");
};

const StatsCard = ({ label, value, hint = null, accent = false, isDarkMode }) => (
  <View
    style={[
      styles.card,
      accent ? styles.cardAccent : null,
      isDarkMode && !accent ? styles.cardDark : null,
    ]}
  >
    <Text
      style={[
        styles.cardLabel,
        accent ? styles.cardLabelAccent : null,
        isDarkMode && !accent ? styles.cardLabelDark : null,
      ]}
    >
      {label}
    </Text>
    <Text
      style={[
        styles.cardValue,
        accent ? styles.cardValueAccent : null,
        isDarkMode && !accent ? styles.cardValueDark : null,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
    {hint ? (
      <Text
        style={[
          styles.cardHint,
          accent ? styles.cardHintAccent : null,
          isDarkMode && !accent ? styles.cardHintDark : null,
        ]}
      >
        {hint}
      </Text>
    ) : null}
  </View>
);

const ModeTab = ({ mode, selected, onPress, isDarkMode }) => (
  <TouchableOpacity
    style={[
      styles.modeTab,
      selected ? styles.modeTabSelected : null,
      isDarkMode && !selected ? styles.modeTabDark : null,
    ]}
    onPress={onPress}
    activeOpacity={0.84}
  >
    <Text
      style={[
        styles.modeTabText,
        selected ? styles.modeTabTextSelected : null,
        isDarkMode && !selected ? styles.modeTabTextDark : null,
      ]}
    >
      {formatModeLabel(mode)}
    </Text>
  </TouchableOpacity>
);

const StatRow = ({ label, value, isDarkMode }) => (
  <View style={styles.statRow}>
    <Text style={[styles.statRowLabel, isDarkMode ? styles.statRowLabelDark : null]}>
      {label}
    </Text>
    <Text style={[styles.statRowValue, isDarkMode ? styles.statRowValueDark : null]}>
      {value}
    </Text>
  </View>
);

const StatsScreen = ({
  statsViewModel = emptyStatsViewModel,
  isDarkMode = false,
  onBack,
  onRefresh = null,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const viewModel = statsViewModel ?? emptyStatsViewModel;
  const [selectedMode, setSelectedMode] = useState(PLAYER_STATS_MODE_ALL);
  const selectedBreakdown =
    viewModel.modeBreakdowns?.[selectedMode] ??
    viewModel.modeBreakdowns?.[PLAYER_STATS_MODE_ALL] ??
    null;
  const filteredRecentResults = useMemo(() => {
    const results = viewModel.recentResults ?? [];
    if (selectedMode === PLAYER_STATS_MODE_ALL) {
      return results;
    }
    return results.filter((entry) => entry.mode === selectedMode);
  }, [selectedMode, viewModel.recentResults]);
  const maxBucketCount = (viewModel.distribution ?? []).reduce(
    (maxValue, bucket) => Math.max(maxValue, bucket.count),
    1
  );
  const isLoading = viewModel.status === "loading";
  const sourceNotice =
    viewModel.source === "local_fallback"
      ? viewModel.message ?? "Showing local v1 stats."
      : viewModel.status === "empty"
      ? "No submitted database scores yet."
      : "Stats are built from your submitted database history.";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backTouchTarget}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.backButton, { color: theme.backButton }]}>Back</Text>
          </TouchableOpacity>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshTouchTarget}
              onPress={onRefresh}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.refreshButton, { color: theme.backButton }]}>
                Refresh
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.title, { color: theme.title }]}>Stats</Text>
        <Text style={[styles.subtitle, { color: theme.subtitle }]}>{sourceNotice}</Text>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.backButton} />
            <Text style={[styles.loadingText, { color: theme.subtitle }]}>
              Loading database history...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <StatsCard
                label="Submitted Games"
                value={formatNumber(viewModel.overview?.totalGames, "0")}
                hint={`${formatNumber(viewModel.overview?.last30Days, "0")} in the last 30 days`}
                accent
                isDarkMode={isDarkMode}
              />
              <StatsCard
                label="Best Score"
                value={formatNumber(viewModel.overview?.bestScore)}
                isDarkMode={isDarkMode}
              />
              <StatsCard
                label="Recent Average"
                value={formatAverage(viewModel.overview?.recentAverage)}
                hint="Last 10 score-based games"
                isDarkMode={isDarkMode}
              />
              <StatsCard
                label="Best Global Rank"
                value={viewModel.overview?.bestRankLabel ?? "Unranked"}
                isDarkMode={isDarkMode}
              />
            </View>

            <ScrollView
              horizontal
              style={styles.modeTabs}
              contentContainerStyle={styles.modeTabsContent}
              showsHorizontalScrollIndicator={false}
            >
              {MODE_TABS.map((mode) => (
                <ModeTab
                  key={mode}
                  mode={mode}
                  selected={selectedMode === mode}
                  onPress={() => setSelectedMode(mode)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </ScrollView>

            <View style={[styles.panel, isDarkMode ? styles.panelDark : null]}>
              <Text style={[styles.panelTitle, { color: theme.title }]}>
                {formatModeLabel(selectedMode)} Summary
              </Text>
              <StatRow
                label="Games"
                value={formatNumber(selectedBreakdown?.gamesPlayed, "0")}
                isDarkMode={isDarkMode}
              />
              <StatRow
                label="Best score"
                value={formatNumber(selectedBreakdown?.bestScore)}
                isDarkMode={isDarkMode}
              />
              <StatRow
                label="Average score"
                value={formatAverage(selectedBreakdown?.averageScore)}
                isDarkMode={isDarkMode}
              />
              <StatRow
                label="Last 7 days"
                value={formatNumber(selectedBreakdown?.last7Days, "0")}
                isDarkMode={isDarkMode}
              />
              {selectedMode === PLAYER_STATS_MODE_SPRINT ||
              selectedMode === PLAYER_STATS_MODE_ALL ? (
                <StatRow
                  label="Best sprint"
                  value={
                    selectedBreakdown?.bestSprintTurns
                      ? `${selectedBreakdown.bestSprintTurns} turns · ${formatDuration(
                          selectedBreakdown.bestSprintDurationSeconds
                        )}`
                      : "N/A"
                  }
                  isDarkMode={isDarkMode}
                />
              ) : null}
            </View>

            <View style={[styles.panel, isDarkMode ? styles.panelDark : null]}>
              <Text style={[styles.panelTitle, { color: theme.title }]}>
                Score Distribution
              </Text>
              {(viewModel.distribution ?? []).length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.subtitle }]}>
                  Submit a score-based game to populate your chart.
                </Text>
              ) : (
                <View style={styles.chartRows}>
                  {viewModel.distribution.map((bucket) => (
                    <View key={bucket.rangeLabel} style={styles.chartRow}>
                      <Text
                        style={[styles.chartBucketLabel, { color: theme.chartBucketLabel }]}
                      >
                        {bucket.rangeLabel}
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
                                (bucket.count / maxBucketCount) * 100,
                                6
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.chartCountLabel, { color: theme.chartCountLabel }]}
                      >
                        {bucket.count}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.panel, isDarkMode ? styles.panelDark : null]}>
              <Text style={[styles.panelTitle, { color: theme.title }]}>
                Recent Results
              </Text>
              {filteredRecentResults.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.subtitle }]}>
                  No recent results for this filter.
                </Text>
              ) : (
                filteredRecentResults.map((entry) => (
                  <View
                    key={`${entry.sourceTable}:${entry.id}:${entry.completedAt}`}
                    style={styles.resultRow}
                  >
                    <View style={styles.resultMain}>
                      <Text
                        style={[styles.resultTitle, isDarkMode ? styles.resultTitleDark : null]}
                      >
                        {formatResultTitle(entry)}
                      </Text>
                      <Text
                        style={[styles.resultMeta, isDarkMode ? styles.resultMetaDark : null]}
                      >
                        {formatResultMeta(entry)}
                      </Text>
                    </View>
                    <Text style={[styles.resultDate, isDarkMode ? styles.resultDateDark : null]}>
                      {formatDate(entry.completedAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const LIGHT_THEME = {
  background: "#f8f4ed",
  backButton: "#2f6f4f",
  title: "#22313f",
  subtitle: "#6a736f",
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
  chartBucketLabel: "#cbd5e1",
  chartBarTrack: "#1f2937",
  chartBarFill: "#86efac",
  chartCountLabel: "#f8fafc",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 42,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backTouchTarget: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backButton: {
    fontSize: 18,
    fontWeight: "800",
  },
  refreshTouchTarget: {
    minWidth: 72,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  refreshButton: {
    fontSize: 16,
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
  },
  loadingState: {
    marginTop: 42,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
  },
  grid: {
    marginTop: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%",
    minHeight: 126,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#eadcc8",
  },
  cardAccent: {
    backgroundColor: "#d97706",
    borderColor: "#d97706",
  },
  cardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#8f7a5b",
  },
  cardLabelAccent: {
    color: "rgba(255,255,255,0.78)",
  },
  cardLabelDark: {
    color: "#cbd5e1",
  },
  cardValue: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#22313f",
  },
  cardValueAccent: {
    color: "#fff",
  },
  cardValueDark: {
    color: "#f8fafc",
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#8f7a5b",
  },
  cardHintAccent: {
    color: "rgba(255,255,255,0.88)",
  },
  cardHintDark: {
    color: "#94a3b8",
  },
  modeTabs: {
    marginTop: 24,
  },
  modeTabsContent: {
    gap: 8,
    paddingRight: 4,
  },
  modeTab: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#eadcc8",
    backgroundColor: "#fffdf8",
  },
  modeTabDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  modeTabSelected: {
    backgroundColor: "#2f6f4f",
    borderColor: "#2f6f4f",
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6b4f2c",
  },
  modeTabTextDark: {
    color: "#cbd5e1",
  },
  modeTabTextSelected: {
    color: "#fff",
  },
  panel: {
    marginTop: 18,
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#eadcc8",
  },
  panelDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  panelTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 12,
  },
  statRow: {
    minHeight: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  statRowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6a736f",
  },
  statRowLabelDark: {
    color: "#94a3b8",
  },
  statRowValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "900",
    color: "#22313f",
  },
  statRowValueDark: {
    color: "#f8fafc",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  chartRows: {
    gap: 12,
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
    borderRadius: 8,
    overflow: "hidden",
  },
  chartBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  chartCountLabel: {
    width: 24,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
  },
  resultRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(143,122,91,0.22)",
  },
  resultMain: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    color: "#22313f",
  },
  resultTitleDark: {
    color: "#f8fafc",
  },
  resultMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#6a736f",
  },
  resultMetaDark: {
    color: "#94a3b8",
  },
  resultDate: {
    width: 92,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#8f7a5b",
  },
  resultDateDark: {
    color: "#cbd5e1",
  },
});

export default StatsScreen;
