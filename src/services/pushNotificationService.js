import { Platform } from "react-native";
import { registerPushToken } from "./multiplayerInboxService";

let messagingModule = null;
let notifeeModule = null;
let notifeeAndroidImportance = null;

const safeRequirePushModules = () => {
  if (messagingModule && notifeeModule) {
    return { messaging: messagingModule, notifee: notifeeModule };
  }

  try {
    // eslint-disable-next-line global-require
    const messagingImport = require("@react-native-firebase/messaging");
    // eslint-disable-next-line global-require
    const notifeeImport = require("@notifee/react-native");
    messagingModule =
      typeof messagingImport.default === "function"
        ? messagingImport.default
        : messagingImport;
    notifeeModule =
      notifeeImport.default != null ? notifeeImport.default : notifeeImport;
    notifeeAndroidImportance = notifeeImport.AndroidImportance ?? null;
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
  onTokenRefresh = null,
} = {}) => {
  try {
    const modules = safeRequirePushModules();
    if (!modules) {
      return { ok: false, reason: "push_sdk_unavailable" };
    }

    const { messaging, notifee } = modules;
    const messagingClient = messaging();
    let permissionGranted = false;

    if (Platform.OS === "ios") {
      const authStatus = await messagingClient.requestPermission();
      permissionGranted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
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

    await messagingClient.registerDeviceForRemoteMessages?.();
    const token = await messagingClient.getToken();
    if (!token) {
      return { ok: false, reason: "token_unavailable" };
    }

    const provider = Platform.OS === "ios" ? "apns" : "fcm";
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

    const unsubscribeRefresh = messagingClient.onTokenRefresh(
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

    const unsubscribeForeground = messagingClient.onMessage(async (remoteMessage) => {
      const data = remoteMessage?.data ?? {};
      onForegroundNotification?.({
        title: remoteMessage?.notification?.title ?? "Multiplayer Update",
        body: remoteMessage?.notification?.body ?? "You have a multiplayer update.",
        data,
      });

      if (notifee?.displayNotification) {
        await notifee.displayNotification({
          title: remoteMessage?.notification?.title ?? "Multiplayer Update",
          body: remoteMessage?.notification?.body ?? "You have a multiplayer update.",
          android: channelId ? { channelId } : undefined,
        });
      }
    });

    return {
      ok: true,
      reason: "token_registered",
      token,
      unsubscribe: () => {
        unsubscribeRefresh?.();
        unsubscribeForeground?.();
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
