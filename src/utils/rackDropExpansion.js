import { Dimensions, Platform } from "react-native";

const IPHONE_PRO_MAX_RACK_DROP_EXPANSION_TOP = 200;
const IPHONE_PRO_RACK_DROP_EXPANSION_TOP = 150;
const IPHONE_BASE_RACK_DROP_EXPANSION_TOP = 130;
const IPHONE_SE_RACK_DROP_EXPANSION_TOP = 20;
const IPAD_PRO_3_RACK_DROP_EXPANSION_TOP = 500;
const IPAD_LANDSCAPE_MAX_RACK_DROP_EXPANSION_TOP = 20;

export function resolveRackDropExpansionTop(screenWidth, screenHeight) {
  if (Platform.OS !== "ios") {
    return IPHONE_PRO_MAX_RACK_DROP_EXPANSION_TOP;
  }

  const { width, height } = Dimensions.get("window");
  const resolvedWidth =
    typeof screenWidth === "number" && Number.isFinite(screenWidth)
      ? screenWidth
      : width;
  const resolvedHeight =
    typeof screenHeight === "number" && Number.isFinite(screenHeight)
      ? screenHeight
      : height;
  const longEdge = Math.max(resolvedWidth, resolvedHeight);
  const shortEdge = Math.min(resolvedWidth, resolvedHeight);

  if (Platform.isPad) {
    if (resolvedWidth > resolvedHeight) {
      return IPAD_LANDSCAPE_MAX_RACK_DROP_EXPANSION_TOP;
    }

    // iPad Pro 12.9" (3rd gen) reports ~1024x1366 points.
    if (shortEdge >= 1024 && longEdge >= 1366) {
      return IPAD_PRO_3_RACK_DROP_EXPANSION_TOP;
    }
    return IPHONE_PRO_MAX_RACK_DROP_EXPANSION_TOP;
  }

  // iPhone SE family (4.0"/4.7" point heights).
  if (longEdge <= 667) {
    return IPHONE_SE_RACK_DROP_EXPANSION_TOP;
  }

  // iPhone Pro Max tier.
  if (shortEdge >= 430) {
    return IPHONE_PRO_MAX_RACK_DROP_EXPANSION_TOP;
  }

  // iPhone Pro tier (e.g. wider 16 Pro footprint).
  if (shortEdge >= 402) {
    return IPHONE_PRO_RACK_DROP_EXPANSION_TOP;
  }

  // iPhone base tier.
  return IPHONE_BASE_RACK_DROP_EXPANSION_TOP;
}
