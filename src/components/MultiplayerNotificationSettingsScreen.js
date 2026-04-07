import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchMultiplayerNotificationSettings,
  saveMultiplayerNotificationSettings,
} from "../services/multiplayerNotificationSettingsService";

const MultiplayerNotificationSettingsScreen = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [turnRemindersEnabled, setTurnRemindersEnabled] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [timezone, setTimezone] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const result = await fetchMultiplayerNotificationSettings();
    if (!result.ok || !result.settings) {
      setLoading(false);
      setMessage("Could not load settings right now.");
      return;
    }

    setTurnRemindersEnabled(result.settings.turn_reminders_enabled !== false);
    setQuietHoursStart(result.settings.quiet_hours_start ?? "");
    setQuietHoursEnd(result.settings.quiet_hours_end ?? "");
    setTimezone(result.settings.timezone ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const result = await saveMultiplayerNotificationSettings({
      turnRemindersEnabled,
      quietHoursStart: quietHoursStart.trim() || null,
      quietHoursEnd: quietHoursEnd.trim() || null,
      timezone: timezone.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage("Could not save settings right now.");
      return;
    }
    setMessage("Notification settings saved.");
  }, [quietHoursEnd, quietHoursStart, timezone, turnRemindersEnabled]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backTouchTarget}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notification Settings</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <Text style={styles.info}>Loading...</Text> : null}
        {message ? <Text style={styles.info}>{message}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Turn reminders</Text>
          <Text style={styles.cardText}>
            Enable or disable multiplayer turn reminders.
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              turnRemindersEnabled && styles.toggleButtonEnabled,
            ]}
            onPress={() => setTurnRemindersEnabled((value) => !value)}
          >
            <Text style={styles.toggleLabel}>
              {turnRemindersEnabled ? "Enabled" : "Disabled"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quiet hours (optional)</Text>
          <Text style={styles.cardText}>
            Use 24-hour format (`HH:MM`) for reminder suppression.
          </Text>
          <TextInput
            style={styles.input}
            value={quietHoursStart}
            onChangeText={setQuietHoursStart}
            placeholder="Start (e.g. 22:00)"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={styles.input}
            value={quietHoursEnd}
            onChangeText={setQuietHoursEnd}
            placeholder="End (e.g. 08:00)"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={styles.input}
            value={timezone}
            onChangeText={setTimezone}
            placeholder="Timezone (e.g. America/Los_Angeles)"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
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
  backTouchTarget: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backButton: {
    color: "#2f6f4f",
    fontWeight: "700",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1f2933",
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  info: {
    color: "#4b5563",
    fontSize: 13,
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  cardText: {
    fontSize: 13,
    color: "#374151",
  },
  toggleButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
  },
  toggleButtonEnabled: {
    backgroundColor: "#2563eb",
  },
  toggleLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: "#2f6f4f",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default MultiplayerNotificationSettingsScreen;
