import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  AppState,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
  Platform,
  UIManager,
  LayoutAnimation,
  InteractionManager,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import SFSymbolIcon from "./components/SFSymbolIcon";
import { useGame } from "./hooks/useGame";
import { dictionary } from "./utils/dictionary";
import GameBoard from "./components/GameBoard";
import TileRack from "./components/TileRack";
import GameInfo from "./components/GameInfo";
import PlayGameMenu from "./components/PlayGameMenu";
import InGameMenu from "./components/InGameMenu";
import MainMenuScreen from "./components/MainMenuScreen";
import LeaderboardScreen from "./components/LeaderboardScreen";
import StatsScreen from "./components/StatsScreen";
import MultiplayerMenuScreen from "./components/MultiplayerMenuScreen";
import MultiplayerModeScreen from "./components/MultiplayerModeScreen";
import MultiplayerNotificationBanner from "./components/MultiplayerNotificationBanner";
import ConfirmLeaveGameModal from "./components/ConfirmLeaveGameModal";
import MessageOverlay from "./components/MessageOverlay";
import LetterPickerModal from "./components/LetterPickerModal";
import EndGameModal from "./components/EndGameModal";
import LeaderboardConsentModal from "./components/LeaderboardConsentModal";
import DeleteAccountModal from "./components/DeleteAccountModal";
import SettingsModal from "./components/SettingsModal";
import { useTileDragDropController } from "./hooks/useTileDragDropController";
import {
  buildUpdatedScoreRecords,
  getDefaultScoreRecords,
  loadScoreRecords,
  saveScoreRecords,
} from "./utils/scoreStorage";
import {
  buildUpdatedStats,
  getDefaultStats,
  loadStats,
  saveStats,
} from "./utils/statsStorage";
import {
  clearGameSnapshotPayload,
  loadGameSnapshotPayload,
  saveGameSnapshotPayload,
} from "./utils/gameSnapshotStorage";
import {
  fetchGlobalLeaderboard,
  fetchPlayerHighScorePosition,
  fetchSeedLeaderboardByMode,
  LEADERBOARD_SCORE_MODE_MULTIPLAYER,
  LEADERBOARD_SCORE_MODE_SOLO,
  submitCompletedScore,
} from "./services/leaderboardService";
import { saveRemotePlayerProfile } from "./services/profileService";
import { deleteRemoteAccount } from "./services/accountDeletionService";
import { isBackendConfigured } from "./config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "./lib/supabase";
import {
  clearPlayerProfile,
  loadOrCreatePlayerProfile,
  savePlayerDisplayName,
} from "./utils/playerProfile";
import {
  LEADERBOARD_CONSENT_DENIED,
  LEADERBOARD_CONSENT_GRANTED,
  clearLeaderboardConsentStatus,
  loadLeaderboardConsentStatus,
  saveLeaderboardConsentStatus,
} from "./utils/leaderboardConsentStorage";
import {
  loadDarkModeEnabledPreference,
  saveDarkModeEnabledPreference,
} from "./utils/themePreferenceStorage";
import { clearMultiplayerSession } from "./utils/multiplayerSessionStorage";
import {
  fetchUnreadMultiplayerNotifications,
  markMultiplayerNotificationsRead,
  subscribeToMultiplayerInbox,
  upsertPresence,
} from "./services/multiplayerInboxService";
import {
  fetchMultiplayerNotificationSettings,
  saveMultiplayerNotificationSettings,
} from "./services/multiplayerNotificationSettingsService";
import {
  initializePushNotifications,
  setApplicationBadgeCount,
} from "./services/pushNotificationService";

const CONTROL_ICON_SIZE = 22;
const RACK_DROP_EXPANSION_TOP = 200;
const IPAD_RACK_DROP_EXPANSION_TOP_EXTRA = 1000;
const DRAG_TILE_HALF_SIZE = 21;
const DRAG_RACK_SETTLE_DURATION = 30;
const DRAG_BOARD_SETTLE_DURATION = 30;
const DRAG_RACK_RETURN_DURATION = 340;
const BOARD_TILE_PICKUP_SLOP = 35;
const DRAG_BOARD_PICKUP_DURATION = 30;
const DRAG_RACK_PICKUP_DURATION = 30;
const SWAP_TILE_LIFT = 20;
const SWAP_TILE_EXIT_LIFT = 40;
const SWAP_TILE_LIFT_DURATION = 300;
const SWAP_TILE_EXIT_DURATION = 160;
const SWAP_TILE_ENTER_DURATION = 120;
const SWAP_LAYOUT_DURATION = 180;
const SWAP_STEP_DELAY = 70;
const SWAP_MULTIPLIER_POP_DURATION = 300;
const SWAP_SCORE_REPLACE_DURATION = 300;
const SWAP_MULTIPLIER_HOLD_DURATION = 500;
const FRESH_NOTIFICATION_WINDOW_MS = 20 * 1000;
const SCRABBLE_BANNER_FADE_IN_DURATION = 140;
const SCRABBLE_BANNER_VISIBLE_DURATION = 1100;
const SCRABBLE_BANNER_FADE_OUT_DURATION = 220;
const MULTIPLAYER_BANNER_DEDUPE_WINDOW_MS = 60000;
const ENABLE_MULTIPLAYER_BANNER_DEBUG_LOGS = false;

const BOARD_SIZE = 15;

const getDailySeed = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const getMillisecondsUntilNextLocalMidnight = (date = new Date()) => {
  const nextMidnight = new Date(date);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - date.getTime());
};

const getLeaderboardSubmitErrorMessage = (result) => {
  if (!result || result.ok) {
    return null;
  }

  const backendMessage =
    typeof result.error?.message === "string" ? result.error.message : "";
  const normalizedBackendMessage = backendMessage.toLowerCase();

  if (
    result.reason === "anonymous_sign_in_failed" ||
    normalizedBackendMessage.includes("anonymous sign-ins are disabled")
  ) {
    return "Score submit failed: enable Anonymous sign-ins in Supabase Auth.";
  }

  if (result.reason === "session_lookup_failed") {
    return "Score submit failed: could not establish a Supabase session.";
  }

  if (
    result.reason === "lookup_failed" ||
    result.reason === "write_failed" ||
    normalizedBackendMessage.includes("row-level security") ||
    normalizedBackendMessage.includes("permission denied")
  ) {
    return "Score submit failed: apply the latest Supabase leaderboard policies and confirm Anonymous sign-ins are enabled.";
  }

  if (
    normalizedBackendMessage.includes("network request failed") ||
    normalizedBackendMessage.includes("failed to fetch")
  ) {
    return "Score submit failed: could not reach Supabase.";
  }

  return "Failed to submit latest score";
};

const logMultiplayerBannerDebug = (message, payload = null) => {
  if (!__DEV__ || !ENABLE_MULTIPLAYER_BANNER_DEBUG_LOGS) {
    return;
  }
  if (payload == null) {
    console.log(`[mp-banner] ${message}`);
    return;
  }
  console.log(`[mp-banner] ${message}`, payload);
};

const getFriendLabel = (payload = {}) =>
  payload.friendName ||
  payload.friendUsername ||
  payload.friendDisplayName ||
  payload.actorLabel ||
  "A friend";

const buildMultiplayerBannerMessage = ({
  type,
  payload = {},
  title = null,
  body = null,
}) => {
  if (typeof body === "string" && body.trim().length > 0) {
    return {
      title: title ?? "Multiplayer",
      text: body.trim(),
    };
  }

  const friendName = getFriendLabel(payload);
  if (type === "friend_request") {
    return { title: "Friend Request", text: `${friendName} sent you a friend request.` };
  }
  if (type === "game_request") {
    return { title: "Game Request", text: `${friendName} wants to play a game with you.` };
  }
  if (type === "turn_ready") {
    return { title: "Your Turn", text: `It's your turn with ${friendName}.` };
  }
  if (type === "request_accepted") {
    return { title: "Request Accepted", text: `${friendName} accepted your game request.` };
  }
  if (type === "reminder") {
    return { title: "Turn Reminder", text: "Your multiplayer turn is waiting." };
  }

  return { title: "Multiplayer Update", text: "You have a new multiplayer update." };
};

const getMultiplayerNotificationNavigationTarget = ({
  type = null,
  payload = {},
  body = null,
}) => {
  const normalizedType =
    typeof type === "string" ? type.trim().toLowerCase() : "";
  const normalizedBody =
    typeof body === "string" ? body.trim().toLowerCase() : "";

  if (
    normalizedType === "friend_request" ||
    normalizedType === "friend_request_accepted"
  ) {
    return { screen: "multiplayer-menu", tab: "friends" };
  }

  if (
    normalizedType === "game_request" ||
    normalizedType === "request_accepted" ||
    normalizedType === "turn_ready" ||
    normalizedType === "reminder"
  ) {
    return { screen: "multiplayer-menu", tab: "games" };
  }

  if (
    normalizedBody.includes("sent you a friend request") ||
    normalizedBody.includes("accepted your friend request")
  ) {
    return { screen: "multiplayer-menu", tab: "friends" };
  }

  if (
    normalizedBody.includes("wants to start a game") ||
    normalizedBody.includes("wants to play") ||
    normalizedBody.includes("played their turn") ||
    normalizedBody.includes("your turn")
  ) {
    return { screen: "multiplayer-menu", tab: "games" };
  }

  if (payload?.route === "multiplayer-menu") {
    return { screen: "multiplayer-menu", tab: "games" };
  }

  return null;
};

const getMultiplayerNotificationSessionId = (notificationLike = {}) => {
  const payload = notificationLike?.payload ?? notificationLike?.data ?? {};
  return (
    payload?.sessionId ??
    payload?.session_id ??
    notificationLike?.entity_id ??
    null
  );
};

const getMultiplayerNotificationRequestId = (notificationLike = {}) => {
  const payload = notificationLike?.payload ?? notificationLike?.data ?? {};
  return payload?.requestId ?? payload?.request_id ?? notificationLike?.entity_id ?? null;
};

const buildMultiplayerNotificationEventKey = ({
  id = null,
  type = null,
  payload = {},
  entityId = null,
  title = null,
  body = null,
} = {}) => {
  const normalizedType =
    typeof type === "string" ? type.trim().toLowerCase() : "unknown";
  const sessionId =
    payload?.sessionId ??
    payload?.session_id ??
    entityId ??
    null;
  const requestId =
    payload?.requestId ??
    payload?.request_id ??
    null;
  const actorLabel =
    payload?.actorLabel ??
    payload?.actor_label ??
    payload?.friendName ??
    payload?.friendUsername ??
    payload?.friendDisplayName ??
    null;
  const friendId =
    payload?.friendId ??
    payload?.friend_id ??
    null;
  const route = payload?.route ?? null;
  if (normalizedType === "turn_ready" || normalizedType === "reminder") {
    return `type:${normalizedType}|session:${sessionId ?? "none"}`;
  }
  if (normalizedType === "request_accepted") {
    return [
      `type:${normalizedType}`,
      `session:${sessionId ?? "none"}`,
      `request:${requestId ?? "none"}`,
    ].join("|");
  }
  if (typeof id === "string" && id.length > 0) {
    return `id:${id}`;
  }

  return [
    `type:${normalizedType}`,
    `session:${sessionId ?? "none"}`,
    `request:${requestId ?? "none"}`,
    `friend:${friendId ?? "none"}`,
    `actor:${actorLabel ?? "none"}`,
    `route:${route ?? "none"}`,
  ].join("|");
};

