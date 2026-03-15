import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Modal,
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
  fetchUnreadMultiplayerNotifications,
  markMultiplayerNotificationsRead,
  subscribeToMultiplayerInbox,
  upsertPresence,
} from "../services/multiplayerInboxService";
import { trackMultiplayerEvent } from "../services/analyticsService";

const groupAndSortGames = (games = [], activeFilter = "active") => {
  const filtered = games.filter((game) => {
    if (activeFilter === "active") {
      return (
        (game.status === "accepted" && game.archived !== true) ||
        (game.status === "pending" && game.direction === "incoming")
      );
    }
    if (activeFilter === "your_turn") {
      return (
        game.status === "accepted" &&
        game.archived !== true &&
        game.needsAction === true
      );
    }
    if (activeFilter === "pending") {
      return game.status === "pending";
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

const GAME_TAB_NOTIFICATION_TYPES = new Set([
  "game_request",
  "request_accepted",
  "turn_ready",
  "reminder",
  "session_conflict",
]);

const formatArchivedCompletedDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getNotificationSessionId = (notification) => {
  if (!notification || typeof notification !== "object") {
    return null;
  }
  const payload = notification.payload ?? {};
  return (
    payload.sessionId ??
    payload.session_id ??
    notification.entity_id ??
    null
  );
};

const getNotificationRequestId = (notification) => {
  if (!notification || typeof notification !== "object") {
    return null;
  }
  const payload = notification.payload ?? {};
  return payload.requestId ?? payload.request_id ?? notification.entity_id ?? null;
};

const MultiplayerMenuScreen = ({
  dailySeed,
  onBack,
  onOpenLeaderboard,
  onOpenActiveGame,
  onOpenNewMultiplayerGame,
  initialTab = "games",
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
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
  const [gameActionBanner, setGameActionBanner] = useState(null);
  const [selectedOutgoingGameRequest, setSelectedOutgoingGameRequest] =
    useState(null);
  const [selectedActiveGameForDeletion, setSelectedActiveGameForDeletion] =
    useState(null);
  const [selectedActiveGameActionType, setSelectedActiveGameActionType] =
    useState(null);
  const [activeGameFilter, setActiveGameFilter] = useState("active");
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  const unreadCount = unreadNotifications.length;
  const pendingIncomingGames = useMemo(
    () =>
      activeGames.filter(
        (game) => game.status === "pending" && game.direction === "incoming"
      ),
    [activeGames]
  );
  const pendingIncomingRequestIds = useMemo(
    () =>
      new Set(
        pendingIncomingGames
          .map((game) => game?.id)
          .filter(
            (requestId) => typeof requestId === "string" && requestId.length > 0
          )
      ),
    [pendingIncomingGames]
  );
  const unreadGameNotificationCount = useMemo(
    () =>
      unreadNotifications.filter((notification) => {
        const normalizedType = String(notification?.type ?? "").toLowerCase();
        if (!GAME_TAB_NOTIFICATION_TYPES.has(normalizedType)) {
          return false;
        }
        if (normalizedType === "game_request") {
          return false;
        }
        return true;
      }).length,
    [unreadNotifications]
  );
  const gamesTabBadgeCount = pendingIncomingGames.length + unreadGameNotificationCount;
  const friendsTabBadgeCount = incomingRequests.length;
  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends]
  );
  const outgoingRequestReceiverIds = useMemo(
    () => new Set(outgoingRequests.map((request) => request.receiverId)),
    [outgoingRequests]
  );
  const incomingRequestBySenderId = useMemo(
    () =>
      new Map(
        incomingRequests.map((request) => [request.senderId, request])
      ),
    [incomingRequests]
  );

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
    if (!gameActionBanner?.text) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setGameActionBanner(null);
    }, 3600);

    return () => clearTimeout(timeout);
  }, [gameActionBanner]);

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
    if (activeTab === "friends") {
      void refreshFriendState();
    }
  }, [activeTab, refreshFriendState]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    void upsertPresence({ status: "online", lastSessionId: null });
    void refreshUnreadNotifications();
    void refreshFriendState();

    void (async () => {
      const result = await subscribeToMultiplayerInbox({
        channelKey: "menu",
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
        onFriendRequest: () => {
          if (cancelled) return;
          void refreshFriendState();
        },
        onFriendRequestSent: () => {
          if (cancelled) return;
          void refreshFriendState();
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
  }, [refreshFriendState, refreshGameRequests, refreshUnreadNotifications]);

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

  const groupedGames = useMemo(
    () => groupAndSortGames(activeGames, activeGameFilter),
    [activeGames, activeGameFilter]
  );

  const handleOpenGame = async (game) => {
    if (!game) return;
    if (!game.sessionId || typeof game.sessionId !== "string") {
      setGameRequestsError(
        "This multiplayer game could not be opened because the session is missing."
      );
      return;
    }
    const latestUnreadResult = await fetchUnreadMultiplayerNotifications(20);
    const candidateUnreadNotifications = latestUnreadResult?.ok
      ? (latestUnreadResult.notifications ?? [])
      : unreadNotifications;
    if (latestUnreadResult?.ok) {
      setUnreadNotifications(candidateUnreadNotifications);
    }

    const targetSessionId = String(game.sessionId);
    const targetRequestId =
      typeof game.id === "string" && game.id.length > 0 ? game.id : null;
    const sessionNotificationIds = candidateUnreadNotifications
      .filter((notification) => {
        const notificationSessionId = getNotificationSessionId(notification);
        const notificationRequestId = getNotificationRequestId(notification);
        return (
          (notificationSessionId != null &&
            String(notificationSessionId) === targetSessionId) ||
          (targetRequestId != null &&
            notificationRequestId != null &&
            String(notificationRequestId) === targetRequestId)
        );
      })
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

  const renderGameCard = (game) => {
    const archivedCompletedLabel = game.archived
      ? formatArchivedCompletedDate(
          game.completedAt ?? game.updatedAt ?? game.createdAt ?? null
        )
      : null;

    return (
    <Pressable
      key={game.id}
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
        game.archived && styles.archivedCard,
      ]}
      onPress={() => {
        if (game.status === "pending" && game.direction === "outgoing") {
          setSelectedOutgoingGameRequest(game);
          return;
        }

        if (game.status === "accepted") {
          if (!game.sessionId || typeof game.sessionId !== "string") {
            setGameRequestsError(
              "This multiplayer game could not be opened because the session is missing."
            );
            return;
          }
          void handleOpenGame(game);
        }
      }}
      onLongPress={() => {
        if (game.status === "accepted") {
          setSelectedActiveGameForDeletion(game);
          setSelectedActiveGameActionType(null);
        }
      }}
      delayLongPress={350}
    >
      <View style={styles.cardRow}>
        <Text
          style={[
            styles.cardTitle,
            { color: theme.cardTitle },
            game.archived && styles.archivedCardTitle,
          ]}
        >
          {game.friendName}
        </Text>
        <Text style={[styles.cardBadge, { color: theme.cardBadge }]}>
          {game.status === "pending"
            ? game.direction === "incoming"
              ? "Request"
              : "Pending"
            : game.needsAction
              ? "Your Turn"
                : game.archived
                  ? "Archived"
                  : "Their Turn"}
        </Text>
      </View>
      {game.hasUnreadSessionUpdate ? (
        <Text style={[styles.cardUnreadText, { color: theme.cardUnreadText }]}>
          New activity
        </Text>
      ) : null}
      {game.archived && archivedCompletedLabel ? (
        <Text style={[styles.archivedCardDate, { color: theme.cardMeta }]}>
          Completed {archivedCompletedLabel}
        </Text>
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
                const acceptedRequestNotificationIds = unreadNotifications
                  .filter((notification) => {
                    const requestNotificationId =
                      getNotificationRequestId(notification);
                    return (
                      requestNotificationId != null &&
                      String(requestNotificationId) === String(game.id)
                    );
                  })
                  .map((notification) => notification.id);
                if (acceptedRequestNotificationIds.length > 0) {
                  await markMultiplayerNotificationsRead(
                    acceptedRequestNotificationIds
                  );
                  await refreshUnreadNotifications();
                }
                await refreshGameRequests();
                setGameActionBanner({
                  text: `Game with ${game.friendName} accepted`,
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
      ) : game.status === "accepted" && game.archived !== true ? (
        <TouchableOpacity
          style={styles.primaryInlineButton}
          onPress={() => {
            void handleOpenGame(game);
          }}
        >
          <Text style={styles.primaryInlineButtonText}>Open Game</Text>
        </TouchableOpacity>
      ) : game.status !== "accepted" ? (
        <Text style={[styles.cardAction, { color: theme.cardAction }]}>
          {game.direction === "outgoing"
            ? "Waiting for response"
            : "Request pending"}
        </Text>
      ) : null}
    </Pressable>
    );
  };

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

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.title }]}>Multiplayer</Text>
        <TouchableOpacity
          style={[
            styles.leaderboardButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={onOpenLeaderboard}
        >
          <Text style={[styles.leaderboardButtonText, { color: theme.accentText }]}>
            High Scores
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: theme.subtitle }]}>
        Start or resume games with friends.
      </Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            activeTab === "games" && styles.tabButtonActive,
            activeTab === "games" && {
              backgroundColor: theme.activePill,
              borderColor: theme.activePill,
            },
          ]}
          onPress={() => setActiveTab("games")}
        >
          <View style={styles.tabLabelRow}>
            <Text
              style={[
                styles.tabButtonText,
                { color: theme.tabText },
                activeTab === "games" && styles.tabButtonTextActive,
                activeTab === "games" && { color: theme.tabTextActive },
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
          style={[
            styles.tabButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            activeTab === "friends" && styles.tabButtonActive,
            activeTab === "friends" && {
              backgroundColor: theme.activePill,
              borderColor: theme.activePill,
            },
          ]}
          onPress={() => setActiveTab("friends")}
        >
          <View style={styles.tabLabelRow}>
            <Text
              style={[
                styles.tabButtonText,
                { color: theme.tabText },
                activeTab === "friends" && styles.tabButtonTextActive,
                activeTab === "friends" && { color: theme.tabTextActive },
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
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
                activeGameFilter === "active" && styles.filterChipActive,
                activeGameFilter === "active" && {
                  borderColor: theme.activePill,
                  backgroundColor: theme.activePill,
                },
              ]}
              onPress={() => setActiveGameFilter("active")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.tabText },
                  activeGameFilter === "active" && styles.filterChipTextActive,
                  activeGameFilter === "active" && { color: theme.tabTextActive },
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
                activeGameFilter === "all" && styles.filterChipActive,
                activeGameFilter === "all" && {
                  borderColor: theme.activePill,
                  backgroundColor: theme.activePill,
                },
              ]}
              onPress={() => setActiveGameFilter("all")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.tabText },
                  activeGameFilter === "all" && styles.filterChipTextActive,
                  activeGameFilter === "all" && { color: theme.tabTextActive },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
                activeGameFilter === "your_turn" && styles.filterChipActive,
                activeGameFilter === "your_turn" && {
                  borderColor: theme.activePill,
                  backgroundColor: theme.activePill,
                },
              ]}
              onPress={() => setActiveGameFilter("your_turn")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.tabText },
                  activeGameFilter === "your_turn" &&
                    styles.filterChipTextActive,
                  activeGameFilter === "your_turn" && { color: theme.tabTextActive },
                ]}
              >
                Your Turn
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
                activeGameFilter === "pending" && styles.filterChipActive,
                activeGameFilter === "pending" && {
                  borderColor: theme.activePill,
                  backgroundColor: theme.activePill,
                },
              ]}
              onPress={() => setActiveGameFilter("pending")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.tabText },
                  activeGameFilter === "pending" && styles.filterChipTextActive,
                  activeGameFilter === "pending" && { color: theme.tabTextActive },
                ]}
              >
                Pending
              </Text>
            </TouchableOpacity>
          </View>
          {gameRequestsLoading ? (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                Loading Games
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                Pulling your multiplayer requests now.
              </Text>
            </View>
          ) : gameActionBanner?.text ? (
            <View style={styles.gameActionBanner}>
              <Text style={styles.gameActionBannerText}>{gameActionBanner.text}</Text>
            </View>
          ) : null}
          {gameRequestsLoading ? null : gameRequestsError ? (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                Could Not Load Games
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                {gameRequestsError}
              </Text>
            </View>
          ) : activeGames.length === 0 ? (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                No Active Games
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                Start a multiplayer run from the Friends tab.
              </Text>
            </View>
          ) : (
            <>
              {groupedGames.yourTurn.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                    Your Turn
                  </Text>
                  {groupedGames.yourTurn.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.waiting.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                    Their Turn
                  </Text>
                  {groupedGames.waiting.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.pending.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                    Pending Requests
                  </Text>
                  {groupedGames.pending.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.archived.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                    Completed / Archived
                  </Text>
                  {groupedGames.archived.map((game) => renderGameCard(game))}
                </View>
              ) : null}
              {groupedGames.yourTurn.length === 0 &&
              groupedGames.waiting.length === 0 &&
              groupedGames.pending.length === 0 &&
              groupedGames.archived.length === 0 ? (
                <View
                  style={[
                    styles.emptyStateCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                    No Games In Filter
                  </Text>
                  <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
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
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                  color: theme.cardTitle,
                },
              ]}
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
              placeholderTextColor={theme.inputPlaceholder}
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
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  Searching
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                  Looking for that username now.
                </Text>
              </View>
            ) : friendSearchError ? (
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  Search Failed
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                  {friendSearchError}
                </Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  No Users Found
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                  No users found with that username.
                </Text>
              </View>
            ) : (
              searchResults.map((friend) => {
                const alreadyFriends = friendIds.has(friend.id);
                const hasPendingOutgoingRequest = outgoingRequestReceiverIds.has(
                  friend.id
                );
                const matchingIncomingRequest =
                  incomingRequestBySenderId.get(friend.id) ?? null;
                const hasPendingIncomingRequest = matchingIncomingRequest != null;
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
                  <View
                    key={friend.id}
                    style={[
                      styles.searchResultRow,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    >
                      <View style={styles.searchResultTextWrap}>
                      <Text style={[styles.friendName, { color: theme.cardTitle }]}>
                        @{friend.name}
                      </Text>
                      {friend.displayName ? (
                        <Text style={[styles.searchResultMeta, { color: theme.cardMeta }]}>
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
                          if (matchingIncomingRequest) {
                            void handleAcceptFriendRequest(
                              matchingIncomingRequest
                            );
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
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  Loading Friends
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                  Pulling your requests and friends now.
                </Text>
              </View>
            ) : friendsError ? (
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  Could Not Load Friends
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
                  {friendsError}
                </Text>
              </View>
            ) : incomingRequests.length > 0 || friends.length > 0 ? (
              <>
                {incomingRequests.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                      Friend Requests
                    </Text>
                    {incomingRequests.map((request) => (
                      <View
                        key={request.id}
                        style={[
                          styles.searchResultRow,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.searchResultTextWrap}>
                          <Text style={[styles.friendName, { color: theme.cardTitle }]}>
                            @{request.name}
                          </Text>
                          {request.displayName ? (
                            <Text style={[styles.searchResultMeta, { color: theme.cardMeta }]}>
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
                    <Text style={[styles.sectionTitle, { color: theme.cardMeta }]}>
                      Friends
                    </Text>
                    {friends.map((friend) => {
                      const isSelected = selectedFriendId === friend.id;
                      return (
                        <View key={friend.id} style={styles.friendRowWrap}>
                          <Pressable
                            style={[
                              styles.friendRow,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                            onPress={() =>
                              setSelectedFriendId((current) =>
                                current === friend.id ? null : friend.id
                              )
                            }
                          >
                            <Text style={[styles.friendName, { color: theme.cardTitle }]}>
                              {friend.name}
                            </Text>
                            <Text style={[styles.friendHint, { color: theme.cardMeta }]}>
                              Options
                            </Text>
                          </Pressable>

                          {isSelected ? (
                            <View
                              style={[
                                styles.friendActionPanel,
                                {
                                  backgroundColor: theme.surface,
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.friendActionButton}
                                onPress={() => setPlayPanelFriend(friend)}
                              >
                                <Text
                                  style={[
                                    styles.friendActionText,
                                    isDarkMode ? styles.friendActionTextDark : null,
                                  ]}
                                >
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
              <View
                style={[
                  styles.emptyStateCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.cardTitle }]}>
                  No Friends Yet
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.cardMeta }]}>
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
        isDarkMode={isDarkMode}
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
        isDarkMode={isDarkMode}
        onClose={() => setFriendActionMessage(null)}
      />
      <PendingGameRequestModal
        visible={selectedOutgoingGameRequest != null}
        isDarkMode={isDarkMode}
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
        visible={
          selectedActiveGameForDeletion != null &&
          selectedActiveGameActionType != null
        }
        isDarkMode={isDarkMode}
        friendName={selectedActiveGameForDeletion?.friendName ?? null}
        title={
          selectedActiveGameActionType === "archive"
            ? "Archive Game?"
            : "Delete Active Game?"
        }
        body={
          selectedActiveGameForDeletion?.friendName
            ? `This will forfeit your game with @${selectedActiveGameForDeletion.friendName} and return you to the main menu.`
            : "This will forfeit this game and return you to the main menu."
        }
        confirmLabel={
          selectedActiveGameActionType === "archive"
            ? "Archive Game"
            : "Delete Game"
        }
        confirmBusyLabel={
          selectedActiveGameActionType === "archive" ? "Archiving" : "Deleting"
        }
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
          setSelectedActiveGameActionType(null);
          setSelectedActiveGameForDeletion(null);
        }}
        onConfirm={() => {
          if (!selectedActiveGameForDeletion) {
            return;
          }

          void (async () => {
            setPendingGameActionId(selectedActiveGameForDeletion.id);
            const result =
              selectedActiveGameActionType === "archive"
                ? await archiveMultiplayerSessionForUser({
                    sessionId: selectedActiveGameForDeletion.sessionId,
                  })
                : await deleteAcceptedMultiplayerGame({
                    requestId: selectedActiveGameForDeletion.id,
                    sessionId: selectedActiveGameForDeletion.sessionId,
                  });
            if (!result.ok) {
              setGameRequestsError(
                result.errorMessage ??
                  `Could not ${
                    selectedActiveGameActionType === "archive"
                      ? "archive"
                      : "delete"
                  } that multiplayer game.`
              );
              setPendingGameActionId(null);
              return;
            }
            setSelectedActiveGameActionType(null);
            setSelectedActiveGameForDeletion(null);
            await refreshGameRequests();
            setPendingGameActionId(null);
            onBack?.();
          })();
        }}
      />
      <Modal
        visible={
          selectedActiveGameForDeletion != null &&
          selectedActiveGameActionType == null
        }
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedActiveGameForDeletion(null)}
      >
        <View style={styles.actionModalBackdrop}>
          <View style={styles.actionModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.actionModalTitle}>Game Actions</Text>
            <TouchableOpacity
              style={styles.actionModalButton}
              onPress={() => setSelectedActiveGameActionType("archive")}
            >
              <Text style={styles.actionModalButtonText}>Archive Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionModalButton, styles.actionModalButtonDanger]}
              onPress={() => setSelectedActiveGameActionType("delete")}
            >
              <Text style={styles.actionModalButtonDangerText}>Delete Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionModalCancelButton}
              onPress={() => setSelectedActiveGameForDeletion(null)}
            >
              <Text style={styles.actionModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  actionModalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fffaf2",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfcd",
  },
  actionModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 12,
  },
  actionModalButton: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2d3bb",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionModalButtonText: {
    color: "#2c3e50",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  actionModalButtonDanger: {
    borderColor: "#f3b3ad",
    backgroundColor: "#fff5f4",
  },
  actionModalButtonDangerText: {
    color: "#b42318",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  actionModalCancelButton: {
    marginTop: 10,
    paddingVertical: 12,
  },
  actionModalCancelText: {
    color: "#9a6b2f",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
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
  archivedCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
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
  archivedCardTitle: {
    fontSize: 18,
    fontWeight: "800",
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
  cardUnreadText: {
    marginTop: 8,
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
  },
  archivedCardDate: {
    marginTop: 6,
    color: "#6f6659",
    fontSize: 12,
    fontWeight: "700",
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
  gameActionBanner: {
    backgroundColor: "#ecfdf3",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#9dd8b8",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gameActionBannerText: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
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
  friendActionTextDark: {
    color: "#ffffff",
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

const LIGHT_THEME = {
  background: "#f8f4ed",
  surface: "#fff",
  border: "#e3d3b9",
  activePill: "#2f6f4f",
  backButton: "#2f6f4f",
  title: "#22313f",
  subtitle: "#6a736f",
  accentText: "#2f6f4f",
  tabText: "#22313f",
  tabTextActive: "#fff",
  cardBackground: "#fffdf8",
  cardBorder: "#e6d8be",
  cardTitle: "#22313f",
  cardBadge: "#2f6f4f",
  cardMeta: "#6f6659",
  cardUnreadText: "#b45309",
  cardAction: "#d97706",
  inputPlaceholder: "#8b8d7a",
};

const DARK_THEME = {
  background: "#0b1220",
  surface: "#152033",
  border: "#334155",
  activePill: "#166534",
  backButton: "#86efac",
  title: "#f8fafc",
  subtitle: "#cbd5e1",
  accentText: "#86efac",
  tabText: "#e2e8f0",
  tabTextActive: "#f8fafc",
  cardBackground: "#111b2c",
  cardBorder: "#334155",
  cardTitle: "#f1f5f9",
  cardBadge: "#86efac",
  cardMeta: "#94a3b8",
  cardUnreadText: "#fdba74",
  cardAction: "#f59e0b",
  inputPlaceholder: "#94a3b8",
};

export default MultiplayerMenuScreen;
