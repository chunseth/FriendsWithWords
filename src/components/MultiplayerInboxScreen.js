import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  fetchMultiplayerNotifications,
  markMultiplayerNotificationsRead,
  subscribeToMultiplayerInbox,
} from "../services/multiplayerInboxService";

const formatRelativeTime = (isoDate) => {
  if (!isoDate) return "";
  const createdAt = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - createdAt);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const buildRowText = (notification) => {
  switch (notification?.type) {
    case "friend_request":
      return {
        title: "Friend request",
        body: "Someone sent you a friend request.",
      };
    case "game_request":
      return {
        title: "Game request",
        body: "A friend challenged you to a game.",
      };
    case "request_accepted":
      return {
        title: "Request accepted",
        body: "Your friend accepted the game request.",
      };
    case "turn_ready":
      return {
        title: "Your turn",
        body: "It is your turn to play.",
      };
    case "reminder":
      return {
        title: "Turn reminder",
        body: "Your multiplayer turn is waiting.",
      };
    default:
      return {
        title: "Multiplayer update",
        body: "You have a multiplayer update.",
      };
  }
};

const MultiplayerInboxScreen = ({
  onBack,
  onOpenSession,
  onOpenFriends,
}) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshTimeoutRef = useRef(null);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const unreadResult = await fetchMultiplayerNotifications({
      unreadOnly: true,
      limit: 50,
    });
    const allResult = await fetchMultiplayerNotifications({
      unreadOnly: false,
      limit: 100,
    });

    if (!unreadResult.ok || !allResult.ok) {
      setLoading(false);
      setError("Could not load multiplayer notifications right now.");
      return;
    }

    const unreadById = new Set(
      (unreadResult.notifications ?? []).map((notification) => notification.id)
    );
    const merged = (allResult.notifications ?? []).map((notification) => ({
      ...notification,
      isUnread: unreadById.has(notification.id),
    }));
    setNotifications(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    let unsubscribe = () => {};
    void (async () => {
      const result = await subscribeToMultiplayerInbox({
        channelKey: "inbox-screen",
        onNotification: () => {
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }
          refreshTimeoutRef.current = setTimeout(() => {
            refreshTimeoutRef.current = null;
            void refreshNotifications();
          }, 150);
        },
      });

      if (result.ok) {
        unsubscribe = result.unsubscribe;
      }
    })();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [refreshNotifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => notification.isUnread),
    [notifications]
  );
  const earlierNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isUnread),
    [notifications]
  );

  const handleNotificationPress = useCallback(
    async (notification) => {
      if (notification?.isUnread) {
        await markMultiplayerNotificationsRead([notification.id]);
      }

      const route = notification?.payload?.route ?? "multiplayer-menu";
      if (route === "multiplayer") {
        const sessionId = notification?.payload?.sessionId ?? notification?.entity_id;
        if (sessionId) {
          onOpenSession?.(sessionId);
          return;
        }
      }

      onOpenFriends?.();
    },
    [onOpenFriends, onOpenSession]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadNotifications.length === 0) return;
    await markMultiplayerNotificationsRead(
      unreadNotifications.map((notification) => notification.id)
    );
    await refreshNotifications();
  }, [refreshNotifications, unreadNotifications]);

  const renderSection = (title, rows) => (
    <View style={styles.section} key={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No notifications</Text>
      ) : (
        rows.map((notification) => {
          const rowText = buildRowText(notification);
          return (
            <TouchableOpacity
              key={notification.id}
              style={styles.row}
              onPress={() => {
                void handleNotificationPress(notification);
              }}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{rowText.title}</Text>
                <Text style={styles.rowTime}>
                  {formatRelativeTime(notification.created_at)}
                </Text>
              </View>
              <Text style={styles.rowBody}>{rowText.body}</Text>
              {notification.isUnread ? <View style={styles.unreadDot} /> : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Inbox</Text>
        <TouchableOpacity onPress={() => void handleMarkAllRead()}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      {loading ? <Text style={styles.info}>Loading notifications...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={styles.content}>
        {renderSection("Unread", unreadNotifications)}
        {renderSection("Earlier", earlierNotifications)}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    color: "#2f6f4f",
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2933",
  },
  markAll: {
    color: "#4f46e5",
    fontWeight: "700",
    fontSize: 12,
  },
  content: {
    padding: 16,
    gap: 18,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2933",
  },
  row: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    position: "relative",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  rowTime: {
    fontSize: 12,
    color: "#6b7280",
  },
  rowBody: {
    fontSize: 13,
    color: "#374151",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    position: "absolute",
    top: 10,
    right: 10,
  },
  info: {
    paddingHorizontal: 20,
    color: "#4b5563",
    fontSize: 13,
  },
  error: {
    paddingHorizontal: 20,
    color: "#b91c1c",
    fontSize: 13,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
});

export default MultiplayerInboxScreen;
