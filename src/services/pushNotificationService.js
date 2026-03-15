import { Platform } from "react-native";
import { registerPushToken } from "./multiplayerInboxService";

let messagingModule = null;
let notifeeModule = null;
let notifeeAndroidImportance = null;
let notifeeEventType = null;

const safeRequirePushModules = () => {
  if (messagingModule && notifeeModule) {
    return { messaging: messagingModule, notifee: notifeeModule };
  }

  try {
    // eslint-disable-next-line global-require
    const messagingImport = require("@react-native-firebase/messaging");
    // eslint-disable-next-line global-require
    const notifeeImport = require("@notifee/react-native");
    messagingModule = messagingImport;
    notifeeModule =
      notifeeImport.default != null ? notifeeImport.default : notifeeImport;
    notifeeAndroidImportance = notifeeImport.AndroidImportance ?? null;
    notifeeEventType = notifeeImport.EventType ?? null;
    return { messaging: messagingModule, notifee: notifeeModule };
  } catch (_error) {
    return null;
  }
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const registerTokenWithRetry = async ({
  platform,
  provider,
  token,
  deviceId,
  appBuild,
}) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await registerPushToken({
      platform,
      provider,
      token,
      deviceId,
      appBuild,
    });

    if (result?.ok) {
      return result;
    }

    if (attempt < maxAttempts) {
      await sleep(150 * 2 ** (attempt - 1));
    }
  }

  return { ok: false, reason: "token_register_failed" };
};

export const initializePushNotifications = async ({
  appBuild = null,
  deviceId = "local-device",
  onForegroundNotification = null,
  onNotificationOpened = null,
  onTokenRefresh = null,
} = {}) => {
  try {
    const modules = safeRequirePushModules();
    if (!modules) {
      return { ok: false, reason: "push_sdk_unavailable" };
    }

    const {
      messaging: messagingMod,
      notifee,
    } = modules;
    const {
      getMessaging,
      getToken,
      requestPermission,
      onMessage,
      onNotificationOpenedApp,
      getInitialNotification,
      onTokenRefresh: subscribeTokenRefresh,
      AuthorizationStatus,
    } = messagingMod;
    const messagingInstance = getMessaging();
    let permissionGranted = false;

    if (Platform.OS === "ios") {
      const authStatus = await requestPermission(messagingInstance);
      permissionGranted =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
    } else {
      permissionGranted = true;
      if (Platform.Version >= 33 && notifee?.requestPermission) {
        const settings = await notifee.requestPermission();
        permissionGranted = settings?.authorizationStatus >= 1;
      }
    }

    if (!permissionGranted) {
      return { ok: false, reason: "permission_denied" };
    }

    const token = await getToken(messagingInstance);
    if (!token) {
      return { ok: false, reason: "token_unavailable" };
    }

    // Firebase Messaging getToken() returns an FCM registration token on both iOS and Android.
    const provider = "fcm";
    const registerResult = await registerTokenWithRetry({
      platform: Platform.OS,
      provider,
      token,
      deviceId,
      appBuild,
    });

    if (!registerResult.ok) {
      return registerResult;
    }

    let channelId = null;
    if (Platform.OS === "android" && notifee?.createChannel) {
      channelId = await notifee.createChannel({
        id: "multiplayer-events",
        name: "Multiplayer",
        importance: notifeeAndroidImportance?.HIGH ?? 4,
      });
    }

    const unsubscribeRefresh = subscribeTokenRefresh(
      messagingInstance,
      async (nextToken) => {
        if (!nextToken) return;
        const nextResult = await registerTokenWithRetry({
          platform: Platform.OS,
          provider,
          token: nextToken,
          deviceId,
          appBuild,
        });
        onTokenRefresh?.(nextResult, nextToken);
      }
    );

    const unsubscribeForeground = onMessage(
      messagingInstance,
      async (remoteMessage) => {
        const data = remoteMessage?.data ?? {};
        onForegroundNotification?.({
          title: remoteMessage?.notification?.title ?? "Multiplayer Update",
          body: remoteMessage?.notification?.body ?? "You have a multiplayer update.",
          data,
        });
      }
    );

    const unsubscribeOpened = onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage) => {
        onNotificationOpened?.({
          title: remoteMessage?.notification?.title ?? "Multiplayer Update",
          body: remoteMessage?.notification?.body ?? "You have a multiplayer update.",
          data: remoteMessage?.data ?? {},
        });
      }
    );

    const initialNotification = await getInitialNotification(messagingInstance);
    if (initialNotification) {
      onNotificationOpened?.({
        title: initialNotification?.notification?.title ?? "Multiplayer Update",
        body:
          initialNotification?.notification?.body ??
          "You have a multiplayer update.",
        data: initialNotification?.data ?? {},
      });
    }

    const unsubscribeNotifeeForeground =
      notifee?.onForegroundEvent && notifeeEventType?.PRESS
        ? notifee.onForegroundEvent(({ type, detail }) => {
            if (type !== notifeeEventType.PRESS) {
              return;
            }
            const notificationData = detail?.notification?.data ?? {};
            onNotificationOpened?.({
              title:
                detail?.notification?.title ??
                "Multiplayer Update",
              body:
                detail?.notification?.body ??
                "You have a multiplayer update.",
              data: notificationData,
            });
          })
        : null;

    return {
      ok: true,
      reason: "token_registered",
      token,
      unsubscribe: () => {
        unsubscribeRefresh?.();
        unsubscribeForeground?.();
        unsubscribeOpened?.();
        unsubscribeNotifeeForeground?.();
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: "push_bootstrap_failed",
      error,
    };
  }
};

export const setApplicationBadgeCount = async (count) => {
  try {
    const modules = safeRequirePushModules();
    if (!modules || !modules.notifee?.setBadgeCount) {
      return { ok: false, reason: "badge_not_configured" };
    }

    await modules.notifee.setBadgeCount(Math.max(0, Number(count) || 0));
    return { ok: true, reason: "badge_updated" };
  } catch (error) {
    return { ok: false, reason: "badge_update_failed", error };
  }
};
