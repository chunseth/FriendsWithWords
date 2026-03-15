import React, { useEffect, useState } from "react";
import {
  NativeModules,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { StatusBarManager } = NativeModules;

const MultiplayerNotificationBanner = ({ message, onPress }) => {
  const [topInset, setTopInset] = useState(
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0
  );

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    StatusBarManager?.getHeight?.((metrics) => {
      setTopInset(metrics?.height ?? 0);
    });
  }, []);

  if (!message?.text) {
    return null;
  }

  const isPressable = typeof onPress === "function";

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {isPressable ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPress}
          style={[styles.banner, { paddingTop: topInset + 12 }]}
        >
          <Text style={styles.title}>{message.title ?? "Multiplayer"}</Text>
          <Text style={styles.text}>{message.text}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.banner, { paddingTop: topInset + 12 }]}>
          <Text style={styles.title}>{message.title ?? "Multiplayer"}</Text>
          <Text style={styles.text}>{message.text}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4000,
    elevation: 4000,
  },
  banner: {
    backgroundColor: "#1f2937",
    borderRadius: 0,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  text: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
});

export default MultiplayerNotificationBanner;
