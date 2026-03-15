import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import SFSymbolIcon from "./SFSymbolIcon";

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
  isDarkMode = false,
  onBack,
  onRefresh,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [activePage, setActivePage] = useState(initialPage);
  const [seedCopiedVisible, setSeedCopiedVisible] = useState(false);
  const [seedCopiedPosition, setSeedCopiedPosition] = useState({
    x: 0,
    y: 0,
  });
  const [detailsEntry, setDetailsEntry] = useState(null);
  const [detailsSeedCopiedVisible, setDetailsSeedCopiedVisible] = useState(false);
  const isMultiplayerDetails = detailsEntry?.sectionLabel === "Multiplayer";

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

  useEffect(() => {
    if (!detailsSeedCopiedVisible) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setDetailsSeedCopiedVisible(false);
    }, 1400);

    return () => clearTimeout(timeoutId);
  }, [detailsSeedCopiedVisible]);

  const showSeedCopiedToast = (pageX, pageY) => {
    setSeedCopiedPosition({
      x: Math.max(20, pageX - 48),
      y: Math.max(24, pageY - 48),
    });
    setSeedCopiedVisible(true);
  };

  const handleCopySeed = (seed, event) => {
    Clipboard.setString(String(seed));
    if (detailsEntry) {
      setDetailsSeedCopiedVisible(true);
      return;
    }
    if (event?.nativeEvent) {
      showSeedCopiedToast(event.nativeEvent.pageX, event.nativeEvent.pageY);
    } else {
      showSeedCopiedToast(120, 120);
    }
  };

  const openEntryDetails = (entry, rank, sectionLabel) => {
    setDetailsEntry({
      entry,
      rank,
      sectionLabel,
    });
  };

  const getEntryDurationSeconds = (entry) => {
    if (typeof entry?.duration_seconds === "number") {
      return entry.duration_seconds;
    }
    if (typeof entry?.durationSeconds === "number") {
      return entry.durationSeconds;
    }
    if (typeof entry?.duration_ms === "number") {
      return Math.floor(entry.duration_ms / 1000);
    }
    return null;
  };

  const formatDuration = (durationSeconds) => {
    if (typeof durationSeconds !== "number" || durationSeconds < 0) {
      return null;
    }

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable style={styles.backHotzone} onPress={onBack} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backButton, { color: theme.backButton }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={[styles.refreshButton, { color: theme.refreshButton }]}>
            Refresh
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.title, { color: theme.title }]}>{title}</Text>
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
            {
              backgroundColor: theme.tabBackground,
              borderColor: theme.tabBorder,
            },
            activePage === "highScores" && styles.pageTabActive,
            activePage === "highScores" && {
              backgroundColor: theme.tabActiveBackground,
              borderColor: theme.tabActiveBorder,
            },
          ]}
          onPress={() => setActivePage("highScores")}
        >
          <Text
            style={[
              styles.pageTabText,
              { color: theme.tabText },
              activePage === "highScores" && styles.pageTabTextActive,
              activePage === "highScores" && { color: theme.tabTextActive },
            ]}
          >
            {highScoresTitle}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            {
              backgroundColor: theme.tabBackground,
              borderColor: theme.tabBorder,
            },
            activePage === "daily" && styles.pageTabActive,
            activePage === "daily" && {
              backgroundColor: theme.tabActiveBackground,
              borderColor: theme.tabActiveBorder,
            },
          ]}
          onPress={() => setActivePage("daily")}
        >
          <Text
            style={[
              styles.pageTabText,
              { color: theme.tabText },
              activePage === "daily" && styles.pageTabTextActive,
              activePage === "daily" && { color: theme.tabTextActive },
            ]}
          >
            Daily Seeds
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            {
              backgroundColor: theme.tabBackground,
              borderColor: theme.tabBorder,
            },
            activePage === "multiplayer" && styles.pageTabActive,
            activePage === "multiplayer" && {
              backgroundColor: theme.tabActiveBackground,
              borderColor: theme.tabActiveBorder,
            },
          ]}
          onPress={() => setActivePage("multiplayer")}
        >
          <Text
            style={[
              styles.pageTabText,
              { color: theme.tabText },
              activePage === "multiplayer" && styles.pageTabTextActive,
              activePage === "multiplayer" && { color: theme.tabTextActive },
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
            <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
              {highScoresTitle}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.sectionSubtitle }]}>
              {highScoresSubtitle}
            </Text>

            {!backendConfigured ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Add Supabase env values to load online leaderboard scores.
              </Text>
            ) : globalLeaderboardLoading ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Loading leaderboard...
              </Text>
            ) : globalLeaderboardError ? (
              <Text style={styles.errorText}>{globalLeaderboardError}</Text>
            ) : globalLeaderboardEntries.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                No scores have been submitted yet.
              </Text>
            ) : (
              globalLeaderboardEntries.map((entry, index) => {
                const entryKey = `${entry.display_name}-${entry.completed_at}-${index}`;

                return (
                  <View key={entryKey} style={styles.rowWrapper}>
                    <TouchableOpacity
                      style={styles.rowTouchable}
                      activeOpacity={0.85}
                      onPress={() => {
                        openEntryDetails(entry, index + 1, "High Scores");
                      }}
                    >
                      <View
                        style={[
                          styles.row,
                          {
                            backgroundColor: theme.rowBackground,
                            borderColor: theme.rowBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.rank, { color: theme.rank }]}>
                          {index + 1}
                        </Text>
                        <View style={styles.meta}>
                          <Text style={[styles.name, { color: theme.name }]}>
                            {entry.display_name}
                          </Text>
                          <Text style={[styles.date, { color: theme.date }]}>
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text style={[styles.score, { color: theme.score }]}>
                          {entry.final_score}
                        </Text>
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
                  {
                    backgroundColor: theme.seedControlBackground,
                    borderColor: theme.seedControlBorder,
                  },
                  !canGoNextDailySeed && styles.seedArrowDisabled,
                ]}
                onPress={onNextDailySeed}
                disabled={!canGoNextDailySeed}
              >
                <Text style={[styles.seedArrowText, { color: theme.seedControlText }]}>
                  {"<"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.seedPill,
                  {
                    backgroundColor: theme.seedControlBackground,
                    borderColor: theme.seedControlBorder,
                  },
                ]}
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
                <Text style={[styles.seedPillLabel, { color: theme.seedPillLabel }]}>
                  Daily seed
                </Text>
                <Text style={[styles.seedPillValue, { color: theme.seedPillValue }]}>
                  {formatDailySeed(selectedDailySeed)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.seedArrow,
                  {
                    backgroundColor: theme.seedControlBackground,
                    borderColor: theme.seedControlBorder,
                  },
                  !canGoPreviousDailySeed && styles.seedArrowDisabled,
                ]}
                onPress={onPreviousDailySeed}
                disabled={!canGoPreviousDailySeed}
              >
                <Text style={[styles.seedArrowText, { color: theme.seedControlText }]}>
                  {">"}
                </Text>
              </TouchableOpacity>
            </View>

            {!backendConfigured ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Add Supabase env values to load daily leaderboard scores.
              </Text>
            ) : dailyLeaderboardLoading ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Loading daily leaderboard...
              </Text>
            ) : dailyLeaderboardError ? (
              <Text style={styles.errorText}>{dailyLeaderboardError}</Text>
            ) : dailyLeaderboardEntries.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                No submitted daily scores for this seed yet.
              </Text>
            ) : (
              dailyLeaderboardEntries.map((entry, index) => {
                const entryKey = `${selectedDailySeed}-${entry.display_name}-${entry.completed_at}-${index}`;
                return (
                  <View key={entryKey} style={styles.rowWrapper}>
                    <TouchableOpacity
                      style={styles.rowTouchable}
                      activeOpacity={0.85}
                      onPress={() =>
                        openEntryDetails(entry, index + 1, "Daily Seeds")
                      }
                    >
                      <View
                        style={[
                          styles.row,
                          {
                            backgroundColor: theme.rowBackground,
                            borderColor: theme.rowBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.rank, { color: theme.rank }]}>
                          {index + 1}
                        </Text>
                        <View style={styles.meta}>
                          <Text style={[styles.name, { color: theme.name }]}>
                            {entry.display_name}
                          </Text>
                          <Text style={[styles.date, { color: theme.date }]}>
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text style={[styles.score, { color: theme.score }]}>
                          {entry.final_score}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
              {multiplayerTitle}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.sectionSubtitle }]}>
              {multiplayerSubtitle}
            </Text>

            {!backendConfigured ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Add Supabase env values to load online leaderboard scores.
              </Text>
            ) : multiplayerLeaderboardLoading ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                Loading leaderboard...
              </Text>
            ) : multiplayerLeaderboardError ? (
              <Text style={styles.errorText}>{multiplayerLeaderboardError}</Text>
            ) : multiplayerLeaderboardEntries.length === 0 ? (
              <Text style={[styles.stateText, { color: theme.stateText }]}>
                No scores have been submitted yet.
              </Text>
            ) : (
              multiplayerLeaderboardEntries.map((entry, index) => {
                const entryKey = `${entry.display_name}-${entry.completed_at}-${index}`;

                return (
                  <View key={entryKey} style={styles.rowWrapper}>
                    <TouchableOpacity
                      style={styles.rowTouchable}
                      activeOpacity={0.85}
                      onPress={() => {
                        openEntryDetails(entry, index + 1, "Multiplayer");
                      }}
                    >
                      <View
                        style={[
                          styles.row,
                          {
                            backgroundColor: theme.rowBackground,
                            borderColor: theme.rowBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.rank, { color: theme.rank }]}>
                          {index + 1}
                        </Text>
                        <View style={styles.meta}>
                          <Text style={[styles.name, { color: theme.name }]}>
                            {entry.display_name}
                          </Text>
                          <Text style={[styles.date, { color: theme.date }]}>
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text style={[styles.score, { color: theme.score }]}>
                          {entry.final_score}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={detailsEntry != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsEntry(null)}
      >
        {detailsEntry && (
          <View style={styles.detailsOverlay}>
            <Pressable
              style={styles.detailsBackdrop}
              onPress={() => setDetailsEntry(null)}
            />
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: theme.detailsCardBackground,
                  borderColor: theme.detailsCardBorder,
                },
              ]}
            >
              <View style={styles.detailsHeaderRow}>
                <View style={styles.detailsPlacementRow}>
                  <Text style={[styles.detailsTitle, { color: theme.detailsTitle }]}>
                    #{detailsEntry.rank}
                  </Text>
                  <Text style={[styles.detailsName, { color: theme.detailsName }]}>
                    {detailsEntry.entry.display_name}
                  </Text>
                </View>
                <View style={styles.detailsHeaderActions}>
                  <TouchableOpacity
                    onPress={() => setDetailsEntry(null)}
                    accessibilityLabel="Close details"
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  >
                    <Text style={[styles.detailsClose, { color: theme.detailsClose }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsScore, { color: theme.detailsScore }]}>
                {detailsEntry.entry.final_score}
              </Text>
              {typeof getEntryDurationSeconds(detailsEntry.entry) === "number" &&
                getEntryDurationSeconds(detailsEntry.entry) > 0 && (
                  <Text
                    style={[
                      styles.detailsCompletedTop,
                      { color: theme.detailsCompletedTop },
                    ]}
                  >
                    {formatDuration(getEntryDurationSeconds(detailsEntry.entry))}
                  </Text>
                )}
            </View>
            <View
              style={[styles.detailsDivider, { backgroundColor: theme.detailsDivider }]}
            />
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: theme.detailsLabel }]}>
                Points earned
              </Text>
              <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                {detailsEntry.entry.points_earned ?? "-"}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text
                style={[
                  styles.detailsLabel,
                  styles.detailsLabelPenalty,
                  { color: theme.detailsLabelPenalty },
                ]}
              >
                Turns
              </Text>
              <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                {typeof detailsEntry.entry.turn_penalties === "number"
                  ? detailsEntry.entry.turn_penalties / 2
                  : "-"}
              </Text>
            </View>
            {(detailsEntry.entry.swap_penalties ?? 0) > 0 && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPenalty,
                    { color: theme.detailsLabelPenalty },
                  ]}
                >
                  Swap penalties
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.swap_penalties}
                </Text>
              </View>
            )}
            {(detailsEntry.entry.rack_penalty ?? 0) > 0 && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPenalty,
                    { color: theme.detailsLabelPenalty },
                  ]}
                >
                  Rack penalty
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.rack_penalty}
                </Text>
              </View>
            )}
            {!isMultiplayerDetails &&
              ((detailsEntry.entry.time_bonus ?? 0) > 0 ||
                (detailsEntry.entry.timeBonus ?? 0) > 0) && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPositive,
                    { color: theme.detailsLabelPositive },
                  ]}
                >
                  Time bonus
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.time_bonus ?? detailsEntry.entry.timeBonus}
                </Text>
              </View>
            )}
            {((detailsEntry.entry.consistency_bonus ?? 0) > 0 ||
              (detailsEntry.entry.consistencyBonusTotal ?? 0) > 0) && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPositive,
                    { color: theme.detailsLabelPositive },
                  ]}
                >
                  Consistency bonus
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.consistency_bonus ??
                    detailsEntry.entry.consistencyBonusTotal}
                </Text>
              </View>
            )}
            {((detailsEntry.entry.scrabble_bonus ?? 0) > 0 ||
              (detailsEntry.entry.scrabbleBonus ?? 0) > 0) && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPositive,
                    styles.detailsLabelEmphasis,
                    { color: theme.detailsLabelPositive },
                  ]}
                >
                  Scrabble bonus
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.scrabble_bonus ??
                    detailsEntry.entry.scrabbleBonus}
                </Text>
              </View>
            )}
            {!isMultiplayerDetails &&
              ((detailsEntry.entry.perfection_bonus ?? 0) > 0 ||
                (detailsEntry.entry.perfectionBonus ?? 0) > 0) && (
              <View style={styles.detailsRow}>
                <Text
                  style={[
                    styles.detailsLabel,
                    styles.detailsLabelPositive,
                    styles.detailsLabelEmphasis,
                    { color: theme.detailsLabelPositive },
                  ]}
                >
                  Perfection bonus
                </Text>
                <Text style={[styles.detailsValue, { color: theme.detailsValue }]}>
                  {detailsEntry.entry.perfection_bonus ??
                    detailsEntry.entry.perfectionBonus}
                </Text>
              </View>
            )}
            <View style={styles.detailsSeedRow}>
              <Text style={[styles.detailsSeedTop, { color: theme.detailsSeedTop }]}>
                {detailsEntry.entry.seed}
              </Text>
              <TouchableOpacity
                style={[
                  styles.copySeedButton,
                  { borderColor: theme.copyButtonBorder },
                ]}
                onPress={(event) => handleCopySeed(detailsEntry.entry.seed, event)}
                accessibilityLabel="Copy seed"
                activeOpacity={0.8}
              >
                {Platform.OS === "ios" ? (
                  <SFSymbolIcon
                    name="doc.on.doc"
                    size={16}
                    color={theme.copyIcon}
                    weight="regular"
                    scale="medium"
                  />
                ) : (
                  <Text
                    style={[styles.copySeedButtonFallback, { color: theme.copyIcon }]}
                  >
                    Copy
                  </Text>
                )}
              </TouchableOpacity>
              {detailsSeedCopiedVisible && (
                <Text
                  style={[
                    styles.detailsSeedCopiedText,
                    { color: theme.detailsSeedCopiedText },
                  ]}
                >
                  Seed copied
                </Text>
              )}
            </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
};

