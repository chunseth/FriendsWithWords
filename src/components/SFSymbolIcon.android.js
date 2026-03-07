import React from "react";
import { Text } from "react-native";

const SFSymbolIcon = ({ fallback = "•", size = 16, color = "#000", style }) => (
  <Text style={[{ fontSize: size, color }, style]}>{fallback}</Text>
);

export default SFSymbolIcon;