function App() {
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [playMenuVisible, setPlayMenuVisible] = useState(false);
  const [inGameMenuVisible, setInGameMenuVisible] = useState(false);
  const [confirmLeaveGameVisible, setConfirmLeaveGameVisible] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [savedGamePayload, setSavedGamePayload] = useState(null);
  const [homeScreen, setHomeScreen] = useState("main");
  const [multiplayerMenuInitialTab, setMultiplayerMenuInitialTab] =
    useState("games");
  const [leaderboardInitialPage, setLeaderboardInitialPage] = useState(
    "highScores"
  );
  const [activeMultiplayerSessionId, setActiveMultiplayerSessionId] =
    useState("local-multiplayer-prototype");
  const [dailySeed, setDailySeed] = useState(() => getDailySeed());
  const [scoreRecords, setScoreRecords] = useState(getDefaultScoreRecords);
  const [playerStats, setPlayerStats] = useState(getDefaultStats);
  const [activeDailySeed, setActiveDailySeed] = useState(null);
  const [endGameSummary, setEndGameSummary] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [leaderboardConsentStatus, setLeaderboardConsentStatus] =
    useState(null);
  const [leaderboardConsentLoaded, setLeaderboardConsentLoaded] =
    useState(false);
  const [leaderboardConsentModalVisible, setLeaderboardConsentModalVisible] =
    useState(false);
  const [leaderboardConsentModalSource, setLeaderboardConsentModalSource] =
    useState("gameOver");
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] =
    useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState(null);
  const [inAppMultiplayerBanner, setInAppMultiplayerBanner] = useState(null);
  const [multiplayerNotificationsEnabled, setMultiplayerNotificationsEnabled] =
    useState(true);
  const [pendingLeaderboardSubmission, setPendingLeaderboardSubmission] =
    useState(null);
  const [startupTasksReady, setStartupTasksReady] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [multiplayerLeaderboardEntries, setMultiplayerLeaderboardEntries] =
    useState([]);
  const [multiplayerLeaderboardLoading, setMultiplayerLeaderboardLoading] =
    useState(false);
  const [multiplayerLeaderboardError, setMultiplayerLeaderboardError] =
    useState(null);
  const [dailyLeaderboardEntries, setDailyLeaderboardEntries] = useState([]);
  const [dailyLeaderboardLoading, setDailyLeaderboardLoading] = useState(false);
  const [dailyLeaderboardError, setDailyLeaderboardError] = useState(null);
  const [leaderboardPosition, setLeaderboardPosition] = useState(null);
  const [leaderboardPositionLoading, setLeaderboardPositionLoading] =
    useState(false);
  const [leaderboardPositionError, setLeaderboardPositionError] =
    useState(null);
  const [leaderboardSelectedDailySeed, setLeaderboardSelectedDailySeed] =
    useState(null);
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [clearedRackTileIds, setClearedRackTileIds] = useState([]);
  const [pendingBlankPlacement, setPendingBlankPlacement] = useState(null);
  const [swapAnimating, setSwapAnimating] = useState(false);
  const [swapAnimatedPenalty, setSwapAnimatedPenalty] = useState(0);
  const [swapDisplayRack, setSwapDisplayRack] = useState(null);
  const [rackTileAnimationStates, setRackTileAnimationStates] = useState({});
  const [showScrabbleBanner, setShowScrabbleBanner] = useState(false);
  const [gameInfoFlavor, setGameInfoFlavor] = useState(null);
  const [pendingGameInfoFlavor, setPendingGameInfoFlavor] = useState(null);
  const game = useGame();
  const spinValue = useRef(new Animated.Value(0)).current;
  const scrabbleBannerOpacity = useRef(new Animated.Value(0)).current;
  const scrabbleBannerScale = useRef(new Animated.Value(0.92)).current;
  const scrabbleBannerTimeoutRef = useRef(null);
  const dailySeedRefreshTimeoutRef = useRef(null);
  const persistedGameRef = useRef(null);
  const backendSubmitRef = useRef(null);
  const pendingGameReplacementActionRef = useRef(null);
  const boardLayoutRef = useRef(null);
  const safeAreaRef = useRef(null);
  const rackTileAnimationsRef = useRef({});
  const bannerTimeoutRef = useRef(null);
  const lastBannerNotificationIdRef = useRef(null);
  const lastFriendRequestStatusEventKeyRef = useRef(null);
  const profileNameCacheRef = useRef(new Map());
  const authUserIdRef = useRef(null);
  const recentBannerEventKeysRef = useRef(new Map());
  const homeScreenRef = useRef(homeScreen);
  const activeMultiplayerSessionIdRef = useRef(activeMultiplayerSessionId);
  const rackSourceTiles = swapDisplayRack ?? game.tileRack;
  const displayedScore = game.gameOver
    ? game.finalScore
    : game.totalScore - swapAnimatedPenalty;
  const currentDailyHighScore = scoreRecords.dailySeedScores[dailySeed] ?? null;
  const dailySeeds = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return getDailySeed(date);
  });
  const selectedDailyLeaderboardSeed =
    leaderboardSelectedDailySeed ?? dailySeed;
  const rackDropExpansionTop =
    Platform.OS === "ios" && Platform.isPad
      ? RACK_DROP_EXPANSION_TOP + IPAD_RACK_DROP_EXPANSION_TOP_EXTRA
      : RACK_DROP_EXPANSION_TOP;
  const hasPendingTilesOnBoard = useMemo(
    () =>
      (game.board ?? []).some((row) =>
        (row ?? []).some(
          (tile) => tile?.isFromRack === true && tile?.scored !== true
        )
      ),
    [game.board]
  );

  const showMultiplayerBanner = useCallback((nextMessage) => {
    if (!multiplayerNotificationsEnabled) {
      return;
    }
    if (!nextMessage?.text) {
      logMultiplayerBannerDebug("skipping banner with empty text", nextMessage);
      return;
    }
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }
    logMultiplayerBannerDebug("show banner", {
      ...nextMessage,
      authUserId: authUserIdRef.current,
    });
    setInAppMultiplayerBanner(nextMessage);
    bannerTimeoutRef.current = setTimeout(() => {
      bannerTimeoutRef.current = null;
      logMultiplayerBannerDebug("hide banner (timeout)");
      setInAppMultiplayerBanner(null);
    }, 3600);
  }, [multiplayerNotificationsEnabled]);

  useEffect(() => {
    homeScreenRef.current = homeScreen;
  }, [homeScreen]);

  useEffect(() => {
    activeMultiplayerSessionIdRef.current = activeMultiplayerSessionId;
  }, [activeMultiplayerSessionId]);

  useEffect(() => {
    if (!dictionaryLoaded || startupTasksReady || homeScreen === "main") {
      return undefined;
    }

    let cancelled = false;
    let startupDelayTimeout = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      startupDelayTimeout = setTimeout(() => {
        if (!cancelled) {
          setStartupTasksReady(true);
        }
      }, 1200);
    });

    return () => {
      cancelled = true;
      if (startupDelayTimeout) {
        clearTimeout(startupDelayTimeout);
      }
      interactionTask?.cancel?.();
    };
  }, [dictionaryLoaded, homeScreen, startupTasksReady]);

  const shouldDisplayBannerForEvent = useCallback((eventKey) => {
    if (!eventKey) {
      return true;
    }

    const now = Date.now();
    const threshold = now - MULTIPLAYER_BANNER_DEDUPE_WINDOW_MS;
    for (const [key, seenAt] of recentBannerEventKeysRef.current.entries()) {
      if (!Number.isFinite(seenAt) || seenAt < threshold) {
        recentBannerEventKeysRef.current.delete(key);
      }
    }

    if (recentBannerEventKeysRef.current.has(eventKey)) {
      return false;
    }

    recentBannerEventKeysRef.current.set(eventKey, now);
    return true;
  }, []);

  const shouldSuppressNotificationForActiveSession = useCallback(
    ({ type = null, payload = {}, entityId = null }) => {
      if (homeScreenRef.current !== "multiplayer") {
        return false;
      }

      const activeSessionId =
        typeof activeMultiplayerSessionIdRef.current === "string" &&
        activeMultiplayerSessionIdRef.current.length > 0
          ? activeMultiplayerSessionIdRef.current
          : null;
      if (!activeSessionId) {
        return false;
      }

      const sessionId =
        getMultiplayerNotificationSessionId({
          payload,
          entity_id: entityId,
        }) ?? null;
      if (!sessionId) {
        return false;
      }

      return String(sessionId) === String(activeSessionId);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedDarkModeEnabled = await loadDarkModeEnabledPreference();
      if (cancelled) {
        return;
      }
      setDarkModeEnabled(storedDarkModeEnabled);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!startupTasksReady) {
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      const sessionResult = await ensureSupabaseSession();
      if (cancelled || !sessionResult?.ok) {
        return;
      }
      const userId = sessionResult.session?.user?.id ?? null;
      authUserIdRef.current = userId;
      logMultiplayerBannerDebug("resolved auth user", { authUserId: userId });
    })();
    return () => {
      cancelled = true;
    };
  }, [startupTasksReady]);

  const navigateFromNotificationTarget = useCallback((target) => {
    if (!target) {
      return;
    }
    if (target.screen === "multiplayer-menu") {
      setMultiplayerMenuInitialTab(target.tab === "friends" ? "friends" : "games");
      setHomeScreen("multiplayer-menu");
    }
  }, []);

  const handleNotificationOpened = useCallback(
    ({ type = null, payload = {}, body = null }) => {
      const target = getMultiplayerNotificationNavigationTarget({
        type,
        payload,
        body,
      });
      navigateFromNotificationTarget(target);
    },
    [navigateFromNotificationTarget]
  );

  useEffect(() => {
    if (!startupTasksReady) {
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      const result = await fetchMultiplayerNotificationSettings();
      if (cancelled || !result.ok) {
        return;
      }
      const enabled = result.settings?.turn_reminders_enabled;
      setMultiplayerNotificationsEnabled(enabled !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startupTasksReady]);

  const resolveProfileLabelById = useCallback(async (userId) => {
    if (!userId) {
      return "A friend";
    }
    if (profileNameCacheRef.current.has(userId)) {
      return profileNameCacheRef.current.get(userId);
    }
    if (!isBackendConfigured()) {
      return "A friend";
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return "A friend";
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      logMultiplayerBannerDebug("profile lookup failed", {
        userId,
        error: error?.message ?? "unknown_error",
      });
      return "A friend";
    }
    const label =
      data?.username || data?.display_name || "A friend";
    logMultiplayerBannerDebug("profile label resolved", { userId, label });
    profileNameCacheRef.current.set(userId, label);
    return label;
  }, []);

  const buildBannerMessageWithResolvedFriend = useCallback(async ({
    type,
    payload = {},
    title = null,
    body = null,
  }) => {
    if (typeof body === "string" && body.trim().length > 0) {
      return {
        ...buildMultiplayerBannerMessage({ type, payload, title, body }),
        navigationTarget: getMultiplayerNotificationNavigationTarget({
          type,
          payload,
          body,
        }),
      };
    }

    const friendId =
      payload && typeof payload.friendId === "string"
        ? payload.friendId
        : payload && typeof payload.friend_id === "string"
          ? payload.friend_id
          : null;
    if (!friendId) {
      return {
        ...buildMultiplayerBannerMessage({ type, payload, title, body }),
        navigationTarget: getMultiplayerNotificationNavigationTarget({
          type,
          payload,
          body,
        }),
      };
    }

    const friendName = await resolveProfileLabelById(friendId);
    const resolvedPayload = {
      ...payload,
      friendName,
    };
    return {
      ...buildMultiplayerBannerMessage({
        type,
        payload: resolvedPayload,
        title,
        body,
      }),
      navigationTarget: getMultiplayerNotificationNavigationTarget({
        type,
        payload: resolvedPayload,
        body,
      }),
    };
  }, [resolveProfileLabelById]);

  useEffect(() => {
    if (!startupTasksReady) {
      return undefined;
    }

    let unsubscribePush = () => {};
    void (async () => {
      const result = await initializePushNotifications({
        appBuild: "1.3.1",
        deviceId: "local-device",
        onForegroundNotification: (event) => {
          logMultiplayerBannerDebug("foreground push received", event);
          void (async () => {
            const eventKey = buildMultiplayerNotificationEventKey({
              id: event?.data?.notificationId ?? null,
              type: event?.data?.type ?? null,
              payload: event?.data ?? {},
              entityId: event?.data?.entity_id ?? null,
              title: event?.title ?? null,
              body: event?.body ?? null,
            });
            if (!shouldDisplayBannerForEvent(eventKey)) {
              logMultiplayerBannerDebug("suppressing duplicate foreground banner", {
                eventKey,
              });
              return;
            }
            if (
              shouldSuppressNotificationForActiveSession({
                type: event?.data?.type ?? null,
                payload: event?.data ?? {},
                entityId: event?.data?.entity_id ?? null,
              })
            ) {
              logMultiplayerBannerDebug("suppressing foreground banner for active session");
              return;
            }
            const message = await buildBannerMessageWithResolvedFriend({
              type: event?.data?.type ?? null,
              payload: event?.data ?? {},
              title: event?.title ?? null,
              body: event?.body ?? null,
            });
            showMultiplayerBanner(message);
          })();
        },
        onNotificationOpened: (event) => {
          handleNotificationOpened({
            type: event?.data?.type ?? null,
            payload: event?.data ?? {},
            body: event?.body ?? null,
          });
        },
      });

      if (result?.ok && typeof result.unsubscribe === "function") {
        logMultiplayerBannerDebug("push initialized with subscriptions");
        unsubscribePush = result.unsubscribe;
      } else {
        logMultiplayerBannerDebug("push initialization result", result);
      }
    })();

    return () => {
      unsubscribePush();
    };
  }, [
    startupTasksReady,
    buildBannerMessageWithResolvedFriend,
    handleNotificationOpened,
    shouldDisplayBannerForEvent,
    shouldSuppressNotificationForActiveSession,
    showMultiplayerBanner,
  ]);

  useEffect(() => {
    if (!startupTasksReady) {
      return undefined;
    }

    const refreshUnreadNotifications = async ({ showLatestBanner = false } = {}) => {
      const result = await fetchUnreadMultiplayerNotifications(20);
      if (!result.ok) {
        return;
      }

      const unreadNotifications = result.notifications ?? [];
      const suppressedNotificationIds = unreadNotifications
        .filter((notification) =>
          shouldSuppressNotificationForActiveSession({
            type: notification?.type ?? null,
            payload: notification?.payload ?? {},
            entityId: notification?.entity_id ?? null,
          })
        )
        .map((notification) => notification?.id)
        .filter((id) => typeof id === "string" && id.length > 0);

      if (suppressedNotificationIds.length > 0) {
        await markMultiplayerNotificationsRead(suppressedNotificationIds);
        const refreshed = await fetchUnreadMultiplayerNotifications(20);
        if (!refreshed.ok) {
          return;
        }
        const refreshedUnread = refreshed.notifications ?? [];
        void setApplicationBadgeCount(refreshedUnread.length);
        if (!showLatestBanner || !multiplayerNotificationsEnabled) {
          return;
        }
        const latestAfterSuppress = refreshedUnread[0] ?? null;
        if (!latestAfterSuppress?.id || latestAfterSuppress.read_at != null) {
          return;
        }
        if (lastBannerNotificationIdRef.current === latestAfterSuppress.id) {
          return;
        }
        lastBannerNotificationIdRef.current = latestAfterSuppress.id;
        const latestMessage = await buildBannerMessageWithResolvedFriend({
          type: latestAfterSuppress.type,
          payload: latestAfterSuppress.payload ?? {},
        });
        showMultiplayerBanner(latestMessage);
        return;
      }

      const unreadCount = unreadNotifications.length;
      void setApplicationBadgeCount(unreadCount);

      if (!showLatestBanner || !multiplayerNotificationsEnabled) {
        return;
      }

      const latestUnread = unreadNotifications[0] ?? null;
      if (!latestUnread?.id || latestUnread.read_at != null) {
        return;
      }
      const latestUnreadCreatedAtMs = latestUnread?.created_at
        ? new Date(latestUnread.created_at).getTime()
        : 0;
      const isFresh =
        Number.isFinite(latestUnreadCreatedAtMs) &&
        latestUnreadCreatedAtMs > 0 &&
        Date.now() - latestUnreadCreatedAtMs <= FRESH_NOTIFICATION_WINDOW_MS;
      if (!isFresh) {
        logMultiplayerBannerDebug("latest unread not fresh; skipping banner", {
          id: latestUnread.id,
          createdAt: latestUnread.created_at ?? null,
        });
        return;
      }
      if (lastBannerNotificationIdRef.current === latestUnread.id) {
        return;
      }
      lastBannerNotificationIdRef.current = latestUnread.id;
      const message = await buildBannerMessageWithResolvedFriend({
        type: latestUnread.type,
        payload: latestUnread.payload ?? {},
      });
      showMultiplayerBanner(message);

    };

    void upsertPresence({ status: "online", lastSessionId: null });
    void refreshUnreadNotifications();
    let unsubscribeInbox = () => {};
    void (async () => {
      const subscription = await subscribeToMultiplayerInbox({
        channelKey: "app-banner",
        onStatusChange: (status) => {
          logMultiplayerBannerDebug("realtime channel status", { status });
        },
        onNotification: (change) => {
          logMultiplayerBannerDebug("notification change received", {
            eventType: change?.eventType,
            id: change?.new?.id ?? null,
            type: change?.new?.type ?? null,
          });
          const isInsert = String(change?.eventType ?? "").toUpperCase() === "INSERT";
          const isUpdate = String(change?.eventType ?? "").toUpperCase() === "UPDATE";
          if (isUpdate) {
            // read_at transitions are UPDATE events; refresh badge count immediately.
            void refreshUnreadNotifications({ showLatestBanner: false });
            return;
          }
          const row = change?.new ?? null;
          if (!isInsert || !row?.id || row.read_at != null) {
            logMultiplayerBannerDebug("notification ignored", {
              isInsert,
              hasId: Boolean(row?.id),
              readAt: row?.read_at ?? null,
            });
            return;
          }
          const eventKey = buildMultiplayerNotificationEventKey({
            id: row.id ?? null,
            type: row.type ?? null,
            payload: row.payload ?? {},
            entityId: row.entity_id ?? null,
          });
          if (!shouldDisplayBannerForEvent(eventKey)) {
            logMultiplayerBannerDebug("duplicate realtime notification ignored", {
              id: row.id,
              eventKey,
            });
            return;
          }
          if (
            shouldSuppressNotificationForActiveSession({
              type: row.type ?? null,
              payload: row.payload ?? {},
              entityId: row.entity_id ?? null,
            })
          ) {
            logMultiplayerBannerDebug("suppressing in-app banner for active session", {
              id: row.id,
              type: row.type ?? null,
            });
            void (async () => {
              await markMultiplayerNotificationsRead([row.id]);
              void refreshUnreadNotifications({ showLatestBanner: false });
            })();
            return;
          }
          if (!multiplayerNotificationsEnabled) {
            return;
          }
          if (lastBannerNotificationIdRef.current === row.id) {
            logMultiplayerBannerDebug("duplicate notification ignored", {
              id: row.id,
            });
            return;
          }
          lastBannerNotificationIdRef.current = row.id;
          void (async () => {
            const message = await buildBannerMessageWithResolvedFriend({
              type: row.type,
              payload: row.payload ?? {},
            });
            showMultiplayerBanner(message);
            void refreshUnreadNotifications();
          })();
        },
        onFriendRequest: (change) => {
          if (!multiplayerNotificationsEnabled) {
            return;
          }
          logMultiplayerBannerDebug("friend request change received", {
            eventType: change?.eventType,
            id: change?.new?.id ?? null,
            status: change?.new?.status ?? null,
          });
          const isInsert = String(change?.eventType ?? "").toUpperCase() === "INSERT";
          const isUpdate = String(change?.eventType ?? "").toUpperCase() === "UPDATE";
          const row = change?.new ?? null;
          if (
            isUpdate &&
            row?.id &&
            row?.status &&
            String(row.status).toLowerCase() !== "pending"
          ) {
            // Accept/decline transitions should clear the originating friend_request unread.
            void (async () => {
              const unreadResult = await fetchUnreadMultiplayerNotifications(50);
              if (unreadResult?.ok) {
                const ids = (unreadResult.notifications ?? [])
                  .filter((notification) => {
                    const type = String(notification?.type ?? "").toLowerCase();
                    if (type !== "friend_request") {
                      return false;
                    }
                    const requestId = getMultiplayerNotificationRequestId(notification);
                    return requestId != null && String(requestId) === String(row.id);
                  })
                  .map((notification) => notification.id)
                  .filter((id) => typeof id === "string" && id.length > 0);
                if (ids.length > 0) {
                  await markMultiplayerNotificationsRead(ids);
                }
              }
              void refreshUnreadNotifications({ showLatestBanner: false });
            })();
            return;
          }
          if (!isInsert || row?.status !== "pending") {
            logMultiplayerBannerDebug("friend request ignored", {
              isInsert,
              status: row?.status ?? null,
            });
            return;
          }
          void (async () => {
            const friendName = await resolveProfileLabelById(row.sender_id);
            showMultiplayerBanner({
              title: "Friend Request",
              text: `${friendName} sent you a friend request.`,
              navigationTarget: {
                screen: "multiplayer-menu",
                tab: "friends",
              },
            });
          })();
        },
        onFriendRequestSent: (change) => {
          if (!multiplayerNotificationsEnabled) {
            return;
          }
          logMultiplayerBannerDebug("friend request sent-row change received", {
            eventType: change?.eventType,
            id: change?.new?.id ?? null,
            oldStatus: change?.old?.status ?? null,
            newStatus: change?.new?.status ?? null,
          });

          const isUpdate = String(change?.eventType ?? "").toUpperCase() === "UPDATE";
          const nextRow = change?.new ?? null;
          const previousRow = change?.old ?? null;
          if (!isUpdate || !nextRow?.id) {
            return;
          }

          if (nextRow?.status === "accepted") {
            const eventKey = `${nextRow.id}:accepted:${nextRow.updated_at ?? ""}`;
            if (lastFriendRequestStatusEventKeyRef.current === eventKey) {
              return;
            }
            lastFriendRequestStatusEventKeyRef.current = eventKey;
            void (async () => {
              const friendName = await resolveProfileLabelById(nextRow.receiver_id);
              showMultiplayerBanner({
                title: "Friend Request Accepted",
                text: `${friendName} accepted your friend request.`,
                navigationTarget: {
                  screen: "multiplayer-menu",
                  tab: "friends",
                },
              });
            })();
          }
        },
        onSessionChange: () => {
          // Session updates are not recipient-specific; only refresh counts here.
          void refreshUnreadNotifications({ showLatestBanner: false });
        },
      });
      if (subscription.ok) {
        unsubscribeInbox = subscription.unsubscribe;
      }
    })();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void upsertPresence({ status: "online", lastSessionId: null });
        void refreshUnreadNotifications();
      } else if (state === "background") {
        void upsertPresence({ status: "away", lastSessionId: null });
      }
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeInbox();
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
      void upsertPresence({ status: "offline", lastSessionId: null });
    };
  }, [
    startupTasksReady,
    multiplayerNotificationsEnabled,
    buildBannerMessageWithResolvedFriend,
    shouldDisplayBannerForEvent,
    shouldSuppressNotificationForActiveSession,
    resolveProfileLabelById,
    showMultiplayerBanner,
  ]);

  const isRackTileUsed = useCallback(
    (tile, index) =>
      game.selectedCells.some((cell) => {
        const boardTile = game.board[cell.row][cell.col];
        return (
          boardTile &&
          (boardTile.id === tile?.id || boardTile.rackIndex === index)
        );
      }),
    [game.board, game.selectedCells]
  );

  const getRackTileByIndex = useCallback(
    (index) => game.tileRack[index] ?? null,
    [game.tileRack]
  );

  const getRackIndexByTileId = useCallback(
    (tileId) => game.tileRack.findIndex((tile) => tile?.id === tileId),
    [game.tileRack]
  );

  const handlePlaceRackTile = useCallback(
    (tileIndex, row, col) => game.placeTileOnBoard(tileIndex, row, col),
    [game]
  );

  const handleBlankPlacementRequest = useCallback((tileIndex, row, col) => {
    setPendingBlankPlacement({ tileIndex, row, col });
  }, []);

  const {
    visibleRackTiles,
    draggingTile,
    settlingTile,
    dropTargetRackIndex,
    boardHoverRackIndex,
    rackHoverIndexValue,
    boardRackPlaceholderIndexValue,
    rackDraggingVisibleIndexValue,
    optimisticPlacement,
    dragPosition,
    dragScale,
    settlePosition,
    settleScale,
    refreshContainerWindowPosition,
    updateRackLayout,
    resetController,
    getDraggableTileCell,
    handleRackDragStart,
    handleRackDragUpdate,
    handleTileDrop,
    handleBoardTilePickup,
    handleBoardDragUpdate,
    handleBoardTileDrop,
    handleBoardTap,
  } = useTileDragDropController({
    containerRef: safeAreaRef,
    boardLayoutRef,
    rackTiles: rackSourceTiles,
    isRackTileUsed,
    board: game.board,
    boardSize: game.BOARD_SIZE,
    rackDropExpansionTop,
    canInteract: !game.isSwapMode && !swapAnimating,
    isBoardTileDraggable: (tile) =>
      !!(tile && tile.isFromRack && tile.rackIndex !== undefined && !tile.scored),
    isBlankRackTile: game.isBlankRackTile,
    getRackTileByIndex,
    getRackIndexByTileId,
    onPlaceRackTile: handlePlaceRackTile,
    onMoveBoardTile: game.moveTileOnBoard,
    onRemoveBoardTile: game.removeTileFromBoard,
    onReorderRack: game.reorderRack,
    onBoardCellTap: game.handleCellClick,
    onBlankPlacementRequested: handleBlankPlacementRequest,
  });

  const ensureRackTileAnimationState = useCallback(
    (tileId, scoreText = null) => {
      if (!rackTileAnimationsRef.current[tileId]) {
        rackTileAnimationsRef.current[tileId] = {
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(1),
          scoreOpacity: new Animated.Value(0),
          scoreTranslateY: new Animated.Value(0),
          scoreScale: new Animated.Value(1),
          multiplierOpacity: new Animated.Value(0),
          multiplierScale: new Animated.Value(0.85),
          scoreText,
        };
      } else if (scoreText !== null) {
        rackTileAnimationsRef.current[tileId].scoreText = scoreText;
      }

      return rackTileAnimationsRef.current[tileId];
    },
    []
  );

  const syncRackTileAnimationStates = useCallback(() => {
    setRackTileAnimationStates(
      Object.fromEntries(
        Object.entries(rackTileAnimationsRef.current).map(([tileId, state]) => [
          tileId,
          { ...state },
        ])
      )
    );
  }, []);

  const clearRackTileAnimationState = useCallback(
    (tileId) => {
      delete rackTileAnimationsRef.current[tileId];
      syncRackTileAnimationStates();
    },
    [syncRackTileAnimationStates]
  );

  const runParallel = useCallback(
    (animations) =>
      new Promise((resolve) => {
        Animated.parallel(animations).start(() => resolve());
      }),
    []
  );

  const wait = useCallback(
    (duration) =>
      new Promise((resolve) => {
        setTimeout(resolve, duration);
      }),
    []
  );

  const waitForNextFrame = useCallback(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
    []
  );

  const triggerScrabbleBanner = useCallback(() => {
    if (scrabbleBannerTimeoutRef.current != null) {
      clearTimeout(scrabbleBannerTimeoutRef.current);
      scrabbleBannerTimeoutRef.current = null;
    }

    setShowScrabbleBanner(true);
    scrabbleBannerOpacity.stopAnimation();
    scrabbleBannerScale.stopAnimation();
    scrabbleBannerOpacity.setValue(0);
    scrabbleBannerScale.setValue(0.92);

    Animated.parallel([
      Animated.timing(scrabbleBannerOpacity, {
        toValue: 1,
        duration: SCRABBLE_BANNER_FADE_IN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scrabbleBannerScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();

    scrabbleBannerTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scrabbleBannerOpacity, {
          toValue: 0,
          duration: SCRABBLE_BANNER_FADE_OUT_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrabbleBannerScale, {
          toValue: 0.97,
          duration: SCRABBLE_BANNER_FADE_OUT_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowScrabbleBanner(false);
      });
      scrabbleBannerTimeoutRef.current = null;
    }, SCRABBLE_BANNER_VISIBLE_DURATION);
  }, [scrabbleBannerOpacity, scrabbleBannerScale]);

  const animateRackLayout = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: SWAP_LAYOUT_DURATION,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  const handleClearReturnAnimationComplete = useCallback(() => {
    setClearedRackTileIds([]);
  }, []);

  const resetSwapAnimationState = useCallback(() => {
    rackTileAnimationsRef.current = {};
    setRackTileAnimationStates({});
    setSwapDisplayRack(null);
    setSwapAnimatedPenalty(0);
    setSwapAnimating(false);
  }, []);

  const animateRackInsertSequence = useCallback(
    async (tilesToInsert) => {
      for (const tile of tilesToInsert) {
        const animationState = ensureRackTileAnimationState(tile.id);
        animationState.translateY.setValue(-SWAP_TILE_LIFT);
        animationState.opacity.setValue(0);
        animationState.scoreOpacity.setValue(0);
        animationState.scoreTranslateY.setValue(0);
        animationState.scoreScale?.setValue?.(1);
        animationState.multiplierOpacity?.setValue?.(0);
        animationState.multiplierScale?.setValue?.(0.85);
        animationState.scoreText = null;
        animationState.multiplierText = null;
        syncRackTileAnimationStates();

        animateRackLayout();
        setSwapDisplayRack((prev) => [...(prev ?? []), tile]);
        await waitForNextFrame();
        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: 0,
            duration: SWAP_TILE_ENTER_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 1,
            duration: SWAP_TILE_ENTER_DURATION,
            useNativeDriver: true,
          }),
        ]);
        clearRackTileAnimationState(tile.id);
        await wait(SWAP_STEP_DELAY);
      }
    },
    [
      animateRackLayout,
      clearRackTileAnimationState,
      ensureRackTileAnimationState,
      runParallel,
      syncRackTileAnimationStates,
      wait,
      waitForNextFrame,
    ]
  );

  const handleSwapButtonPress = useCallback(async () => {
    if (swapAnimating) return;
    if (!game.isSwapMode) {
      game.swapTiles();
      return;
    }

    const preparedSwap = game.prepareSwapTiles();
    if (!preparedSwap) return;

    try {
      setSwapAnimating(true);
      setSwapDisplayRack(game.tileRack);
      setSwapAnimatedPenalty(0);

      for (const tile of preparedSwap.removedTiles) {
        const animationState = ensureRackTileAnimationState(
          tile.id,
          `- ${tile.value}`
        );
        const tilePenalty = (tile.value ?? 0) * preparedSwap.multiplier;
        animationState.translateY.setValue(0);
        animationState.opacity.setValue(1);
        animationState.scoreOpacity.setValue(0);
        animationState.scoreTranslateY.setValue(0);
        animationState.scoreScale.setValue(1);
        animationState.multiplierOpacity.setValue(0);
        animationState.multiplierScale.setValue(0.85);
        animationState.multiplierText = null;
        syncRackTileAnimationStates();

        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: -SWAP_TILE_LIFT,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreOpacity, {
            toValue: 1,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreTranslateY, {
            toValue: -10,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
        ]);

        if (preparedSwap.multiplier > 1) {
          animationState.multiplierText = `x ${preparedSwap.multiplier.toFixed(
            1
          )}`;
          syncRackTileAnimationStates();
          await runParallel([
            Animated.timing(animationState.multiplierOpacity, {
              toValue: 1,
              duration: SWAP_MULTIPLIER_POP_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(animationState.multiplierScale, {
              toValue: 1,
              duration: SWAP_MULTIPLIER_POP_DURATION,
              useNativeDriver: true,
            }),
          ]);
          await wait(SWAP_MULTIPLIER_HOLD_DURATION);
          animationState.scoreText = `- ${tilePenalty}`;
          animationState.multiplierText = null;
          animationState.multiplierOpacity.setValue(0);
          animationState.multiplierScale.setValue(0.85);
          syncRackTileAnimationStates();
          await runParallel([
            Animated.sequence([
              Animated.timing(animationState.scoreScale, {
                toValue: 1.2,
                duration: SWAP_SCORE_REPLACE_DURATION,
                useNativeDriver: true,
              }),
              Animated.timing(animationState.scoreScale, {
                toValue: 1,
                duration: SWAP_SCORE_REPLACE_DURATION,
                useNativeDriver: true,
              }),
            ]),
          ]);
        } else {
          animationState.scoreText = `- ${tilePenalty}`;
          syncRackTileAnimationStates();
        }

        setSwapAnimatedPenalty((prev) => prev + tilePenalty);

        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: -SWAP_TILE_EXIT_LIFT,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 0,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreOpacity, {
            toValue: 0,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreTranslateY, {
            toValue: -18,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
        ]);

        animateRackLayout();
        setSwapDisplayRack(
          (prev) => prev?.filter((rackTile) => rackTile.id !== tile.id) ?? prev
        );
        clearRackTileAnimationState(tile.id);
        await wait(SWAP_STEP_DELAY);
      }

      await animateRackInsertSequence(preparedSwap.drawnTiles);

      setSwapAnimatedPenalty(0);
      game.commitPreparedSwap(preparedSwap);
      await waitForNextFrame();
      await waitForNextFrame();
    } finally {
      resetSwapAnimationState();
    }
  }, [
    animateRackLayout,
    animateRackInsertSequence,
    clearRackTileAnimationState,
    ensureRackTileAnimationState,
    game,
    resetSwapAnimationState,
    swapAnimating,
    wait,
    waitForNextFrame,
  ]);

  const handleSubmitButtonPress = useCallback(async () => {
    if (swapAnimating || game.gameOver) return;
    if (game.tilesRemaining === 0 && !hasPendingTilesOnBoard) {
      game.finishGame();
      return;
    }

    const preparedSubmit = game.prepareSubmitWord();
    if (!preparedSubmit) return;
    const completesGame =
      preparedSubmit.nextTilesRemaining === 0 &&
      preparedSubmit.resultingRack.length === 0;

    if (!completesGame) {
      const nextFlavor = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        previousWordCount: game.wordCount,
        wordDelta: preparedSubmit.newWords.length,
        previousTurnCount: game.turnCount,
        turnDelta: 1,
        previousTilesRemaining: game.tilesRemaining,
        tilesDelta: preparedSubmit.drawnTiles.length,
      };

      if (preparedSubmit.earnedScrabbleBonus) {
        setGameInfoFlavor(nextFlavor);
        setPendingGameInfoFlavor(null);
      } else {
        setPendingGameInfoFlavor(nextFlavor);
      }
    } else {
      setGameInfoFlavor(null);
      setPendingGameInfoFlavor(null);
    }

    game.commitPreparedSubmitWord(preparedSubmit);
    if (preparedSubmit.earnedScrabbleBonus) {
      triggerScrabbleBanner();
    }
    if (preparedSubmit.drawnTiles.length === 0) {
      game.finalizePreparedSubmitRack(preparedSubmit);
      return;
    }

    try {
      setSwapAnimating(true);
      setSwapAnimatedPenalty(0);
      setSwapDisplayRack(preparedSubmit.remainingRack);
      await animateRackInsertSequence(preparedSubmit.drawnTiles);
      game.finalizePreparedSubmitRack(preparedSubmit);
      await waitForNextFrame();
      await waitForNextFrame();
    } finally {
      resetSwapAnimationState();
    }
  }, [
    animateRackInsertSequence,
    game,
    hasPendingTilesOnBoard,
    resetSwapAnimationState,
    swapAnimating,
    triggerScrabbleBanner,
    waitForNextFrame,
  ]);

  useEffect(() => {
    if (!swapAnimating) {
      setSwapDisplayRack(null);
    }
  }, [swapAnimating, game.tileRack]);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    // Start spinner animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    const loadDictionary = async () => {
      await dictionary.load();
      setDictionaryLoaded(true);
    };
    loadDictionary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadPersistedScores = async () => {
      const storedRecords = await loadScoreRecords();
      setScoreRecords(storedRecords);
    };

    loadPersistedScores();
  }, []);

  useEffect(() => {
    const loadSavedGame = async () => {
      const storedPayload = await loadGameSnapshotPayload();
      setSavedGamePayload(storedPayload);
    };

    loadSavedGame();
  }, []);

  useEffect(() => {
    const loadPersistedStats = async () => {
      const storedStats = await loadStats();
      setPlayerStats(storedStats);
    };

    loadPersistedStats();
  }, []);

  useEffect(() => {
    resetController();
  }, [game.currentSeed, gameStarted, resetController]);

  useEffect(() => {
    const loadPlayerProfile = async () => {
      const storedProfile = await loadOrCreatePlayerProfile();
      setPlayerProfile(storedProfile);
    };

    loadPlayerProfile();
  }, []);

  useEffect(() => {
    const loadConsentStatus = async () => {
      const storedStatus = await loadLeaderboardConsentStatus();
      setLeaderboardConsentStatus(storedStatus);
      setLeaderboardConsentLoaded(true);
    };

    loadConsentStatus();
  }, []);

  useEffect(() => {
    if (!leaderboardConsentLoaded || leaderboardConsentStatus != null) {
      return;
    }

    setLeaderboardConsentModalSource("startup");
    setLeaderboardConsentModalVisible(true);
  }, [leaderboardConsentLoaded, leaderboardConsentStatus]);

  const loadLeaderboardPosition = useCallback(async () => {
    if (!isBackendConfigured() || !playerProfile?.playerId) {
      setLeaderboardPosition(null);
      setLeaderboardPositionError(null);
      setLeaderboardPositionLoading(false);
      return;
    }

    setLeaderboardPositionLoading(true);
    setLeaderboardPositionError(null);

    const result = await fetchPlayerHighScorePosition(playerProfile.playerId);
    if (!result.ok) {
      setLeaderboardPosition(null);
      setLeaderboardPositionError(
        result.reason === "backend_not_configured"
          ? null
          : "Unable to load leaderboard rank"
      );
      setLeaderboardPositionLoading(false);
      return;
    }

    setLeaderboardPosition(result.position);
    setLeaderboardPositionLoading(false);
  }, [playerProfile]);

  const loadGlobalLeaderboard = useCallback(
    async (scoreMode = LEADERBOARD_SCORE_MODE_SOLO) => {
    setLeaderboardEntries([]);
    setLeaderboardError(null);
    if (!isBackendConfigured()) {
      setLeaderboardLoading(false);
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardError(null);

    const result = await fetchGlobalLeaderboard(scoreMode);
    if (!result.ok) {
      setLeaderboardEntries([]);
      setLeaderboardError(
        result.reason === "backend_not_configured"
          ? null
          : "Unable to load leaderboard"
      );
      setLeaderboardLoading(false);
      return;
    }

    setLeaderboardEntries(result.leaderboard);
    setLeaderboardLoading(false);
    },
    []
  );

  const loadMultiplayerLeaderboard = useCallback(async () => {
    setMultiplayerLeaderboardEntries([]);
    setMultiplayerLeaderboardError(null);
    if (!isBackendConfigured()) {
      setMultiplayerLeaderboardLoading(false);
      return;
    }

    setMultiplayerLeaderboardLoading(true);
    setMultiplayerLeaderboardError(null);

    const result = await fetchGlobalLeaderboard(
      LEADERBOARD_SCORE_MODE_MULTIPLAYER
    );
    if (!result.ok) {
      setMultiplayerLeaderboardEntries([]);
      setMultiplayerLeaderboardError(
        result.reason === "backend_not_configured"
          ? null
          : "Unable to load leaderboard"
      );
      setMultiplayerLeaderboardLoading(false);
      return;
    }

    setMultiplayerLeaderboardEntries(result.leaderboard);
    setMultiplayerLeaderboardLoading(false);
  }, []);

  const loadDailyLeaderboard = useCallback(
    async (seed = selectedDailyLeaderboardSeed) => {
      if (!seed) {
        setDailyLeaderboardEntries([]);
        setDailyLeaderboardError(null);
        return;
      }

      if (!isBackendConfigured()) {
        setDailyLeaderboardEntries([]);
        setDailyLeaderboardError(null);
        return;
      }

      setDailyLeaderboardLoading(true);
      setDailyLeaderboardError(null);

      const result = await fetchSeedLeaderboardByMode(
        seed,
        LEADERBOARD_SCORE_MODE_SOLO
      );
      if (!result.ok) {
        setDailyLeaderboardEntries([]);
        setDailyLeaderboardError(
          result.reason === "backend_not_configured"
            ? null
            : "Unable to load daily leaderboard"
        );
        setDailyLeaderboardLoading(false);
        return;
      }

      setDailyLeaderboardEntries(result.leaderboard);
      setDailyLeaderboardLoading(false);
    },
    [selectedDailyLeaderboardSeed]
  );

  const submitLatestCompletedScore = useCallback(
    async ({
      seed,
      finalScore,
      finalScoreBreakdown,
      isDailySeed: isDailySeedSubmission,
      scoreMode = LEADERBOARD_SCORE_MODE_SOLO,
      displayNameOverride = null,
    }) => {
      const result = await submitCompletedScore({
        seed,
        finalScore,
        finalScoreBreakdown,
        isDailySeed: isDailySeedSubmission,
        scoreMode,
        displayNameOverride,
      });

      if (!result.ok && result.reason !== "backend_not_configured") {
        console.warn("Failed to submit score", result);
        setLeaderboardError(getLeaderboardSubmitErrorMessage(result));
        return result;
      }

      if (result.ok) {
        if (scoreMode === LEADERBOARD_SCORE_MODE_MULTIPLAYER) {
          loadMultiplayerLeaderboard();
        } else {
          loadGlobalLeaderboard();
        }
        if (scoreMode === LEADERBOARD_SCORE_MODE_SOLO) {
          loadLeaderboardPosition();
        }
        if (
          scoreMode === LEADERBOARD_SCORE_MODE_SOLO &&
          (activeDailySeed ?? seed) === selectedDailyLeaderboardSeed
        ) {
          loadDailyLeaderboard(activeDailySeed ?? seed);
        }
      }

      return result;
    },
    [
      activeDailySeed,
      loadDailyLeaderboard,
      loadGlobalLeaderboard,
      loadMultiplayerLeaderboard,
      loadLeaderboardPosition,
      selectedDailyLeaderboardSeed,
    ]
  );

  useEffect(() => {
    if (gameStarted || homeScreen !== "leaderboard") {
      return;
    }

    loadGlobalLeaderboard();
    loadMultiplayerLeaderboard();
    loadDailyLeaderboard();
  }, [
    gameStarted,
    homeScreen,
    loadDailyLeaderboard,
    loadGlobalLeaderboard,
    loadMultiplayerLeaderboard,
  ]);

  useEffect(() => {
    if (!leaderboardSelectedDailySeed) {
      setLeaderboardSelectedDailySeed(dailySeed);
    }
  }, [dailySeed, leaderboardSelectedDailySeed]);

  useEffect(() => {
    if (gameStarted || homeScreen !== "stats") {
      return;
    }

    loadLeaderboardPosition();
  }, [gameStarted, homeScreen, loadLeaderboardPosition]);

  useEffect(() => {
    if (!gameStarted || game.gameOver) {
      return;
    }

    if (
      swapAnimating ||
      draggingTile != null ||
      settlingTile != null ||
      pendingBlankPlacement != null ||
      game.selectedCells.length > 0 ||
      game.isSwapMode ||
      playMenuVisible ||
      inGameMenuVisible
    ) {
      return;
    }

    const snapshot = game.getStableSnapshot();
    if (!snapshot) {
      return;
    }

    const payload = {
      snapshot,
      activeDailySeed,
      savedAt: Date.now(),
    };

    setSavedGamePayload(payload);
    saveGameSnapshotPayload(payload);
  }, [
    activeDailySeed,
    draggingTile,
    game.getStableSnapshot,
    game.gameOver,
    game.isSwapMode,
    game.selectedCells.length,
    gameStarted,
    inGameMenuVisible,
    pendingBlankPlacement,
    playMenuVisible,
    settlingTile,
    swapAnimating,
  ]);

  useEffect(() => {
    if (!game.gameOver) {
      return;
    }

    setSavedGamePayload(null);
    clearGameSnapshotPayload();
  }, [game.gameOver]);

  useEffect(() => {
    if (
      !leaderboardConsentLoaded ||
      !game.gameOver ||
      typeof game.finalScore !== "number" ||
      !game.finalScoreBreakdown
    ) {
      return;
    }

    const persistedGameKey = `${game.currentSeed ?? ""}:${game.finalScore}:${
      activeDailySeed ?? ""
    }`;
    if (persistedGameRef.current === persistedGameKey) {
      return;
    }
    persistedGameRef.current = persistedGameKey;

    const isNewHighScore =
      scoreRecords.overallHighScore == null ||
      game.finalScore > scoreRecords.overallHighScore;
    setEndGameSummary({
      ...game.finalScoreBreakdown,
      isNewHighScore,
    });

    const nextRecords = buildUpdatedScoreRecords(
      scoreRecords,
      game.finalScore,
      activeDailySeed
    );
    setScoreRecords(nextRecords);
    saveScoreRecords(nextRecords);

    const nextStats = buildUpdatedStats(playerStats, {
      finalScore: game.finalScore,
      wordCount: game.wordCount,
    });
    setPlayerStats(nextStats);
    saveStats(nextStats);

    const backendSubmitKey = `${persistedGameKey}:backend`;
    if (backendSubmitRef.current === backendSubmitKey) {
      return;
    }
    backendSubmitRef.current = backendSubmitKey;

    const submission = {
      seed: game.currentSeed,
      finalScore: game.finalScore,
      finalScoreBreakdown: game.finalScoreBreakdown,
      isDailySeed: activeDailySeed === game.currentSeed,
    };

    if (leaderboardConsentStatus === LEADERBOARD_CONSENT_GRANTED) {
      submitLatestCompletedScore(submission);
      return;
    }

    if (leaderboardConsentStatus == null) {
      setPendingLeaderboardSubmission(submission);
      setLeaderboardConsentModalSource("gameOver");
      setLeaderboardConsentModalVisible(true);
    }
  }, [
    activeDailySeed,
    game.finalScore,
    game.finalScoreBreakdown,
    game.gameOver,
    game.currentSeed,
    game.wordCount,
    leaderboardConsentLoaded,
    leaderboardConsentStatus,
    playerStats,
    scoreRecords,
    submitLatestCompletedScore,
  ]);

  const handleSavePlayerName = useCallback(async (displayName) => {
    const remoteSaveResult = await saveRemotePlayerProfile({
      username: displayName,
      displayName,
    });

    if (!remoteSaveResult.ok) {
      return remoteSaveResult;
    }

    const nextProfile = await savePlayerDisplayName(displayName);
    setPlayerProfile(nextProfile);
    return { ok: true, profile: nextProfile };
  }, []);

  const handleOpenLeaderboardSharingSettings = useCallback(() => {
    setLeaderboardConsentModalSource("settings");
    setSettingsModalVisible(false);
    setLeaderboardConsentModalVisible(true);
  }, []);

  const handleOpenDeleteAccountModal = useCallback(() => {
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(true);
  }, []);

  const handleAllowLeaderboardSharing = useCallback(async () => {
    const nextStatus = await saveLeaderboardConsentStatus(
      LEADERBOARD_CONSENT_GRANTED
    );
    setLeaderboardConsentStatus(nextStatus);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);

    if (pendingLeaderboardSubmission) {
      const pendingSubmission = pendingLeaderboardSubmission;
      setPendingLeaderboardSubmission(null);
      submitLatestCompletedScore(pendingSubmission);
    }
  }, [pendingLeaderboardSubmission, submitLatestCompletedScore]);

  const handleDenyLeaderboardSharing = useCallback(async () => {
    const nextStatus = await saveLeaderboardConsentStatus(
      LEADERBOARD_CONSENT_DENIED
    );
    setLeaderboardConsentStatus(nextStatus);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    setDeleteAccountLoading(true);

    const result = await deleteRemoteAccount();

    if (!result.ok) {
      const normalizedInvokeMessage =
        typeof result.error?.message === "string" ? result.error.message : "";
      const normalizedMessage =
        typeof result.errorMessage === "string" ? result.errorMessage.trim() : "";
      setDeleteAccountLoading(false);
      setDeleteAccountModalVisible(false);
      setAccountMessage({
        title: "Delete Account Failed",
        text:
          normalizedMessage ||
          normalizedInvokeMessage ||
          "Could not delete your account right now. Confirm the Supabase delete-account function is deployed and configured, then try again.",
      });
      return;
    }

    await Promise.all([
      clearPlayerProfile(),
      clearLeaderboardConsentStatus(),
      clearMultiplayerSession(),
      clearGameSnapshotPayload(),
    ]);

    const nextProfile = await loadOrCreatePlayerProfile();
    setPlayerProfile(nextProfile);
    setLeaderboardConsentStatus(null);
    setSavedGamePayload(null);
    setLeaderboardPosition(null);
    setLeaderboardPositionError(null);
    setLeaderboardEntries([]);
    setDailyLeaderboardEntries([]);
    setActiveDailySeed(null);
    setEndGameSummary(null);
    setHomeScreen("main");
    setGameStarted(false);
    setPlayMenuVisible(false);
    setInGameMenuVisible(false);
    setConfirmLeaveGameVisible(false);
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(false);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setActiveMultiplayerSessionId("local-multiplayer-prototype");
    backendSubmitRef.current = null;
    persistedGameRef.current = null;
    setDeleteAccountLoading(false);
    setAccountMessage({
      title: "Account Deleted",
      text:
        "Your Supabase account data was removed. Published leaderboard scores were kept.",
    });
  }, []);

  const handleOpenLeaderboard = useCallback(() => {
    setLeaderboardInitialPage("highScores");
    setLeaderboardSelectedDailySeed(dailySeed);
    setHomeScreen("leaderboard");
  }, [dailySeed]);

  const handleOpenMultiplayerLeaderboard = useCallback(() => {
    setLeaderboardInitialPage("multiplayer");
    setLeaderboardSelectedDailySeed(dailySeed);
    setHomeScreen("leaderboard");
  }, [dailySeed]);

  const handleOpenPlayModeMenu = useCallback(() => {
    setPlayMenuVisible(true);
  }, []);

  const handleOpenMultiplayerMenu = useCallback(() => {
    setMultiplayerMenuInitialTab("games");
    setHomeScreen("multiplayer-menu");
  }, []);

  const handleBackToMainMenu = useCallback(() => {
    setHomeScreen("main");
  }, []);

  const handleToggleMultiplayerNotifications = useCallback(async (enabled) => {
    const nextEnabled = enabled === true;
    setMultiplayerNotificationsEnabled(nextEnabled);
    const result = await saveMultiplayerNotificationSettings({
      enabled: nextEnabled,
    });
    if (!result.ok) {
      setMultiplayerNotificationsEnabled((current) => !current);
      setAccountMessage({
        title: "Settings Update Failed",
        text: "Could not update multiplayer notifications right now.",
      });
    }
  }, []);

  const handleToggleDarkMode = useCallback(async (enabled) => {
    const nextEnabled = enabled === true;
    setDarkModeEnabled(nextEnabled);
    await saveDarkModeEnabledPreference(nextEnabled);
  }, []);

  const handleMultiplayerSessionCompleted = useCallback(
    ({
      sessionId = null,
      seed,
      finalScore,
      finalScoreBreakdown,
      isDailySeed,
      shouldSubmitLeaderboard = true,
      leaderboardDisplayName = null,
    }) => {
      if (
        !seed ||
        typeof finalScore !== "number" ||
        !finalScoreBreakdown
      ) {
        return;
      }

      const backendSubmitKey = `multiplayer:${sessionId ?? "unknown"}:${seed}:${finalScore}`;
      if (backendSubmitRef.current === backendSubmitKey) {
        return;
      }
      backendSubmitRef.current = backendSubmitKey;

      const isNewHighScore =
        scoreRecords.overallHighScore == null ||
        finalScore > scoreRecords.overallHighScore;
      setEndGameSummary({
        ...finalScoreBreakdown,
        isNewHighScore,
      });

      const submission = {
        seed,
        finalScore,
        finalScoreBreakdown,
        isDailySeed,
        scoreMode: LEADERBOARD_SCORE_MODE_MULTIPLAYER,
        displayNameOverride: leaderboardDisplayName,
      };

      if (!shouldSubmitLeaderboard) {
        return;
      }

      if (!leaderboardConsentLoaded) {
        return;
      }

      if (leaderboardConsentStatus === LEADERBOARD_CONSENT_GRANTED) {
        submitLatestCompletedScore(submission);
        return;
      }

      if (leaderboardConsentStatus == null) {
        setPendingLeaderboardSubmission(submission);
        setLeaderboardConsentModalSource("gameOver");
        setLeaderboardConsentModalVisible(true);
      }
    },
    [
      leaderboardConsentLoaded,
      leaderboardConsentStatus,
      scoreRecords.overallHighScore,
      submitLatestCompletedScore,
    ]
  );

  const selectedDailyLeaderboardIndex = dailySeeds.indexOf(
    selectedDailyLeaderboardSeed
  );

  const handlePreviousDailyLeaderboardSeed = useCallback(() => {
    if (
      selectedDailyLeaderboardIndex < 0 ||
      selectedDailyLeaderboardIndex >= dailySeeds.length - 1
    ) {
      return;
    }
    setLeaderboardSelectedDailySeed(
      dailySeeds[selectedDailyLeaderboardIndex + 1]
    );
  }, [dailySeeds, selectedDailyLeaderboardIndex]);

  const handleNextDailyLeaderboardSeed = useCallback(() => {
    if (selectedDailyLeaderboardIndex <= 0) {
      return;
    }
    setLeaderboardSelectedDailySeed(
      dailySeeds[selectedDailyLeaderboardIndex - 1]
    );
  }, [dailySeeds, selectedDailyLeaderboardIndex]);

  useEffect(() => {
    const scheduleDailySeedRefresh = () => {
      setDailySeed(getDailySeed());
      dailySeedRefreshTimeoutRef.current = setTimeout(() => {
        scheduleDailySeedRefresh();
      }, getMillisecondsUntilNextLocalMidnight());
    };

    scheduleDailySeedRefresh();

    return () => {
      if (dailySeedRefreshTimeoutRef.current != null) {
        clearTimeout(dailySeedRefreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      resetController();
      if (scrabbleBannerTimeoutRef.current != null) {
        clearTimeout(scrabbleBannerTimeoutRef.current);
      }
      if (dailySeedRefreshTimeoutRef.current != null) {
        clearTimeout(dailySeedRefreshTimeoutRef.current);
      }
    };
  }, [resetController]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const startGameWithSeed = useCallback(
    (seed, options = {}) => {
      setSavedGamePayload(null);
      clearGameSnapshotPayload();
      game.startNewGame(seed);
      setActiveDailySeed(options.isDaily ? seed : null);
      setEndGameSummary(null);
      setGameInfoFlavor(null);
      setPendingGameInfoFlavor(null);
      setPendingLeaderboardSubmission(null);
      setLeaderboardConsentModalVisible(false);
      setSettingsModalVisible(false);
      setDeleteAccountModalVisible(false);
      backendSubmitRef.current = null;
      persistedGameRef.current = null;
      setGameStarted(true);
      setPlayMenuVisible(false);
      setInGameMenuVisible(false);
    },
    [game]
  );

  const handleDailyGameStart = useCallback(() => {
    startGameWithSeed(dailySeed, { isDaily: true });
  }, [dailySeed, startGameWithSeed]);

  const handleRandomGameStart = useCallback(() => {
    setSavedGamePayload(null);
    clearGameSnapshotPayload();
    game.startNewGame();
    setActiveDailySeed(null);
    setEndGameSummary(null);
    setGameInfoFlavor(null);
    setPendingGameInfoFlavor(null);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(false);
    backendSubmitRef.current = null;
    persistedGameRef.current = null;
    setGameStarted(true);
    setPlayMenuVisible(false);
    setInGameMenuVisible(false);
  }, [game]);

  const handleResetSeed = useCallback(() => {
    setSavedGamePayload(null);
    clearGameSnapshotPayload();
    game.resetGame();
    setEndGameSummary(null);
    setGameInfoFlavor(null);
    setPendingGameInfoFlavor(null);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(false);
    backendSubmitRef.current = null;
    persistedGameRef.current = null;
    setGameStarted(true);
    setPlayMenuVisible(false);
    setInGameMenuVisible(false);
  }, [game]);

  const handleReturnToMainMenu = useCallback(() => {
    const snapshot = game.getStableSnapshot();
    if (snapshot && !game.gameOver) {
      const payload = {
        snapshot,
        activeDailySeed,
        savedAt: Date.now(),
      };
      setSavedGamePayload(payload);
      saveGameSnapshotPayload(payload);
    }

    setInGameMenuVisible(false);
    setPlayMenuVisible(false);
    setEndGameSummary(null);
    setGameInfoFlavor(null);
    setPendingGameInfoFlavor(null);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(false);
    setGameStarted(false);
    setHomeScreen("main");
  }, [activeDailySeed, game, game.gameOver]);

  const handleResumeSavedGame = useCallback(() => {
    if (!savedGamePayload?.snapshot) {
      return;
    }

    const resumed = game.resumeSavedGame(savedGamePayload.snapshot);
    if (!resumed) {
      return;
    }

    setActiveDailySeed(savedGamePayload.activeDailySeed ?? null);
    setEndGameSummary(null);
    setGameInfoFlavor(null);
    setPendingGameInfoFlavor(null);
    setPendingBlankPlacement(null);
    setConfirmLeaveGameVisible(false);
    setPendingLeaderboardSubmission(null);
    setLeaderboardConsentModalVisible(false);
    setSettingsModalVisible(false);
    setDeleteAccountModalVisible(false);
    backendSubmitRef.current = null;
    persistedGameRef.current = null;
    setGameStarted(true);
    setPlayMenuVisible(false);
    setInGameMenuVisible(false);
  }, [game, savedGamePayload]);

  const handleCloseMessage = useCallback(() => {
    const closedMessage = game.message;
    game.setMessage(null);

    if (
      closedMessage?.title === "Word Accepted!" &&
      pendingGameInfoFlavor != null
    ) {
      setGameInfoFlavor(pendingGameInfoFlavor);
      setPendingGameInfoFlavor(null);
    }
  }, [game, pendingGameInfoFlavor]);

  const requestGameReplacement = useCallback(
    (action) => {
      if (!gameStarted && !savedGamePayload?.snapshot) {
        action();
        return;
      }

      pendingGameReplacementActionRef.current = action;
      setPlayMenuVisible(false);
      setConfirmLeaveGameVisible(true);
    },
    [gameStarted, savedGamePayload]
  );

  const handleConfirmGameReplacement = useCallback(() => {
    const pendingAction = pendingGameReplacementActionRef.current;
    pendingGameReplacementActionRef.current = null;
    setConfirmLeaveGameVisible(false);
    pendingAction?.();
  }, []);

  const handleCancelGameReplacement = useCallback(() => {
    pendingGameReplacementActionRef.current = null;
    setConfirmLeaveGameVisible(false);
    setPlayMenuVisible(true);
  }, []);
  const mainMenuBackgroundColor = darkModeEnabled ? "#0b1220" : "#f8f4ed";
  const gameBackgroundColor = darkModeEnabled ? "#0b1220" : "#fff";
  const gamePanelBackgroundColor = darkModeEnabled ? "#1e293b" : "#f5f6f7";
  const gamePrimaryTextColor = darkModeEnabled ? "#f8fafc" : "#2c3e50";
  const gameSecondaryTextColor = darkModeEnabled ? "#94a3b8" : "#7f8c8d";

  if (!dictionaryLoaded) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar
          barStyle={darkModeEnabled ? "light-content" : "dark-content"}
        />
        <View style={styles.loadingContent}>
          <Animated.View
            style={[styles.spinner, { transform: [{ rotate: spin }] }]}
          />
          <Text style={styles.loadingText}>Loading dictionary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView
      style={[
        styles.container,
        darkModeEnabled ? { backgroundColor: "#0b1220" } : null,
        !gameStarted && homeScreen === "main"
          ? { backgroundColor: mainMenuBackgroundColor }
          : null,
      ]}
    >
      <SafeAreaView
        ref={safeAreaRef}
        style={[
          styles.container,
          !gameStarted &&
            homeScreen !== "multiplayer" &&
            styles.fullScreenMenuContainer,
          !gameStarted && homeScreen === "main"
            ? { backgroundColor: mainMenuBackgroundColor }
            : null,
          darkModeEnabled ? { backgroundColor: "#0b1220" } : null,
        ]}
        onLayout={refreshContainerWindowPosition}
      >
        <StatusBar
          barStyle={darkModeEnabled ? "light-content" : "dark-content"}
        />
        {gameStarted ? (
          <View style={[styles.gameContainer, { backgroundColor: gameBackgroundColor }]}>
            {/* Top: full-width panel with menu button + game info */}
            <View style={[styles.topPanel, { backgroundColor: gamePanelBackgroundColor }]}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setInGameMenuVisible(true)}
                accessibilityLabel="Open menu"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {Platform.OS === "ios" ? (
                  <SFSymbolIcon
                    name="list.bullet"
                    size={24}
                    color={gamePrimaryTextColor}
                    weight="medium"
                    scale="medium"
                    style={styles.menuButtonIcon}
                  />
                ) : (
                  <Text style={[styles.menuButtonText, { color: gamePrimaryTextColor }]}>
                    ☰
                  </Text>
                )}
              </TouchableOpacity>
              <GameInfo
                wordCount={game.wordCount}
                turnCount={game.turnCount}
                tilesRemaining={game.tilesRemaining}
                overallHighScore={scoreRecords.overallHighScore}
                turnFlavor={gameInfoFlavor}
                pendingTurnFlavor={pendingGameInfoFlavor}
                isDarkMode={darkModeEnabled}
              />
            </View>

            <View style={styles.scoreSection}>
              <Text style={[styles.scoreValue, { color: gamePrimaryTextColor }]}>
                {displayedScore}
              </Text>
              <Text style={[styles.scoreLabel, { color: gameSecondaryTextColor }]}>
                {game.gameOver ? "Final Score" : "Score"}
              </Text>
            </View>

            <View style={styles.boardSection}>
              <GameBoard
                board={game.board}
                selectedCells={game.selectedCells}
                premiumSquares={game.premiumSquares}
                onCellClick={game.handleCellClick}
                BOARD_SIZE={game.BOARD_SIZE}
                boardLayoutRef={boardLayoutRef}
                optimisticPlacement={optimisticPlacement}
                dragSourceCell={
                  draggingTile?.from === "board"
                    ? { row: draggingTile.row, col: draggingTile.col }
                    : null
                }
                settlingBoardTile={
                  settlingTile?.destination === "board" ? settlingTile : null
                }
                onBoardTilePickup={handleBoardTilePickup}
                onBoardDragUpdate={handleBoardDragUpdate}
                onBoardTileDrop={handleBoardTileDrop}
                getDraggableTileCell={getDraggableTileCell}
                onBoardTap={handleBoardTap}
                disableOverlayInteractions={
                  draggingTile?.from === "rack" || swapAnimating
                }
                submitScorePreview={game.submitScorePreview}
                submitScorePreviewCell={
                  game.selectedCells.length > 0
                    ? game.selectedCells[game.selectedCells.length - 1]
                    : null
                }
                isDarkMode={darkModeEnabled}
              />
              {showScrabbleBanner && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scrabbleBanner,
                    {
                      opacity: scrabbleBannerOpacity,
                      transform: [{ scale: scrabbleBannerScale }],
                    },
                  ]}
                >
                  <Text style={styles.scrabbleBannerTitle}>Scrabble!</Text>
                  <Text style={styles.scrabbleBannerScore}>+50</Text>
                </Animated.View>
              )}
            </View>

            <View style={styles.bottomSection}>
              <View style={styles.tilesSection}>
                <TileRack
                  tiles={visibleRackTiles}
                  isDarkMode={darkModeEnabled}
                  isSwapMode={game.isSwapMode}
                  interactionsDisabled={swapAnimating}
                  swapMultiplier={game.swapCount + 1}
                  onMeasureLayout={updateRackLayout}
                  tileAnimationStates={rackTileAnimationStates}
                  shuffleTrigger={shuffleTrigger}
                  clearedRackTileIds={clearedRackTileIds}
                  onClearReturnAnimationComplete={
                    handleClearReturnAnimationComplete
                  }
                  draggingRackIndex={
                    draggingTile?.from === "rack" ? draggingTile.index : null
                  }
                  draggingTileId={
                    draggingTile?.from === "rack"
                      ? draggingTile.tile?.id ?? null
                      : null
                  }
                  draggingVisibleIndex={
                    draggingTile?.from === "rack"
                      ? draggingTile.visibleIndex
                      : null
                  }
                  draggingVisibleIndexValue={rackDraggingVisibleIndexValue}
                  predictedInsertionIndex={
                    draggingTile?.from === "rack" &&
                    draggingTile?.settlingDestination !== "rack"
                      ? dropTargetRackIndex
                      : null
                  }
                  hoverIndexValue={rackHoverIndexValue}
                  rackPlaceholderIndex={
                    draggingTile?.from === "board" &&
                    draggingTile?.settlingDestination !== "rack"
                      ? boardHoverRackIndex
                      : null
                  }
                  rackPlaceholderIndexValue={boardRackPlaceholderIndexValue}
                  showBoardPlaceholder={
                    draggingTile?.from === "board" &&
                    draggingTile?.settlingDestination !== "rack"
                  }
                  settlingRackPlaceholderIndex={
                    settlingTile?.destination === "rack"
                      ? settlingTile.slotIndex
                      : draggingTile?.settlingDestination === "rack" &&
                        draggingTile?.from === "board"
                        ? draggingTile.settlingSlotIndex ?? null
                      : null
                  }
                  settlingRackSlotCount={
                    settlingTile?.destination === "rack"
                      ? settlingTile.slotCount
                      : draggingTile?.settlingDestination === "rack" &&
                        draggingTile?.from === "board"
                        ? draggingTile.settlingSlotCount ?? null
                      : null
                  }
                  settlingRackTileId={
                    settlingTile?.destination === "rack"
                      ? settlingTile.id
                      : draggingTile?.settlingDestination === "rack" &&
                        draggingTile?.from === "board"
                        ? draggingTile?.tile?.id ?? null
                      : null
                  }
                  settlingRackOrder={
                    settlingTile?.destination === "rack"
                      ? settlingTile.visibleRackOrder
                      : null
                  }
                  onDragStart={handleRackDragStart}
                  onDragUpdate={handleRackDragUpdate}
                  onDrop={handleTileDrop}
                  onTilePress={
                    game.isSwapMode && !swapAnimating
                      ? game.selectTile
                      : undefined
                  }
                  swapSelectedIndices={
                    game.isSwapMode && !swapAnimating ? game.selectedTiles : []
                  }
                />
                {game.isSwapMode && game.tilesRemaining < 7 && (
                  <Text style={styles.swapHint}>
                    You can only swap {game.tilesRemaining} tiles
                  </Text>
                )}
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[
                      styles.controlButtonNarrow,
                      game.isSwapMode && styles.controlButtonSwapActive,
                      swapAnimating && styles.controlButtonDisabled,
                    ]}
                    onPress={handleSwapButtonPress}
                    accessibilityLabel={
                      game.isSwapMode ? "Confirm swap" : "Swap tiles"
                    }
                    delayPressIn={0}
                    activeOpacity={0.6}
                  >
                    {Platform.OS === "ios" ? (
                      <SFSymbolIcon
                        name="arrow.down.left.arrow.up.right.square"
                        size={CONTROL_ICON_SIZE}
                        color="#fff"
                        weight="medium"
                        scale="medium"
                        style={styles.controlIcon}
                      />
                    ) : (
                      <Text style={styles.controlButtonTextLarge}>
                        {game.isSwapMode ? "Confirm" : "Swap"}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      swapAnimating && styles.controlButtonDisabled,
                      game.gameOver && styles.controlButtonDisabled,
                      !game.gameOver &&
                        !hasPendingTilesOnBoard &&
                        game.tilesRemaining > 0 &&
                        styles.controlButtonDisabled,
                    ]}
                    onPress={
                      swapAnimating ? undefined : handleSubmitButtonPress
                    }
                    disabled={
                      swapAnimating ||
                      game.gameOver ||
                      (game.tilesRemaining > 0 &&
                        !hasPendingTilesOnBoard)
                    }
                  >
                    <Text style={styles.controlButtonText}>
                      {game.gameOver
                        ? "Game Over"
                        : game.tilesRemaining === 0 &&
                          !hasPendingTilesOnBoard
                        ? "Finish!"
                        : "Submit"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.controlButtonNarrow,
                      swapAnimating && styles.controlButtonDisabled,
                    ]}
                    onPress={() => {
                      if (swapAnimating) return;
                      if (game.selectedCells.length > 0) {
                        const tileIds = game.selectedCells
                          .map(({ row, col }) => game.board[row]?.[col]?.id)
                          .filter((id) => id != null);
                        setClearedRackTileIds(tileIds);
                        game.clearSelection();
                      } else {
                        setShuffleTrigger((c) => c + 1);
                        game.shuffleRack();
                      }
                    }}
                    accessibilityLabel={
                      game.selectedCells.length > 0
                        ? "Clear selection"
                        : "Shuffle rack"
                    }
                    delayPressIn={0}
                    activeOpacity={0.6}
                  >
                    {game.selectedCells.length > 0 ? (
                      Platform.OS === "ios" ? (
                        <SFSymbolIcon
                          name="arrow.uturn.down.square"
                          size={CONTROL_ICON_SIZE}
                          color="#fff"
                          weight="medium"
                          scale="medium"
                          style={styles.controlIcon}
                        />
                      ) : (
                        <Text style={styles.controlButtonTextLarge}>Clear</Text>
                      )
                    ) : Platform.OS === "ios" ? (
                      <SFSymbolIcon
                        name="shuffle"
                        size={CONTROL_ICON_SIZE}
                        color="#fff"
                        weight="medium"
                        scale="medium"
                        style={styles.controlIcon}
                      />
                    ) : (
                      <Text style={styles.controlButtonText}>Shuffle</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            {homeScreen === "leaderboard" ? (
              <LeaderboardScreen
                initialPage={leaderboardInitialPage}
                isDarkMode={darkModeEnabled}
                globalLeaderboardEntries={leaderboardEntries}
                globalLeaderboardLoading={leaderboardLoading}
                globalLeaderboardError={leaderboardError}
                multiplayerLeaderboardEntries={multiplayerLeaderboardEntries}
                multiplayerLeaderboardLoading={multiplayerLeaderboardLoading}
                multiplayerLeaderboardError={multiplayerLeaderboardError}
                selectedDailySeed={selectedDailyLeaderboardSeed ?? dailySeed}
                dailyLeaderboardEntries={dailyLeaderboardEntries}
                dailyLeaderboardLoading={dailyLeaderboardLoading}
                dailyLeaderboardError={dailyLeaderboardError}
                backendConfigured={isBackendConfigured()}
                canGoPreviousDailySeed={
                  selectedDailyLeaderboardIndex >= 0 &&
                  selectedDailyLeaderboardIndex < dailySeeds.length - 1
                }
                canGoNextDailySeed={selectedDailyLeaderboardIndex > 0}
                onPreviousDailySeed={handlePreviousDailyLeaderboardSeed}
                onNextDailySeed={handleNextDailyLeaderboardSeed}
                onBack={handleBackToMainMenu}
                onRefresh={() => {
                  loadGlobalLeaderboard();
                  loadMultiplayerLeaderboard();
                  loadDailyLeaderboard(selectedDailyLeaderboardSeed ?? dailySeed);
                }}
              />
            ) : homeScreen === "stats" ? (
              <StatsScreen
                stats={playerStats}
                leaderboardPosition={leaderboardPosition}
                leaderboardPositionLoading={leaderboardPositionLoading}
                leaderboardPositionError={leaderboardPositionError}
                backendConfigured={isBackendConfigured()}
                isDarkMode={darkModeEnabled}
                onBack={handleBackToMainMenu}
              />
            ) : homeScreen === "multiplayer-menu" ? (
              <MultiplayerMenuScreen
                dailySeed={dailySeed}
                initialTab={multiplayerMenuInitialTab}
                isDarkMode={darkModeEnabled}
                onBack={handleBackToMainMenu}
                onOpenLeaderboard={handleOpenMultiplayerLeaderboard}
                onOpenActiveGame={(game) => {
                  if (!game?.sessionId || typeof game.sessionId !== "string") {
                    setAccountMessage({
                      title: "Game Unavailable",
                      text: "Could not open this multiplayer game because the session is missing.",
                    });
                    return;
                  }
                  setActiveMultiplayerSessionId(game.sessionId);
                  setHomeScreen("multiplayer");
                }}
                onOpenNewMultiplayerGame={(game) => {
                  if (!game?.sessionId || typeof game.sessionId !== "string") {
                    setAccountMessage({
                      title: "Game Unavailable",
                      text: "Could not open this multiplayer game because the session is missing.",
                    });
                    return;
                  }
                  setActiveMultiplayerSessionId(game.sessionId);
                  setHomeScreen("multiplayer");
                }}
              />
            ) : homeScreen === "multiplayer" ? (
              <MultiplayerModeScreen
                onBack={handleBackToMainMenu}
                onReturnToMultiplayerMenu={() => {
                  setMultiplayerMenuInitialTab("games");
                  setHomeScreen("multiplayer-menu");
                }}
                sessionId={activeMultiplayerSessionId}
                onSessionCompleted={handleMultiplayerSessionCompleted}
                isDarkMode={darkModeEnabled}
              />
            ) : (
              <MainMenuScreen
                playerName={playerProfile?.displayName ?? "Player"}
                hasChosenUsername={playerProfile?.hasChosenUsername ?? false}
                isDarkMode={darkModeEnabled}
                onSavePlayerName={handleSavePlayerName}
                onOpenSettings={() => setSettingsModalVisible(true)}
                onOpenPlay={handleOpenPlayModeMenu}
                onOpenMultiplayer={handleOpenMultiplayerMenu}
                onOpenLeaderboard={handleOpenLeaderboard}
                onStatsPress={() => setHomeScreen("stats")}
              />
            )}
          </>
        )}

        <MultiplayerNotificationBanner
          message={inAppMultiplayerBanner}
          onPress={() => {
            if (!inAppMultiplayerBanner?.navigationTarget) {
              return;
            }
            setInAppMultiplayerBanner(null);
            navigateFromNotificationTarget(inAppMultiplayerBanner.navigationTarget);
          }}
        />
        <InGameMenu
          visible={inGameMenuVisible}
          isDarkMode={darkModeEnabled}
          onClose={() => setInGameMenuVisible(false)}
          onOpenPlayMenu={() => {
            setInGameMenuVisible(false);
            setPlayMenuVisible(true);
          }}
          onReturnToMainMenu={handleReturnToMainMenu}
        />
        <PlayGameMenu
          visible={playMenuVisible}
          isDarkMode={darkModeEnabled}
          canDismiss={gameStarted}
          currentSeed={game.currentSeed}
          dailySeed={dailySeed}
          overallHighScore={scoreRecords.overallHighScore}
          dailyHighScore={currentDailyHighScore}
          hasSavedGame={savedGamePayload?.snapshot != null && !gameStarted}
          savedGameSeed={savedGamePayload?.snapshot?.currentSeed ?? null}
          onClose={() => setPlayMenuVisible(false)}
          onDailyGame={() => requestGameReplacement(handleDailyGameStart)}
          onResumeSavedGame={handleResumeSavedGame}
          onNewGameRandom={() => requestGameReplacement(handleRandomGameStart)}
          onNewGameWithSeed={(seed) =>
            requestGameReplacement(() =>
              startGameWithSeed(seed, { isDaily: false })
            )
          }
          onResetSeed={() => requestGameReplacement(handleResetSeed)}
        />
        <ConfirmLeaveGameModal
          visible={confirmLeaveGameVisible}
          isDarkMode={darkModeEnabled}
          onCancel={handleCancelGameReplacement}
          onConfirm={handleConfirmGameReplacement}
        />
        <MessageOverlay
          message={game.message}
          isDarkMode={darkModeEnabled}
          onClose={handleCloseMessage}
        />
        <LetterPickerModal
          visible={pendingBlankPlacement != null}
          onChooseLetter={(letter) => {
            if (pendingBlankPlacement) {
              game.placeTileOnBoard(
                pendingBlankPlacement.tileIndex,
                pendingBlankPlacement.row,
                pendingBlankPlacement.col,
                letter
              );
              setPendingBlankPlacement(null);
            }
          }}
          onCancel={() => setPendingBlankPlacement(null)}
        />
        <EndGameModal
          visible={endGameSummary != null}
          summary={endGameSummary}
          onClose={() => setEndGameSummary(null)}
        />
        <LeaderboardConsentModal
          visible={leaderboardConsentModalVisible}
          showCancel={leaderboardConsentModalSource === "settings"}
          onAllow={handleAllowLeaderboardSharing}
          onDeny={handleDenyLeaderboardSharing}
          onCancel={() => setLeaderboardConsentModalVisible(false)}
        />
        <SettingsModal
          visible={settingsModalVisible}
          leaderboardSharingEnabled={
            leaderboardConsentStatus === LEADERBOARD_CONSENT_GRANTED
          }
          multiplayerNotificationsEnabled={multiplayerNotificationsEnabled}
          darkModeEnabled={darkModeEnabled}
          onToggleMultiplayerNotifications={handleToggleMultiplayerNotifications}
          onToggleDarkMode={handleToggleDarkMode}
          onManageLeaderboardSharing={handleOpenLeaderboardSharingSettings}
          onDeleteAccount={handleOpenDeleteAccountModal}
          onClose={() => setSettingsModalVisible(false)}
        />
        <DeleteAccountModal
          visible={deleteAccountModalVisible}
          deleting={deleteAccountLoading}
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteAccountModalVisible(false)}
        />
        <MessageOverlay
          message={accountMessage}
          isDarkMode={darkModeEnabled}
          onClose={() => setAccountMessage(null)}
        />
        <View style={styles.dragOverlayContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.dragOverlay,
            {
              opacity: draggingTile ? 1 : 0,
              transform: [
                { translateX: dragPosition.x },
                { translateY: dragPosition.y },
                { scale: dragScale },
              ],
              },
            ]}
          >
          <View
            style={[
              styles.dragTile,
              draggingTile?.settlingDestination === "rack"
                ? null
                : styles.dragTileLifted,
            ]}
          >
              <Text
                style={[
                  styles.dragTileLetter,
                  (draggingTile?.tile.letter === " " ||
                    draggingTile?.tile.letter === "") &&
                    styles.dragTileLetterBlank,
                ]}
              >
                {draggingTile?.tile.letter === " " ||
                draggingTile?.tile.letter === ""
                  ? " "
                  : draggingTile?.tile.letter ?? " "}
              </Text>
              {(draggingTile?.tile.value ?? 0) > 0 && (
                <Text style={styles.dragTileValue}>
                  {draggingTile?.tile.value}
                </Text>
              )}
            </View>
          </Animated.View>
        <Animated.View
          style={[
            styles.dragOverlay,
            {
              opacity: settlingTile && !draggingTile ? 1 : 0,
              transform: [
                { translateX: settlePosition.x },
                { translateY: settlePosition.y },
                { scale: settleScale },
              ],
              },
            ]}
          >
            <View style={styles.dragTile}>
              <Text
                style={[
                  styles.dragTileLetter,
                  (settlingTile?.letter === " " ||
                    settlingTile?.letter === "") &&
                    styles.dragTileLetterBlank,
                ]}
              >
                {settlingTile?.letter === " " || settlingTile?.letter === ""
                  ? " "
                  : settlingTile?.letter ?? " "}
              </Text>
              {(settlingTile?.value ?? 0) > 0 && (
                <Text style={styles.dragTileValue}>{settlingTile?.value}</Text>
              )}
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fullScreenMenuContainer: {
    backgroundColor: "#f8f4ed",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
  },
  spinner: {
    width: 50,
    height: 50,
    borderWidth: 4,
    borderColor: "rgba(102, 126, 234, 0.3)",
    borderTopColor: "#667eea",
    borderRadius: 25,
    marginBottom: 20,
  },
  loadingText: {
    color: "#667eea",
    fontSize: 16,
  },
  gameContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
  },
  /** Top: full-width panel with grey background, menu button + game info */
  topPanel: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    backgroundColor: "#f5f6f7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  menuButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  menuButtonIcon: {
    width: 24,
    height: 24,
  },
  menuButtonText: {
    fontSize: 24,
    color: "#2c3e50",
  },
  /** Score section: below top panel, centered, larger font */
  scoreSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7f8c8d",
    marginTop: -2,
    marginBottom: 8,
  },
  /** Board: fills available space, aligned to top to sit close to score */
  boardSection: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "center",
    minHeight: 0,
  },
  scrabbleBanner: {
    position: "absolute",
    top: "18%",
    width: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  scrabbleBannerTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    color: "#d62828",
  },
  scrabbleBannerScore: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: "#d62828",
  },
  /** Bottom strip: tiles + controls */
  bottomSection: {
    width: "100%",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  tilesSection: {
    width: "100%",
    alignItems: "center",
  },
  swapHint: {
    marginTop: 6,
    fontSize: 13,
    color: "#2980b9",
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    marginTop: 8,
    width: "100%",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "#667eea",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  controlButtonNarrow: {
    flex: 1 / 3,
    backgroundColor: "#667eea",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonSwapActive: {
    backgroundColor: "#2980b9",
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  controlButtonTextLarge: {
    color: "white",
    fontWeight: "600",
    fontSize: 18,
  },
  controlIcon: {
    width: CONTROL_ICON_SIZE,
    height: CONTROL_ICON_SIZE,
  },
  dragOverlayContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  dragOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 42,
    height: 42,
  },
  dragTile: {
    width: 42,
    height: 42,
    backgroundColor: "#f5ebe0",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#667eea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  dragTileLifted: {
    opacity: 0.6,
  },
  dragTileLetter: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  dragTileLetterBlank: {
    color: "transparent",
    opacity: 0,
  },
  dragTileValue: {
    position: "absolute",
    top: 2,
    right: 3,
    fontSize: 9,
    color: "#7f8c8d",
  },
});

export default App;