const LIGHT_THEME = {
  background: "#f8f4ed",
  backButton: "#9a6b2f",
  refreshButton: "#2f6f4f",
  title: "#22313f",
  tabBackground: "#fff8ef",
  tabBorder: "#d8cdbd",
  tabActiveBackground: "#fff",
  tabActiveBorder: "#c7b08a",
  tabText: "#7f8c8d",
  tabTextActive: "#22313f",
  sectionTitle: "#22313f",
  sectionSubtitle: "#7f8c8d",
  stateText: "#7f8c8d",
  rowBackground: "#fff",
  rowBorder: "#eadfcd",
  rank: "#9a6b2f",
  name: "#22313f",
  date: "#7f8c8d",
  score: "#2f6f4f",
  copyIcon: "#2f6f4f",
  seedControlBackground: "#fff",
  seedControlBorder: "#e3d3b9",
  seedControlText: "#22313f",
  seedPillLabel: "#8b8d7a",
  seedPillValue: "#2f6f4f",
  detailsCardBackground: "#fff",
  detailsCardBorder: "#eadfcd",
  detailsTitle: "#22313f",
  detailsName: "#22313f",
  detailsClose: "#9a6b2f",
  detailsScore: "#2f6f4f",
  detailsCompletedTop: "#7f8c8d",
  detailsLabel: "#7f8c8d",
  detailsLabelPenalty: "#b91c1c",
  detailsLabelPositive: "#2f6f4f",
  detailsValue: "#22313f",
  detailsSeedTop: "#2f6f4f",
  detailsSeedCopiedText: "#2f6f4f",
  detailsDivider: "#eadfcd",
  copyButtonBorder: "#d7e7de",
};

