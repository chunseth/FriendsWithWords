import React from "react";
import { Text } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const ANDROID_ICON_MAP = {
  "list.bullet": "format-list-bulleted",
  "arrow.down.left.arrow.up.right.square": "swap-horiz",
  "arrow.uturn.down.square": "undo",
  shuffle: "shuffle",
  "doc.on.doc": "content-copy",
  "gearshape.fill": "settings",
  "xmark.circle": "cancel",
  magnifyingglass: "search",
};

const SFSymbolIcon = ({
  name,
  fallback = "•",
  size = 16,
  color = "#000",
  style,
}) => {
  const symbolName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
  const androidName = symbolName ? ANDROID_ICON_MAP[symbolName] : null;

  if (androidName) {
    return <MaterialIcons name={androidName} size={size} color={color} style={style} />;
  }

  return <Text style={[{ fontSize: size, color }, style]}>{fallback}</Text>;
};

export default SFSymbolIcon;
