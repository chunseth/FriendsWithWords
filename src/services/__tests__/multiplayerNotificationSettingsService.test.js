jest.mock("../../config/backend", () => ({
  isBackendConfigured: jest.fn(() => true),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../lib/supabase", () => ({
  ensureSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

import {
  fetchMultiplayerNotificationSettings,
  saveMultiplayerNotificationSettings,
  setSessionReminderMute,
} from "../multiplayerNotificationSettingsService";
import { ensureSupabaseSession, getSupabaseClient } from "../../lib/supabase";

describe("multiplayerNotificationSettingsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureSupabaseSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" } },
    });
  });

  it("fetches settings from RPC", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: { turn_reminders_enabled: true },
        error: null,
      }),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await fetchMultiplayerNotificationSettings();
    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_multiplayer_notification_settings"
    );
  });

  it("saves settings via RPC payload mapping", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: { turn_reminders_enabled: false },
        error: null,
      }),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await saveMultiplayerNotificationSettings({
      turnRemindersEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      timezone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "upsert_multiplayer_notification_settings",
      {
        p_turn_reminders_enabled: false,
        p_quiet_hours_start: "22:00",
        p_quiet_hours_end: "08:00",
        p_timezone: "America/Los_Angeles",
      }
    );
  });

  it("sets session mute through wrapper rpc", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: { ok: true, reason: "session_mute_updated" },
        error: null,
      }),
    };
    getSupabaseClient.mockReturnValue(supabase);

    const result = await setSessionReminderMute({
      sessionId: "mp-1",
      mutedUntil: "2026-03-15T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("set_session_reminder_mute", {
      p_session_id: "mp-1",
      p_muted_until: "2026-03-15T00:00:00.000Z",
    });
  });
});
