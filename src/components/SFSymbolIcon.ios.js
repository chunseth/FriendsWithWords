import React from "react";
import { Text } from "react-native";
import { SFSymbol } from "react-native-sfsymbols";

const SFSymbolIcon = ({
  name,
  fallback = "•",
  size = 16,
  color = "#000",
  style,
  ...rest
}) => {
  const symbolName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : null;

  if (!symbolName) {
    return <Text style={[{ fontSize: size, color }, style]}>{fallback}</Text>;
  }

  return (
    <SFSymbol
      name={symbolName}
      style={style}
      color={color}
      size={size}
      {...rest}
    />
  );
};

export default SFSymbolIcon;
