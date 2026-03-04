import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";

const LeaderboardScreen = ({
  title = "Leaderboards",
  highScoresTitle = "High Scores",
  highScoresSubtitle = "Top 100 overall scores.",
  multiplayerTitle = "Multiplayer High Scores",
  multiplayerSubtitle = "Top 100 multiplayer scores.",
  initialPage = "highScores",
  globalLeaderboardEntries,
  globalLeaderboardLoading,
  globalLeaderboardError,
  multiplayerLeaderboardEntries,
  multiplayerLeaderboardLoading,
  multiplayerLeaderboardError,
  selectedDailySeed,
  dailyLeaderboardEntries,
  dailyLeaderboardLoading,
  dailyLeaderboardError,
  backendConfigured,
  canGoPreviousDailySeed,
  canGoNextDailySeed,
  onPreviousDailySeed,
  onNextDailySeed,
  onBack,
  onRefresh,
}) => {
  const [activePage, setActivePage] = useState(initialPage);
  const [seedCopiedVisible, setSeedCopiedVisible] = useState(false);
  const [seedCopiedPosition, setSeedCopiedPosition] = useState({
    x: 0,
    y: 0,
  });
  const [highlightedRowKey, setHighlightedRowKey] = useState(null);
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  const formatDailySeed = (seed) => {
    if (!seed || seed.length !== 8) {
      return seed;
    }

    const year = Number(seed.slice(0, 4));
    const month = Number(seed.slice(4, 6));
    const day = Number(seed.slice(6, 8));
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return seed;
    }

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (!seedCopiedVisible) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSeedCopiedVisible(false);
    }, 1800);

    return () => clearTimeout(timeoutId);
  }, [seedCopiedVisible]);

  const showSeedCopiedToast = (pageX, pageY) => {
    setSeedCopiedPosition({
      x: Math.max(20, pageX - 48),
      y: Math.max(24, pageY - 48),
    });
    setSeedCopiedVisible(true);
  };

  const handleCopySeed = (seed, event) => {
    Clipboard.setString(String(seed));
    if (event?.nativeEvent) {
      showSeedCopiedToast(event.nativeEvent.pageX, event.nativeEvent.pageY);
    } else {
      showSeedCopiedToast(120, 120);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.backHotzone} onPress={onBack} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.refreshButton}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{title}</Text>
      {seedCopiedVisible && (
        <View
          pointerEvents="none"
          style={[
            styles.seedCopiedToast,
            {
              left: seedCopiedPosition.x,
              top: seedCopiedPosition.y,
            },
          ]}
        >
          <Text style={styles.seedCopiedToastText}>Seed copied</Text>
        </View>
      )}

      <View style={styles.pageTabs}>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "highScores" && styles.pageTabActive,
          ]}
          onPress={() => setActivePage("highScores")}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "highScores" && styles.pageTabTextActive,
            ]}
          >
            {highScoresTitle}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "daily" && styles.pageTabActive,
          ]}
          onPress={() => setActivePage("daily")}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "daily" && styles.pageTabTextActive,
            ]}
          >
            Daily Seeds
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "multiplayer" && styles.pageTabActive,
          ]}
          onPress={() => setActivePage("multiplayer")}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "multiplayer" && styles.pageTabTextActive,
            ]}
          >
            Multiplayer
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {activePage === "highScores" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{highScoresTitle}</Text>
            <Text style={styles.sectionSubtitle}>{highScoresSubtitle}</Text>

            {!backendConfigured ? (
              <Text style={styles.stateText}>
                Add Supabase env values to load online leaderboard scores.
              </Text>
            ) : globalLeaderboardLoading ? (
              <Text style={styles.stateText}>Loading leaderboard...</Text>
            ) : globalLeaderboardError ? (
              <Text style={styles.errorText}>{globalLeaderboardError}</Text>
            ) : globalLeaderboardEntries.length === 0 ? (
              <Text style={styles.stateText}>No scores have been submitted yet.</Text>
            ) : (
              globalLeaderboardEntries.map((entry, index) => {
                const entryKey = `${entry.display_name}-${entry.completed_at}-${index}`;

                return (
                  <View key={entryKey} style={styles.rowWrapper}>
                    {highlightedRowKey === entryKey && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.rowHighlightOverlay,
                          { opacity: highlightOpacity },
                        ]}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.rowTouchable}
                      activeOpacity={0.85}
                      onPress={(event) => {
                        setHighlightedRowKey(entryKey);
                        highlightOpacity.stopAnimation();
                        highlightOpacity.setValue(1);
                        Animated.timing(highlightOpacity, {
                          toValue: 0,
                          duration: 300,
                          useNativeDriver: true,
                        }).start(() => {
                          setHighlightedRowKey((currentKey) =>
                            currentKey === entryKey ? null : currentKey
                          );
                        });
                        handleCopySeed(entry.seed, event);
                      }}
                    >
                      <View style={styles.row}>
                        <Text style={styles.rank}>{index + 1}</Text>
                        <View style={styles.meta}>
                          <Text style={styles.name}>{entry.display_name}</Text>
                          <Text style={styles.date}>
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text style={styles.score}>{entry.final_score}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        ) : activePage === "daily" ? (
          <View style={styles.section}>
            <View style={styles.seedNavigator}>
              <TouchableOpacity
                style={[
                  styles.seedArrow,
                  !canGoNextDailySeed && styles.seedArrowDisabled,
                ]}
                onPress={onNextDailySeed}
                disabled={!canGoNextDailySeed}
              >
                <Text style={styles.seedArrowText}>{"<"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.seedPill}
                activeOpacity={0.85}
                onPress={(event) => {
                  Clipboard.setString(String(selectedDailySeed));
                  if (event?.nativeEvent) {
                    showSeedCopiedToast(
                      event.nativeEvent.pageX,
                      event.nativeEvent.pageY
                    );
                  } else {
                    showSeedCopiedToast(120, 120);
                  }
                }}
              >
                <Text style={styles.seedPillLabel}>Daily seed</Text>
                <Text style={styles.seedPillValue}>
                  {formatDailySeed(selectedDailySeed)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.seedArrow,
                  !canGoPreviousDailySeed && styles.seedArrowDisabled,
                ]}
                onPress={onPreviousDailySeed}
                disabled={!canGoPreviousDailySeed}
              >
                <Text style={styles.seedArrowText}>{">"}</Text>
              </TouchableOpacity>
            </View>

            {!backendConfigured ? (
              <Text style={styles.stateText}>
                Add Supabase env values to load daily leaderboard scores.
              </Text>
            ) : dailyLeaderboardLoading ? (
              <Text style={styles.stateText}>Loading daily leaderboard...</Text>
            ) : dailyLeaderboardError ? (
              <Text style={styles.errorText}>{dailyLeaderboardError}</Text>
            ) : dailyLeaderboardEntries.length === 0 ? (
              <Text style={styles.stateText}>
                No submitted daily scores for this seed yet.
              </Text>
            ) : (
              dailyLeaderboardEntries.map((entry, index) => (
                <View
                  key={`${selectedDailySeed}-${entry.display_name}-${entry.completed_at}-${index}`}
                  style={styles.rowWrapper}
                >
                  <View style={styles.row}>
                    <Text style={styles.rank}>{index + 1}</Text>
                    <View style={styles.meta}>
                      <Text style={styles.name}>{entry.display_name}</Text>
                      <Text style={styles.date}>
                        {entry.completed_at
                          ? new Date(entry.completed_at).toLocaleDateString()
                          : ""}
                      </Text>
                    </View>
                    <Text style={styles.score}>{entry.final_score}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{multiplayerTitle}</Text>
            <Text style={styles.sectionSubtitle}>{multiplayerSubtitle}</Text>

            {!backendConfigured ? (
              <Text style={styles.stateText}>
                Add Supabase env values to load online leaderboard scores.
              </Text>
            ) : multiplayerLeaderboardLoading ? (
              <Text style={styles.stateText}>Loading leaderboard...</Text>
            ) : multiplayerLeaderboardError ? (
              <Text style={styles.errorText}>{multiplayerLeaderboardError}</Text>
            ) : multiplayerLeaderboardEntries.length === 0 ? (
              <Text style={styles.stateText}>No scores have been submitted yet.</Text>
            ) : (
              multiplayerLeaderboardEntries.map((entry, index) => {
                const entryKey = `${entry.display_name}-${entry.completed_at}-${index}`;

                return (
                  <View key={entryKey} style={styles.rowWrapper}>
                    {highlightedRowKey === entryKey && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.rowHighlightOverlay,
                          { opacity: highlightOpacity },
                        ]}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.rowTouchable}
                      activeOpacity={0.85}
                      onPress={(event) => {
                        setHighlightedRowKey(entryKey);
                        highlightOpacity.stopAnimation();
                        highlightOpacity.setValue(1);
                        Animated.timing(highlightOpacity, {
                          toValue: 0,
                          duration: 300,
                          useNativeDriver: true,
                        }).start(() => {
                          setHighlightedRowKey((currentKey) =>
                            currentKey === entryKey ? null : currentKey
                          );
                        });
                        handleCopySeed(entry.seed, event);
                      }}
                    >
                      <View style={styles.row}>
                        <Text style={styles.rank}>{index + 1}</Text>
                        <View style={styles.meta}>
                          <Text style={styles.name}>{entry.display_name}</Text>
                          <Text style={styles.date}>
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text style={styles.score}>{entry.final_score}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f4ed",
    paddingHorizontal: 22,
    paddingTop: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  backHotzone: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    zIndex: 1,
  },
  backButton: {
    color: "#9a6b2f",
    fontSize: 16,
    fontWeight: "800",
  },
  refreshButton: {
    color: "#2f6f4f",
    fontSize: 16,
    fontWeight: "800",
  },
  title: {
    marginTop: 18,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    color: "#22313f",
  },
  seedNavigator: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  seedArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3d3b9",
    alignItems: "center",
    justifyContent: "center",
  },
  seedArrowDisabled: {
    opacity: 0.35,
  },
  seedArrowText: {
    color: "#22313f",
    fontSize: 22,
    fontWeight: "900",
  },
  seedPill: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3d3b9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  seedPillLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8b8d7a",
    fontWeight: "700",
  },
  seedPillValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "900",
    color: "#2f6f4f",
  },
  list: {
    flex: 1,
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  seedCopiedToast: {
    position: "absolute",
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  seedCopiedToastText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  pageTabs: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  pageTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8cdbd",
    backgroundColor: "#fff8ef",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pageTabActive: {
    backgroundColor: "#fff",
    borderColor: "#c7b08a",
  },
  pageTabText: {
    textAlign: "center",
    color: "#7f8c8d",
    fontSize: 14,
    fontWeight: "800",
  },
  pageTabTextActive: {
    color: "#22313f",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: "#22313f",
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#7f8c8d",
    marginBottom: 4,
  },
  stateText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#7f8c8d",
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#b45309",
  },
  rowWrapper: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  rowTouchable: {
    zIndex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfcd",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(239, 224, 191, 0.2)",
    zIndex: 2,
  },
  rank: {
    width: 24,
    textAlign: "center",
    color: "#9a6b2f",
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    flex: 1,
  },
  name: {
    color: "#22313f",
    fontSize: 16,
    fontWeight: "800",
  },
  date: {
    marginTop: 3,
    color: "#7f8c8d",
    fontSize: 12,
  },
  score: {
    color: "#2f6f4f",
    fontSize: 20,
    fontWeight: "900",
  },
});

export default LeaderboardScreen;
