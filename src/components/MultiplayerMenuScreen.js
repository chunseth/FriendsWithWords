import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SFSymbolIcon from "./SFSymbolIcon";
import MultiplayerPlayGamePanel from "./MultiplayerPlayGamePanel";
import MessageOverlay from "./MessageOverlay";
import PendingGameRequestModal from "./PendingGameRequestModal";
import { searchProfilesByUsername } from "../services/profileService";
import {
  acceptFriendRequest,
  declineFriendRequest,
  loadFriendState,
  removeFriend,
  sendFriendRequest,
} from "../services/friendService";
import {
  acceptMultiplayerGameRequest,
  cancelMultiplayerGameRequest,
  deleteAcceptedMultiplayerGame,
  declineMultiplayerGameRequest,
  loadMultiplayerGameRequests,
  sendMultiplayerGameRequest,
} from "../services/multiplayerGameRequestService";
import {
  archiveMultiplayerSessionForUser,
  createMultiplayerRematch,
  fetchUnreadMultiplayerNotifications,
  markMultiplayerNotificationsRead,
  subscribeToMultiplayerInbox,
  upsertPresence,
} from "../services/multiplayerInboxService";
import { trackMultiplayerEvent } from "../services/analyticsService";

const buildPresenceLabel = (status) => {
  if (status === "online") return "Online now";
  if (status === "away") return "Active recently";
  if (status === "offline") return "Offline";
  return null;
};

const groupAndSortGames = (games = [], activeFilter = "all") => {
  const filtered = games.filter((game) => {
    if (activeFilter === "needs_action") {
      return game.needsAction || game.direction === "incoming";
    }
    if (activeFilter === "pending") {
      return game.status === "pending";
    }
    if (activeFilter === "archived") {
      return game.archived === true;
    }
    return true;
  });

  const yourTurn = filtered
    .filter((game) => game.status === "accepted" && game.needsAction)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const waiting = filtered
    .filter(
      (game) =>
        game.status === "accepted" &&
        !game.needsAction &&
        game.archived !== true
    )
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const pending = filtered
    .filter((game) => game.status === "pending")
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const archived = filtered
    .filter((game) => game.archived === true)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return { yourTurn, waiting, pending, archived };
};