const DARK_THEME = {
  background: "#0b1220",
  backButton: "#fdba74",
  refreshButton: "#86efac",
  title: "#f8fafc",
  tabBackground: "#111b2c",
  tabBorder: "#334155",
  tabActiveBackground: "#1e293b",
  tabActiveBorder: "#475569",
  tabText: "#94a3b8",
  tabTextActive: "#f1f5f9",
  sectionTitle: "#f8fafc",
  sectionSubtitle: "#cbd5e1",
  stateText: "#94a3b8",
  rowBackground: "#152033",
  rowBorder: "#334155",
  rank: "#fdba74",
  name: "#f1f5f9",
  date: "#94a3b8",
  score: "#86efac",
  copyIcon: "#86efac",
  seedControlBackground: "#4b5563",
  seedControlBorder: "#6b7280",
  seedControlText: "#f9fafb",
  seedPillLabel: "#d1d5db",
  seedPillValue: "#f9fafb",
  detailsCardBackground: "#1a2431",
  detailsCardBorder: "#334155",
  detailsTitle: "#f8fafc",
  detailsName: "#f1f5f9",
  detailsClose: "#fdba74",
  detailsScore: "#86efac",
  detailsCompletedTop: "#94a3b8",
  detailsLabel: "#cbd5e1",
  detailsLabelPenalty: "#fca5a5",
  detailsLabelPositive: "#86efac",
  detailsValue: "#f1f5f9",
  detailsSeedTop: "#86efac",
  detailsSeedCopiedText: "#86efac",
  detailsDivider: "#334155",
  copyButtonBorder: "#334155",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: "800",
  },
  refreshButton: {
    fontSize: 16,
    fontWeight: "800",
  },
  title: {
    marginTop: 18,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
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
    marginBottom: 4,
  },
  stateText: {
    fontSize: 15,
    lineHeight: 22,
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
  detailsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  detailsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  detailsCard: {
    width: "72%",
    maxWidth: 280,
    minWidth: 240,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfcd",
    padding: 18,
    gap: 8,
  },
  detailsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  detailsPlacementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsTitle: {
    color: "#22313f",
    fontSize: 16,
    fontWeight: "900",
  },
  detailsClose: {
    color: "#9a6b2f",
    fontSize: 14,
    fontWeight: "800",
  },
  detailsSeedTop: {
    color: "#2f6f4f",
    fontSize: 14,
    fontWeight: "800",
  },
  detailsSeedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
    marginTop: 10,
  },
  detailsSeedCopiedText: {
    color: "#2f6f4f",
    fontSize: 11,
    fontWeight: "700",
  },
  detailsName: {
    color: "#22313f",
    fontSize: 16,
    fontWeight: "800",
  },
  detailsScore: {
    color: "#2f6f4f",
    fontSize: 30,
    fontWeight: "900",
  },
  detailsCompletedTop: {
    color: "#7f8c8d",
    fontSize: 15,
    fontWeight: "700",
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailsLabel: {
    color: "#7f8c8d",
    fontSize: 13,
    fontWeight: "700",
  },
  detailsLabelPenalty: {
    color: "#b91c1c",
  },
  detailsLabelPositive: {
    color: "#2f6f4f",
  },
  detailsLabelEmphasis: {
    fontWeight: "900",
  },
  detailsValue: {
    color: "#22313f",
    fontSize: 14,
    fontWeight: "700",
  },
  detailsSeedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  copySeedButton: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d7e7de",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  copySeedButtonFallback: {
    color: "#2f6f4f",
    fontSize: 11,
    fontWeight: "700",
  },
  detailsDivider: {
    marginTop: 4,
    marginBottom: 4,
    height: 1,
    backgroundColor: "#eadfcd",
  },
});

export default LeaderboardScreen;
