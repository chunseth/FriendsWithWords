jest.mock("../multiplayerInboxService", () => ({
  registerPushToken: jest.fn(),
}));

import {
  initializePushNotifications,
  setApplicationBadgeCount,
} from "../pushNotificationService";

describe("pushNotificationService", () => {
  it("returns sdk unavailable when native modules are missing", async () => {
    const result = await initializePushNotifications();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("push_sdk_unavailable");
  });

  it("returns badge_not_configured when notifee is unavailable", async () => {
    const result = await setApplicationBadgeCount(3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("badge_not_configured");
  });
});