const MultiplayerMenuScreen = ({
  dailySeed,
  onBack,
  onOpenLeaderboard,
  onOpenActiveGame,
  onOpenNewMultiplayerGame,
  onOpenInbox,
  onOpenNotificationSettings,
  initialTab = "games",
}) => {
  const [activeTab, setActiveTab] = useState(
    initialTab === "friends" ? "friends" : "games"
  );
  const [activeGames, setActiveGames] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [playPanelFriend, setPlayPanelFriend] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearchedFriends, setHasSearchedFriends] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState(null);
  const [friendActionError, setFriendActionError] = useState(null);
  const [pendingFriendActionId, setPendingFriendActionId] = useState(null);
  const [friendActionMessage, setFriendActionMessage] = useState(null);
  const [gameRequestsLoading, setGameRequestsLoading] = useState(false);
  const [gameRequestsError, setGameRequestsError] = useState(null);
  const [pendingGameActionId, setPendingGameActionId] = useState(null);
  const [selectedOutgoingGameRequest, setSelectedOutgoingGameRequest] =
    useState(null);
  const [selectedActiveGameForDeletion, setSelectedActiveGameForDeletion] =
    useState(null);
  const [activeGameFilter, setActiveGameFilter] = useState("all");
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [latestInboxMessage, setLatestInboxMessage] = useState(null);

  const unreadCount = unreadNotifications.length;
  const pendingIncomingCount = activeGames.filter(
    (game) => game.status === "pending" && game.direction === "incoming"
  ).length;
  const gamesTabBadgeCount = pendingIncomingCount + unreadCount;
  const friendsTabBadgeCount = incomingRequests.length;

  const refreshFriendState = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);

    const result = await loadFriendState();
    if (!result.ok) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendsError(result.errorMessage ?? "Could not load friends right now.");
      setFriendsLoading(false);
      return;
    }

    setFriends(result.friends);
    setIncomingRequests(result.incomingRequests);
    setOutgoingRequests(result.outgoingRequests);
    setFriendsLoading(false);
  }, []);

  const refreshGameRequests = useCallback(async () => {
    setGameRequestsLoading(true);
    setGameRequestsError(null);

    const result = await loadMultiplayerGameRequests();
    if (!result.ok) {
      setActiveGames([]);
      setGameRequestsError(
        result.errorMessage ?? "Could not load multiplayer games right now."
      );
      setGameRequestsLoading(false);
      return;
    }

    setActiveGames(result.requests);
    setGameRequestsLoading(false);
  }, []);

  const refreshUnreadNotifications = useCallback(async () => {
    const result = await fetchUnreadMultiplayerNotifications(20);
    if (!result.ok) {
      return;
    }

    setUnreadNotifications(result.notifications);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab === "friends" ? "friends" : "games");
  }, [initialTab]);

  useEffect(() => {
    if (activeTab !== "games") {
      return;
    }

    void refreshGameRequests();
  }, [activeTab, refreshGameRequests]);

  useEffect(() => {
    if (activeTab !== "friends") {
      return;
    }

    void refreshFriendState();
  }, [activeTab, refreshFriendState]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    void upsertPresence({ status: "online", lastSessionId: null });
    void refreshUnreadNotifications();

    void (async () => {
      const result = await subscribeToMultiplayerInbox({
        onNotification: () => {
          if (cancelled) return;
          void refreshUnreadNotifications();
        },
        onGameRequest: () => {
          if (cancelled) return;
          void refreshGameRequests();
        },
        onSessionChange: () => {
          if (cancelled) return;
          void refreshGameRequests();
        },
      });

      if (result.ok) {
        unsubscribe = result.unsubscribe;
      }
    })();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void upsertPresence({ status: "online", lastSessionId: null });
        void refreshUnreadNotifications();
        void refreshGameRequests();
      } else if (state === "background") {
        void upsertPresence({ status: "away", lastSessionId: null });
      }
    });

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      unsubscribe();
      void upsertPresence({ status: "offline", lastSessionId: null });
    };
  }, [refreshGameRequests, refreshUnreadNotifications]);

  const handleSearchFriends = async () => {
    const trimmedQuery = friendSearch.trim();
    if (!trimmedQuery) {
      setHasSearchedFriends(false);
      setSearchResults([]);
      setFriendSearchError(null);
      return;
    }

    setFriendSearchLoading(true);
    setFriendSearchError(null);
    setHasSearchedFriends(true);

    const result = await searchProfilesByUsername(trimmedQuery);

    if (!result.ok) {
      setSearchResults([]);
      setFriendSearchError(result.errorMessage ?? "Could not search for users.");
      setFriendSearchLoading(false);
      return;
    }

    setSearchResults(
      result.profiles.map((profile) => ({
        id: profile.id,
        name: profile.username,
        displayName: profile.displayName,
      }))
    );
    setFriendSearchLoading(false);
  };

  const handleAddFriend = async (friend) => {
    setPendingFriendActionId(friend.id);
    setFriendActionError(null);
    setFriendActionMessage(null);

    const result = await sendFriendRequest(friend.id);
    if (!result.ok) {
      setPendingFriendActionId(null);
      setFriendActionError(
        result.errorMessage ?? "Could not send that friend request."
      );
      return;
    }

    setFriendSearch("");
    setSearchResults([]);
    setHasSearchedFriends(false);
    setFriendSearchError(null);
    await refreshFriendState();
    setPendingFriendActionId(null);
    setFriendActionMessage({
      title: "Friend Request Sent",
      text: `Your request to @${friend.name} is waiting for them to accept.`,
    });
  };

  const handleAcceptFriendRequest = async (request) => {
    setPendingFriendActionId(request.id);
    setFriendActionError(null);

    const result = await acceptFriendRequest(request.id, request.senderId);
    if (!result.ok) {
      setPendingFriendActionId(null);
      setFriendActionError(
        result.errorMessage ?? "Could not accept that friend request."
      );
      return;
    }

    await refreshFriendState();
    setPendingFriendActionId(null);
  };

  const handleDeclineFriendRequest = async (request) => {
    setPendingFriendActionId(request.id);
    setFriendActionError(null);

    const result = await declineFriendRequest(request.id, request.senderId);
    if (!result.ok) {
      setPendingFriendActionId(null);
      setFriendActionError(
        result.errorMessage ?? "Could not decline that friend request."
      );
      return;
    }

    await refreshFriendState();
    setPendingFriendActionId(null);
  };

  const handleRemoveFriend = async (friend) => {
    setPendingFriendActionId(friend.id);
    setFriendActionError(null);
    setFriendActionMessage(null);

    const result = await removeFriend(friend.id);
    if (!result.ok) {
      setPendingFriendActionId(null);
      setFriendActionError(result.errorMessage ?? "Could not remove that friend.");
      return;
    }

    setSelectedFriendId((current) => (current === friend.id ? null : current));
    await refreshFriendState();
    setPendingFriendActionId(null);
  };

  const groupedGames = groupAndSortGames(activeGames, activeGameFilter);

  const handleOpenGame = async (game) => {
    if (!game) return;
    const sessionNotificationIds = unreadNotifications
      .filter((notification) => notification?.payload?.sessionId === game.sessionId)
      .map((notification) => notification.id);
    if (sessionNotificationIds.length > 0) {
      await markMultiplayerNotificationsRead(sessionNotificationIds);
      await refreshUnreadNotifications();
    }
    await trackMultiplayerEvent("mp_notification_opened", {
      sessionId: game.sessionId,
    });
    await trackMultiplayerEvent("mp_turn_started", {
      sessionId: game.sessionId,
      source: "menu_open_game",
    });
    onOpenActiveGame?.(game);
  };

  const renderGameCard = (game) => (
    <Pressable
      key={game.id}
      style={styles.card}
      onPress={() => {
        if (game.status === "pending" && game.direction === "outgoing") {
          setSelectedOutgoingGameRequest(game);
          return;
        }

        if (game.status === "accepted" && game.archived !== true) {
          void handleOpenGame(game);
        }
      }}
      onLongPress={() => {
        if (game.status === "accepted") {
          setSelectedActiveGameForDeletion(game);
        }
      }}
      delayLongPress={350}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{game.friendName}</Text>
        <Text style={styles.cardBadge}>
          {game.status === "pending"
            ? game.direction === "incoming"
              ? "Request"
              : "Pending"
            : game.needsAction
              ? "Your Turn"
              : game.archived
                ? "Archived"
                : "Waiting"}
        </Text>
      </View>
      {buildPresenceLabel(game.presenceStatus) ? (
        <Text style={styles.cardPresenceText}>{buildPresenceLabel(game.presenceStatus)}</Text>
      ) : null}
      <Text style={styles.cardMeta}>Seed {game.seed}</Text>
      <Text style={styles.cardSummary}>{game.summary}</Text>
      {game.hasUnreadSessionUpdate ? (
        <Text style={styles.cardUnreadText}>New activity</Text>
      ) : null}
      {game.status === "pending" && game.direction === "incoming" ? (
        <View style={styles.cardActionRow}>
          <TouchableOpacity
            style={[
              styles.gameRequestDeclineButton,
              pendingGameActionId === game.id && styles.gameRequestButtonDisabled,
            ]}
            onPress={async () => {
              try {
                setPendingGameActionId(game.id);
                const result = await declineMultiplayerGameRequest({
                  requestId: game.id,
                  senderId: game.friendId,
                });
                if (!result.ok) {
                  setGameRequestsError(
                    result.errorMessage ?? "Could not decline that game request."
                  );
                  return;
                }
                await refreshGameRequests();
              } catch (_error) {
                setGameRequestsError("Could not decline that game request.");
              } finally {
                setPendingGameActionId(null);
              }
            }}
            disabled={pendingGameActionId === game.id}
          >
            <Text style={styles.gameRequestButtonText}>
              {pendingGameActionId === game.id ? "Rejecting" : "Reject"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.gameRequestAcceptButton,
              pendingGameActionId === game.id && styles.gameRequestButtonDisabled,
            ]}
            onPress={async () => {
              try {
                setPendingGameActionId(game.id);
                const result = await acceptMultiplayerGameRequest({
                  requestId: game.id,
                  senderId: game.friendId,
                  senderUsername: game.friendName,
                  senderDisplayName: game.friendDisplayName ?? game.friendName,
                  seed: game.seed,
                  gameType: game.gameType,
                });
                if (!result.ok) {
                  setGameRequestsError(
                    result.errorMessage ?? "Could not accept that game request."
                  );
                  return;
                }
                await refreshGameRequests();
                onOpenActiveGame?.({
                  ...game,
                  sessionId: result.sessionId ?? null,
                });
                await trackMultiplayerEvent("mp_request_accepted", {
                  requestId: game.id,
                  sessionId: result.sessionId ?? null,
                });
              } catch (_error) {
                setGameRequestsError("Could not accept that game request.");
              } finally {
                setPendingGameActionId(null);
              }
            }}
            disabled={pendingGameActionId === game.id}
          >
            <Text style={styles.gameRequestButtonText}>
              {pendingGameActionId === game.id ? "Accepting" : "Accept"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : game.status === "accepted" ? (
        <>
          {game.archived ? (
            <TouchableOpacity
              style={styles.primaryInlineButton}
              onPress={async () => {
                const nextSessionId = `mp_${Date.now()}_${Math.random()
                  .toString(36)
                  .slice(2, 10)}`;
                const rematchResult = await createMultiplayerRematch({
                  sessionId: game.sessionId,
                  newSessionId: nextSessionId,
                  seed: game.seed,
                  gameType: game.gameType ?? "seeded",
                });
                if (!rematchResult.ok) {
                  setGameRequestsError("Could not create a rematch right now.");
                  return;
                }
                await trackMultiplayerEvent("mp_rematch_created", {
                  fromSessionId: game.sessionId,
                  newSessionId: rematchResult.sessionId ?? nextSessionId,
                });
                onOpenNewMultiplayerGame?.({
                  ...game,
                  sessionId: rematchResult.sessionId ?? nextSessionId,
                });
              }}
            >
              <Text style={styles.primaryInlineButtonText}>Rematch</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryInlineButton}
                onPress={() => {
                  void handleOpenGame(game);
                }}
              >
                <Text style={styles.primaryInlineButtonText}>Open Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryInlineButton}
                onPress={async () => {
                  const result = await archiveMultiplayerSessionForUser({
                    sessionId: game.sessionId,
                  });
                if (!result.ok) {
                  setGameRequestsError(
                    "Could not archive that multiplayer game right now."
                  );
                  return;
                }
                await trackMultiplayerEvent("mp_session_archived", {
                  sessionId: game.sessionId,
                });
                await refreshGameRequests();
              }}
            >
                <Text style={styles.secondaryInlineButtonText}>Archive</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        <Text style={styles.cardAction}>
          {game.direction === "outgoing"
            ? "Waiting for response"
            : "Request pending"}
        </Text>
      )}
    </Pressable>
  );

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

      <View style={styles.titleRow}>
        <Text style={styles.title}>Multiplayer</Text>
        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={onOpenLeaderboard}
        >
          <Text style={styles.leaderboardButtonText}>High Scores</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Start or resume games with friends.</Text>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={onOpenInbox}
          accessibilityLabel="Open multiplayer inbox"
        >
          <Text style={styles.quickActionText}>
            Inbox {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={onOpenNotificationSettings}
          accessibilityLabel="Open multiplayer notification settings"
        >
          <Text style={styles.quickActionText}>Notification Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "games" && styles.tabButtonActive]}
          onPress={() => setActiveTab("games")}
        >
          <View style={styles.tabLabelRow}>
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "games" && styles.tabButtonTextActive,
              ]}
            >
              Active Games
            </Text>
            {gamesTabBadgeCount > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{gamesTabBadgeCount}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "friends" && styles.tabButtonActive]}
          onPress={() => setActiveTab("friends")}
        >
          <View style={styles.tabLabelRow}>
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "friends" && styles.tabButtonTextActive,
              ]}
            >
              Friends
            </Text>
            {friendsTabBadgeCount > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friendsTabBadgeCount}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === "games" ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeGameFilter === "all" && styles.filterChipActive,
              ]}
              onPress={() => setActiveGameFilter("all")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeGameFilter === "all" && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeGameFilter === "needs_action" && styles.filterChipActive,
              ]}
              onPress={() => setActiveGameFilter("needs_action")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeGameFilter === "needs_action" &&
                    styles.filterChipTextActive,
                ]}
              >
                Needs Action
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeGameFilter === "pending" && styles.filterChipActive,
              ]}
              onPress={() => setActiveGameFilter("pending")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeGameFilter === "pending" && styles.filterChipTextActive,
                ]}
              >
                Pending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeGameFilter === "archived" && styles.filterChipActive,
              ]}
              onPress={() => setActiveGameFilter("archived")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeGameFilter === "archived" && styles.filterChipTextActive,
                ]}
              >
                Archived
              </Text>
            </TouchableOpacity>
          </View>
          {unreadNotifications.length > 0 ? (
            <TouchableOpacity
              style={styles.inlineStatusCard}
              onPress={async () => {
                const unreadIds = unreadNotifications.map((notification) => notification.id);
                await markMultiplayerNotificationsRead(unreadIds);
                await refreshUnreadNotifications();
                const newest = unreadNotifications[0];
                if (newest) {
                  setLatestInboxMessage({
                    title: "Notifications",
                    text: "Marked multiplayer notifications as read.",
                  });
                }
              }}
            >
              <Text style={styles.inlineStatusText}>
                {`${unreadCount} unread multiplayer notification${
                  unreadCount === 1 ? "" : "s"
                }`}
              </Text>
            </TouchableOpacity>
          ) : null}
          {gameRequestsLoading ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Loading Games</Text>
              <Text style={styles.emptyStateText}>
                Pulling your multiplayer requests now.
              </Text>
            </View>
          ) : gameRequestsError ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Could Not Load Games</Text>
              <Text style={styles.emptyStateText}>{gameRequestsError}</Text>
            </View>
          ) : activeGames.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No Active Games</Text>
              <Text style={styles.emptyStateText}>
                Start a multiplayer run from the Friends tab.
              </Text>
            </View>
          ) : (
            <>
              {groupedGames.yourTurn.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Your Turn</Text>
                  {groupedGames.yourTurn.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.waiting.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Waiting</Text>
                  {groupedGames.waiting.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.pending.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Pending Requests</Text>
                  {groupedGames.pending.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.archived.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Completed / Archived</Text>
                  {groupedGames.archived.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.yourTurn.length === 0 &&
              groupedGames.waiting.length === 0 &&
              groupedGames.pending.length === 0 &&
              groupedGames.archived.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>No Games In Filter</Text>
                  <Text style={styles.emptyStateText}>
                    Try another filter to see your multiplayer games.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.friendsSection}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={friendSearch}
              onChangeText={(nextValue) => {
                setFriendSearch(nextValue);
                if (nextValue.trim().length === 0) {
                  setHasSearchedFriends(false);
                  setSearchResults([]);
                  setFriendSearchError(null);
                }
              }}
              placeholder="Search friend username"
              placeholderTextColor="#8b8d7a"
              returnKeyType="search"
              onSubmitEditing={() => {
                void handleSearchFriends();
              }}
            />
            <TouchableOpacity
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Search"
              onPress={() => {
                void handleSearchFriends();
              }}
            >
              <SFSymbolIcon
                name="magnifyingglass"
                size={18}
                color="#fff"
                weight="semibold"
                scale="medium"
                resizeMode="center"
                multicolor={false}
                style={styles.searchButtonIcon}
                fallback="⌕"
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {friendActionError ? (
              <View style={styles.inlineStatusCard}>
                <Text style={styles.inlineStatusText}>{friendActionError}</Text>
              </View>
            ) : null}

            {hasSearchedFriends ? friendSearchLoading ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Searching</Text>
                <Text style={styles.emptyStateText}>
                  Looking for that username now.
                </Text>
              </View>
            ) : friendSearchError ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Search Failed</Text>
                <Text style={styles.emptyStateText}>{friendSearchError}</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No Users Found</Text>
                <Text style={styles.emptyStateText}>
                  No users found with that username.
                </Text>
              </View>
            ) : (
              searchResults.map((friend) => {
                const alreadyFriends = friends.some(
                  (existingFriend) => existingFriend.id === friend.id
                );
                const hasPendingOutgoingRequest = outgoingRequests.some(
                  (request) => request.receiverId === friend.id
                );
                const hasPendingIncomingRequest = incomingRequests.some(
                  (request) => request.senderId === friend.id
                );
                const addButtonLabel = alreadyFriends
                  ? "Friends"
                  : hasPendingIncomingRequest
                    ? "Accept"
                    : hasPendingOutgoingRequest
                      ? "Pending"
                      : pendingFriendActionId === friend.id
                        ? "Sending"
                        : "Add";
                const addButtonDisabled =
                  alreadyFriends ||
                  hasPendingOutgoingRequest ||
                  pendingFriendActionId === friend.id;
                return (
                  <View key={friend.id} style={styles.searchResultRow}>
                    <View style={styles.searchResultTextWrap}>
                      <Text style={styles.friendName}>@{friend.name}</Text>
                      {friend.displayName ? (
                        <Text style={styles.searchResultMeta}>
                          {friend.displayName}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.addButton,
                        addButtonDisabled && styles.addButtonDisabled,
                      ]}
                      onPress={() => {
                        if (hasPendingIncomingRequest) {
                          const matchingRequest = incomingRequests.find(
                            (request) => request.senderId === friend.id
                          );
                          if (matchingRequest) {
                            void handleAcceptFriendRequest(matchingRequest);
                          }
                          return;
                        }
                        void handleAddFriend(friend);
                      }}
                      disabled={addButtonDisabled}
                    >
                      <Text style={styles.addButtonText}>{addButtonLabel}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : friendsLoading ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Loading Friends</Text>
                <Text style={styles.emptyStateText}>
                  Pulling your requests and friends now.
                </Text>
              </View>
            ) : friendsError ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Could Not Load Friends</Text>
                <Text style={styles.emptyStateText}>{friendsError}</Text>
              </View>
            ) : incomingRequests.length > 0 || friends.length > 0 ? (
              <>
                {incomingRequests.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Friend Requests</Text>
                    {incomingRequests.map((request) => (
                      <View key={request.id} style={styles.searchResultRow}>
                        <View style={styles.searchResultTextWrap}>
                          <Text style={styles.friendName}>@{request.name}</Text>
                          {request.displayName ? (
                            <Text style={styles.searchResultMeta}>
                              {request.displayName}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.requestActionRow}>
                          <TouchableOpacity
                            style={[
                              styles.secondaryActionButton,
                              pendingFriendActionId === request.id &&
                                styles.secondaryActionButtonDisabled,
                            ]}
                            onPress={() => {
                              void handleDeclineFriendRequest(request);
                            }}
                            disabled={pendingFriendActionId === request.id}
                          >
                            <Text style={styles.secondaryActionButtonText}>
                              {pendingFriendActionId === request.id
                                ? "Declining"
                                : "Decline"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.addButton,
                              pendingFriendActionId === request.id &&
                                styles.addButtonDisabled,
                            ]}
                            onPress={() => {
                              void handleAcceptFriendRequest(request);
                            }}
                            disabled={pendingFriendActionId === request.id}
                          >
                            <Text style={styles.addButtonText}>
                              {pendingFriendActionId === request.id
                                ? "Accepting"
                                : "Accept"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {friends.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Friends</Text>
                    {friends.map((friend) => {
                      const isSelected = selectedFriendId === friend.id;
                      return (
                        <View key={friend.id} style={styles.friendRowWrap}>
                          <Pressable
                            style={styles.friendRow}
                            onPress={() =>
                              setSelectedFriendId((current) =>
                                current === friend.id ? null : friend.id
                              )
                            }
                          >
                            <Text style={styles.friendName}>{friend.name}</Text>
                            <Text style={styles.friendHint}>Options</Text>
                          </Pressable>

                          {isSelected ? (
                            <View style={styles.friendActionPanel}>
                              <TouchableOpacity
                                style={styles.friendActionButton}
                                onPress={() => setPlayPanelFriend(friend)}
                              >
                                <Text style={styles.friendActionText}>
                                  Play Game
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.friendActionButton}
                                onPress={() => {
                                  void handleRemoveFriend(friend);
                                }}
                                disabled={pendingFriendActionId === friend.id}
                              >
                                <Text
                                  style={[
                                    styles.friendActionText,
                                    styles.friendActionTextDanger,
                                    pendingFriendActionId === friend.id &&
                                      styles.friendActionTextDisabled,
                                  ]}
                                >
                                  {pendingFriendActionId === friend.id
                                    ? "Removing"
                                    : "Unadd Friend"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
                <Text style={styles.emptyStateText}>
                  Search for a friend above to add them.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      <MultiplayerPlayGamePanel
        visible={playPanelFriend != null}
        friendName={playPanelFriend?.name ?? null}
        dailySeed={dailySeed}
        onClose={() => setPlayPanelFriend(null)}
        onDailyGame={() => {
          const nextFriend = playPanelFriend;
          setPlayPanelFriend(null);
          if (!nextFriend) {
            return;
          }
          void (async () => {
            const result = await sendMultiplayerGameRequest({
              receiverId: nextFriend.id,
              gameType: "daily",
              seed: dailySeed,
            });
            if (!result.ok) {
              setFriendActionError(
                result.errorMessage ?? "Could not send that game request."
              );
              return;
            }
            await trackMultiplayerEvent("mp_request_sent", {
              receiverId: nextFriend.id,
              gameType: "daily",
              seed: dailySeed,
            });
            setFriendActionMessage({
              title: "Game Request Sent",
              text: `Your Daily Game request to @${nextFriend.name} is waiting for them to accept.`,
            });
            setActiveTab("games");
            await refreshGameRequests();
          })();
        }}
        onNewGameRandom={() => {
          const nextFriend = playPanelFriend;
          setPlayPanelFriend(null);
          if (!nextFriend) {
            return;
          }
          void (async () => {
            const randomSeed = `${Date.now()}`;
            const result = await sendMultiplayerGameRequest({
              receiverId: nextFriend.id,
              gameType: "random",
              seed: randomSeed,
            });
            if (!result.ok) {
              setFriendActionError(
                result.errorMessage ?? "Could not send that game request."
              );
              return;
            }
            await trackMultiplayerEvent("mp_request_sent", {
              receiverId: nextFriend.id,
              gameType: "random",
              seed: randomSeed,
            });
            setFriendActionMessage({
              title: "Game Request Sent",
              text: `Your New Game request to @${nextFriend.name} is waiting for them to accept.`,
            });
            setActiveTab("games");
            await refreshGameRequests();
          })();
        }}
        onNewGameWithSeed={(seed) => {
          const nextFriend = playPanelFriend;
          setPlayPanelFriend(null);
          if (!nextFriend) {
            return;
          }
          void (async () => {
            const result = await sendMultiplayerGameRequest({
              receiverId: nextFriend.id,
              gameType: "seeded",
              seed,
            });
            if (!result.ok) {
              setFriendActionError(
                result.errorMessage ?? "Could not send that game request."
              );
              return;
            }
            await trackMultiplayerEvent("mp_request_sent", {
              receiverId: nextFriend.id,
              gameType: "seeded",
              seed,
            });
            setFriendActionMessage({
              title: "Game Request Sent",
              text: `Your seeded game request to @${nextFriend.name} is waiting for them to accept.`,
            });
            setActiveTab("games");
            await refreshGameRequests();
          })();
        }}
      />
      <MessageOverlay
        message={friendActionMessage}
        onClose={() => setFriendActionMessage(null)}
      />
      <MessageOverlay
        message={latestInboxMessage}
        onClose={() => setLatestInboxMessage(null)}
      />
      <PendingGameRequestModal
        visible={selectedOutgoingGameRequest != null}
        friendName={selectedOutgoingGameRequest?.friendName ?? null}
        confirmDisabled={
          selectedOutgoingGameRequest != null &&
          pendingGameActionId === selectedOutgoingGameRequest.id
        }
        onCancel={() => {
          if (
            selectedOutgoingGameRequest != null &&
            pendingGameActionId === selectedOutgoingGameRequest.id
          ) {
            return;
          }
          setSelectedOutgoingGameRequest(null);
        }}
        onConfirm={() => {
          if (!selectedOutgoingGameRequest) {
            return;
          }

          void (async () => {
            setPendingGameActionId(selectedOutgoingGameRequest.id);
            const result = await cancelMultiplayerGameRequest({
              requestId: selectedOutgoingGameRequest.id,
              receiverId: selectedOutgoingGameRequest.friendId,
            });
            if (!result.ok) {
              setGameRequestsError(
                result.errorMessage ?? "Could not unsend that game request."
              );
              setPendingGameActionId(null);
              return;
            }
            setSelectedOutgoingGameRequest(null);
            await refreshGameRequests();
            setPendingGameActionId(null);
          })();
        }}
      />
      <PendingGameRequestModal
        visible={selectedActiveGameForDeletion != null}
        friendName={selectedActiveGameForDeletion?.friendName ?? null}
        title="Delete Active Game?"
        body={
          selectedActiveGameForDeletion?.friendName
            ? `This will remove your active multiplayer game with @${selectedActiveGameForDeletion.friendName} from the list for both players.`
            : "This will remove this active multiplayer game from the list for both players."
        }
        confirmLabel="Delete Game"
        confirmBusyLabel="Deleting"
        cancelLabel="Keep Game"
        confirmDisabled={
          selectedActiveGameForDeletion != null &&
          pendingGameActionId === selectedActiveGameForDeletion.id
        }
        onCancel={() => {
          if (
            selectedActiveGameForDeletion != null &&
            pendingGameActionId === selectedActiveGameForDeletion.id
          ) {
            return;
          }
          setSelectedActiveGameForDeletion(null);
        }}
        onConfirm={() => {
          if (!selectedActiveGameForDeletion) {
            return;
          }

          void (async () => {
            setPendingGameActionId(selectedActiveGameForDeletion.id);
            const result = await deleteAcceptedMultiplayerGame({
              requestId: selectedActiveGameForDeletion.id,
              sessionId: selectedActiveGameForDeletion.sessionId,
            });
            if (!result.ok) {
              setGameRequestsError(
                result.errorMessage ?? "Could not delete that multiplayer game."
              );
              setPendingGameActionId(null);
              return;
            }
            setSelectedActiveGameForDeletion(null);
            await refreshGameRequests();
            setPendingGameActionId(null);
          })();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f4ed",
    paddingHorizontal: 24,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#22313f",
    flex: 1,
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: "#6a736f",
    marginBottom: 10,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickActionButton: {
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d9ccb6",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickActionText: {
    color: "#2f6f4f",
    fontSize: 12,
    fontWeight: "800",
  },
  leaderboardButton: {
    marginBottom: 0,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3d3b9",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  leaderboardButtonText: {
    color: "#2f6f4f",
    fontSize: 14,
    fontWeight: "800",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3d3b9",
    paddingVertical: 14,
    alignItems: "center",
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: "#2f6f4f",
    borderColor: "#2f6f4f",
  },
  tabButtonText: {
    color: "#22313f",
    fontSize: 16,
    fontWeight: "800",
  },
  tabButtonTextActive: {
    color: "#fff",
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9ccb6",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    borderColor: "#2f6f4f",
    backgroundColor: "#2f6f4f",
  },
  filterChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e6d8be",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    color: "#22313f",
    fontSize: 20,
    fontWeight: "900",
  },
  cardBadge: {
    color: "#2f6f4f",
    fontWeight: "800",
    fontSize: 13,
  },
  cardMeta: {
    marginTop: 8,
    color: "#7a6a53",
    fontSize: 13,
    fontWeight: "700",
  },
  cardSummary: {
    marginTop: 6,
    color: "#5a5248",
    fontSize: 15,
  },
  cardPresenceText: {
    marginTop: 4,
    color: "#2f6f4f",
    fontSize: 12,
    fontWeight: "700",
  },
  cardUnreadText: {
    marginTop: 8,
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
  },
  cardAction: {
    marginTop: 12,
    color: "#d97706",
    fontWeight: "800",
    fontSize: 15,
  },
  cardHint: {
    marginTop: 10,
    color: "#8d7c66",
    fontSize: 12,
    fontWeight: "700",
  },
  cardActionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  emptyStateCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e6d8be",
    alignItems: "center",
  },
  emptyStateTitle: {
    color: "#22313f",
    fontSize: 20,
    fontWeight: "900",
  },
  emptyStateText: {
    marginTop: 8,
    color: "#6f6659",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  inlineStatusCard: {
    backgroundColor: "#fff3f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f2b8b5",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inlineStatusText: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  friendsSection: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#dcc9ac",
    paddingHorizontal: 14,
    color: "#22313f",
    fontSize: 17,
    fontWeight: "700",
  },
  addButton: {
    minWidth: 82,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: "#d97706",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addButtonDisabled: {
    backgroundColor: "#c9bca9",
  },
  primaryInlineButton: {
    minWidth: 96,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#d97706",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 14,
  },
  primaryInlineButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryInlineButton: {
    minWidth: 96,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7c9af",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8,
  },
  secondaryInlineButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  gameRequestAcceptButton: {
    minWidth: 96,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#d97706",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  gameRequestDeclineButton: {
    minWidth: 96,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#b42318",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  gameRequestButtonDisabled: {
    opacity: 0.55,
  },
  gameRequestButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  searchButtonIcon: {
    width: 18,
    height: 18,
  },
  searchResultRow: {
    backgroundColor: "#fffdf8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6d8be",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  searchResultTextWrap: {
    flex: 1,
    gap: 4,
  },
  searchResultMeta: {
    color: "#8d7c66",
    fontSize: 13,
    fontWeight: "700",
  },
  requestActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    color: "#7a6a53",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  friendRowWrap: {
    position: "relative",
  },
  friendRow: {
    backgroundColor: "#fffdf8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6d8be",
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  friendName: {
    color: "#22313f",
    fontSize: 18,
    fontWeight: "800",
  },
  friendHint: {
    color: "#8d7c66",
    fontSize: 13,
    fontWeight: "700",
  },
  friendActionPanel: {
    marginTop: 8,
    marginLeft: 20,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e3d3b9",
    padding: 8,
    gap: 6,
  },
  friendActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 32,
    minWidth: 82,
  },
  friendActionText: {
    color: "#22313f",
    fontSize: 14,
    fontWeight: "800",
  },
  friendActionTextDisabled: {
    color: "#9ca3af",
  },
  friendActionTextDanger: {
    color: "#b42318",
  },
  secondaryActionButton: {
    minWidth: 82,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3d3b9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    minHeight: 32,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.6,
  },
  secondaryActionButtonText: {
    color: "#22313f",
    fontSize: 16,
    fontWeight: "800",
  },
});

export default MultiplayerMenuScreen;
