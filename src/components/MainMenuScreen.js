import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MainMenuScreen = ({
  playerName,
  onSavePlayerName,
  onOpenPlay,
  onOpenLeaderboard,
  onStatsPress,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(playerName ?? "");

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(playerName ?? "");
    }
  }, [isEditingName, playerName]);

  const commitName = () => {
    const trimmedName = draftName.trim();
    if (trimmedName.length > 0) {
      onSavePlayerName(trimmedName);
    }
    setIsEditingName(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Daily boards. Seed battles.</Text>
        <Text style={styles.title}>Friends With Words</Text>

        {isEditingName ? (
          <TextInput
            style={styles.nameInput}
            value={draftName}
            onChangeText={setDraftName}
            onSubmitEditing={commitName}
            onBlur={commitName}
            autoFocus
            maxLength={24}
            placeholder="Player name"
            placeholderTextColor="#8b8d7a"
            returnKeyType="done"
          />
        ) : (
          <Pressable onPress={() => setIsEditingName(true)}>
            <Text style={styles.username}>@{playerName}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onOpenPlay}>
          <Text style={styles.primaryButtonText}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onOpenLeaderboard}
        >
          <Text style={styles.secondaryButtonText}>Leaderboards</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onStatsPress}
        >
          <Text style={styles.secondaryButtonText}>Stats</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f4ed",
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 42,
  },
  hero: {
    gap: 10,
    paddingTop: 40,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#9a6b2f",
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    color: "#22313f",
    maxWidth: 260,
  },
  username: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 24,
    color: "#2f6f4f",
    fontWeight: "800",
  },
  nameInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d8c59c",
    borderRadius: 12,
    backgroundColor: "#fffdf8",
    color: "#22313f",
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actions: {
    gap: 14,
  },
  primaryButton: {
    backgroundColor: "#d97706",
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
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e3d3b9",
  },
  secondaryButtonText: {
    textAlign: "center",
    color: "#22313f",
    fontSize: 20,
    fontWeight: "800",
  },
});

export default MainMenuScreen;
