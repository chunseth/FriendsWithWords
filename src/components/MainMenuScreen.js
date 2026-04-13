import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SFSymbolIcon from "./SFSymbolIcon";
import { validatePlayerDisplayName } from "../utils/playerProfile";

const USERNAME_EDIT_DEBUG = __DEV__ === true;

const nowMs = () =>
  typeof performance?.now === "function" ? performance.now() : Date.now();

const logUsernameEditDebug = (message, payload = null) => {
  if (!USERNAME_EDIT_DEBUG) {
    return;
  }
  if (payload == null) {
    console.log(`[username-edit] ${message}`);
    return;
  }
  console.log(`[username-edit] ${message}`, payload);
};

const MainMenuScreen = ({
  playerName,
  hasChosenUsername = true,
  usernamePromptToken = 0,
  isDarkMode = false,
  onSavePlayerName,
  onOpenPlay,
  onOpenMultiplayer,
  onOpenLeaderboard,
  onStatsPress,
  onOpenSettings,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(playerName ?? "");
  const [nameError, setNameError] = useState(null);
  const nameInputRef = useRef(null);
  const editStartMsRef = useRef(null);
  const firstChangeLoggedRef = useRef(false);
  const focusRequestInFlightRef = useRef(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const landscapeButtonWidth = Math.min(
    Math.max(Math.round(windowWidth * 0.56), 320),
    520
  );
  const landscapeButtonStyle = isLandscape
    ? { width: landscapeButtonWidth, alignSelf: "center" }
    : null;
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(playerName ?? "");
      setNameError(null);
    }
  }, [isEditingName, playerName]);

  useEffect(() => {
    if (hasChosenUsername || usernamePromptToken === 0) {
      return;
    }

    setIsEditingName(true);
    setDraftName(playerName ?? "");
    setNameError("Choose a username to continue.");
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  }, [hasChosenUsername, playerName, usernamePromptToken]);

  useEffect(() => {
    const keyboardWillShowSubscription = Keyboard.addListener(
      "keyboardWillShow",
      () => {
        const editStartMs = editStartMsRef.current;
        logUsernameEditDebug("keyboardWillShow", {
          sincePressMs:
            editStartMs != null ? Math.round(nowMs() - editStartMs) : null,
        });
      }
    );

    const keyboardDidShowSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        const editStartMs = editStartMsRef.current;
        logUsernameEditDebug("keyboardDidShow", {
          sincePressMs:
            editStartMs != null ? Math.round(nowMs() - editStartMs) : null,
        });
      }
    );

    return () => {
      keyboardWillShowSubscription.remove();
      keyboardDidShowSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isEditingName) {
      return undefined;
    }

    const focusTask = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(focusTask);
  }, [isEditingName]);

  const commitName = async () => {
    const trimmedName = draftName.trim();
    const validationError = validatePlayerDisplayName(trimmedName);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    const saveResult = await onSavePlayerName(trimmedName);
    if (!saveResult?.ok) {
      setNameError(
        saveResult?.errorMessage ?? "Could not save your username right now."
      );
      return;
    }

    setNameError(null);
    setIsEditingName(false);
  };

  const ensureUsernameThen = (action) => {
    if (hasChosenUsername) {
      action?.();
      return;
    }
    setIsEditingName(true);
    setNameError("Choose a username to continue.");
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>
          Daily boards. Seed battles.
        </Text>
        <View style={styles.heroHeader}>
          <Text style={[styles.title, { color: theme.title }]}>
            Friends With Words
          </Text>
          <TouchableOpacity
            style={[
              styles.settingsButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={onOpenSettings}
            accessibilityLabel="Open settings"
          >
            <SFSymbolIcon
              name="gearshape.fill"
              size={20}
              color={theme.icon}
              weight="medium"
              scale="medium"
              fallback="⚙"
            />
          </TouchableOpacity>
        </View>

        <TextInput
          ref={nameInputRef}
          style={[
            styles.nameInput,
            {
              borderColor: theme.inputBorder,
              backgroundColor: theme.inputBackground,
              color: theme.inputText,
            },
            !isEditingName && styles.nameInputPassive,
            !isEditingName && { color: theme.namePassiveText },
          ]}
          value={draftName}
          onTouchStart={() => {
            if (focusRequestInFlightRef.current) {
              return;
            }
            focusRequestInFlightRef.current = true;
            editStartMsRef.current = nowMs();
            firstChangeLoggedRef.current = false;
            logUsernameEditDebug("username press", {
              playerNameLength:
                typeof playerName === "string" ? playerName.length : 0,
            });
            setIsEditingName(true);
            nameInputRef.current?.focus();
          }}
          onChangeText={(nextValue) => {
            if (!firstChangeLoggedRef.current) {
              firstChangeLoggedRef.current = true;
              const editStartMs = editStartMsRef.current;
              logUsernameEditDebug("first onChangeText", {
                sincePressMs:
                  editStartMs != null ? Math.round(nowMs() - editStartMs) : null,
                nextLength:
                  typeof nextValue === "string" ? nextValue.length : 0,
              });
            }
            setDraftName(nextValue);
          }}
          onFocus={() => {
            const editStartMs = editStartMsRef.current;
            logUsernameEditDebug("input focus", {
              sincePressMs:
                editStartMs != null ? Math.round(nowMs() - editStartMs) : null,
            });
            setIsEditingName(true);
          }}
          onBlur={() => {
            focusRequestInFlightRef.current = false;
            const editStartMs = editStartMsRef.current;
            logUsernameEditDebug("input blur", {
              sincePressMs:
                editStartMs != null ? Math.round(nowMs() - editStartMs) : null,
              });
            setIsEditingName(false);
          }}
          onSubmitEditing={() => {
            void commitName();
          }}
          maxLength={24}
          placeholder="Username"
          placeholderTextColor={theme.placeholderText}
          returnKeyType="done"
        />

        {isEditingName && nameError ? (
          <Text style={[styles.nameError, { color: theme.errorText }]}>
            {nameError}
          </Text>
        ) : null}
      </View>

      <View style={[styles.actions, isLandscape ? styles.actionsLandscape : null]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            landscapeButtonStyle,
            { backgroundColor: theme.primaryButton },
          ]}
          onPress={() => ensureUsernameThen(onOpenPlay)}
        >
          <Text style={styles.primaryButtonText}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            landscapeButtonStyle,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => ensureUsernameThen(onOpenMultiplayer)}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.buttonText }]}>
            Multiplayer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            landscapeButtonStyle,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => ensureUsernameThen(onOpenLeaderboard)}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.buttonText }]}>
            Leaderboards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            landscapeButtonStyle,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => ensureUsernameThen(onStatsPress)}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.buttonText }]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const LIGHT_THEME = {
  background: "#f8f4ed",
  surface: "#fff",
  border: "#e3d3b9",
  title: "#22313f",
  eyebrow: "#9a6b2f",
  inputBorder: "#d8c59c",
  inputBackground: "#fffdf8",
  inputText: "#22313f",
  namePassiveText: "#2f6f4f",
  placeholderText: "#8b8d7a",
  errorText: "#b42318",
  primaryButton: "#d97706",
  buttonText: "#22313f",
  icon: "#22313f",
};

const DARK_THEME = {
  background: "#0b1220",
  surface: "#152033",
  border: "#334155",
  title: "#f8fafc",
  eyebrow: "#fdba74",
  inputBorder: "#334155",
  inputBackground: "#111b2c",
  inputText: "#f1f5f9",
  namePassiveText: "#86efac",
  placeholderText: "#94a3b8",
  errorText: "#fca5a5",
  primaryButton: "#f59e0b",
  buttonText: "#f1f5f9",
  icon: "#f8fafc",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 42,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hero: {
    gap: 10,
    paddingTop: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    flex: 1,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    marginRight: 8,
  },
  nameInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nameInputPassive: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontWeight: "800",
    paddingHorizontal: 0,
  },
  nameError: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    maxWidth: 280,
  },
  actions: {
    gap: 14,
  },
  actionsLandscape: {
    alignItems: "center",
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  secondaryButtonText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
  },
});

export default MainMenuScreen;
