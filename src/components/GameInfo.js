import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";

const GameInfo = ({
  wordCount,
  turnCount,
  tilesRemaining,
  overallHighScore,
  turnFlavor,
  pendingTurnFlavor,
  isDarkMode = false,
}) => {
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const [displayFlavor, setDisplayFlavor] = useState(null);
  const [tileAnimationState, setTileAnimationState] = useState(null);
  const expressionOpacity = useRef(new Animated.Value(0)).current;
  const totalOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!turnFlavor?.id) {
      return undefined;
    }

    setDisplayFlavor(turnFlavor);
    setTileAnimationState({
      current: turnFlavor.previousTilesRemaining,
      remaining: turnFlavor.tilesDelta,
    });
    expressionOpacity.stopAnimation();
    totalOpacity.stopAnimation();
    expressionOpacity.setValue(1);
    totalOpacity.setValue(0);

    const totalDelay = 850;
    const tileStepTimeouts = [];
    const tileStepCount = Math.max(0, turnFlavor.tilesDelta ?? 0);
    const tileStepDuration =
      tileStepCount > 0 ? totalDelay / tileStepCount : totalDelay;
    for (let step = 1; step <= tileStepCount; step += 1) {
      const timeoutId = setTimeout(() => {
        setTileAnimationState({
          current: turnFlavor.previousTilesRemaining - step,
          remaining: Math.max(0, turnFlavor.tilesDelta - step),
        });
      }, step * tileStepDuration);
      tileStepTimeouts.push(timeoutId);
    }

    const animation = Animated.sequence([
      Animated.delay(totalDelay),
      Animated.parallel([
        Animated.timing(expressionOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(totalOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(() => {
      setDisplayFlavor((currentFlavor) =>
        currentFlavor?.id === turnFlavor.id ? null : currentFlavor
      );
    });

    return () => {
      animation.stop();
      tileStepTimeouts.forEach(clearTimeout);
    };
  }, [expressionOpacity, totalOpacity, turnFlavor]);

  const renderMetricValue = (label, total, flavorValue) => {
    const hasFlavor = displayFlavor && flavorValue?.delta > 0;
    const pendingValue =
      !turnFlavor?.id &&
      pendingTurnFlavor &&
      typeof flavorValue?.pendingPrevious === "number"
        ? flavorValue.pendingPrevious
        : null;

    return (
      <View style={[styles.infoItem, { backgroundColor: theme.infoBackground }]}>
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
        <View style={styles.valueContainer}>
          {hasFlavor ? (
            <>
              <Animated.Text
                style={[
                  styles.value,
                  styles.expressionValue,
                  { color: theme.valueColor },
                  { opacity: expressionOpacity },
                ]}
              >
                {flavorValue.operator === "-"
                  ? `${flavorValue.previous} - ${flavorValue.delta}`
                  : `${flavorValue.previous} + ${flavorValue.delta}`}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.value,
                  styles.totalValueOverlay,
                  { color: theme.valueColor },
                  { opacity: totalOpacity },
                ]}
              >
                {total}
              </Animated.Text>
            </>
          ) : pendingValue != null ? (
            <Text style={[styles.value, { color: theme.valueColor }]}>{pendingValue}</Text>
          ) : (
            <Text style={[styles.value, { color: theme.valueColor }]}>{total}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderTilesValue = () => {
    const hasFlavor = displayFlavor && displayFlavor.tilesDelta > 0;
    const pendingValue = !turnFlavor?.id
      ? pendingTurnFlavor?.previousTilesRemaining ?? null
      : null;

    return (
      <View style={[styles.infoItem, { backgroundColor: theme.infoBackground }]}>
        <Text style={[styles.label, { color: theme.label }]}>Tiles</Text>
        <View style={styles.valueContainer}>
          {hasFlavor ? (
            <>
              <Animated.Text
                style={[
                  styles.value,
                  styles.expressionValue,
                  { color: theme.valueColor },
                  { opacity: expressionOpacity },
                ]}
              >
                {tileAnimationState?.remaining > 0 ? (
                  <>
                    {tileAnimationState.current} -{" "}
                    <Text style={styles.subtractValue}>
                      {tileAnimationState.remaining}
                    </Text>
                  </>
                ) : (
                  `${tileAnimationState?.current ?? tilesRemaining}`
                )}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.value,
                  styles.totalValueOverlay,
                  { color: theme.valueColor },
                  { opacity: totalOpacity },
                ]}
              >
                {tilesRemaining}
              </Animated.Text>
            </>
          ) : pendingValue != null ? (
            <Text style={[styles.value, { color: theme.valueColor }]}>{pendingValue}</Text>
          ) : (
            <Text style={[styles.value, { color: theme.valueColor }]}>{tilesRemaining}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.infoItem, { backgroundColor: theme.infoBackground }]}>
          <Text style={[styles.label, { color: theme.label }]}>Best</Text>
          <Text style={[styles.value, { color: theme.valueColor }]}>
            {overallHighScore ?? "-"}
          </Text>
        </View>
        {renderMetricValue("Words", wordCount, {
          previous: displayFlavor?.previousWordCount,
          delta: displayFlavor?.wordDelta,
          operator: "+",
          pendingPrevious: pendingTurnFlavor?.previousWordCount,
        })}
        {renderMetricValue("Turn", turnCount, {
          previous: displayFlavor?.previousTurnCount,
          delta: displayFlavor?.turnDelta,
          operator: "+",
          pendingPrevious: pendingTurnFlavor?.previousTurnCount,
        })}
        {renderTilesValue()}
      </View>
    </View>
  );
};

const LIGHT_THEME = {
  infoBackground: "#ffffff",
  label: "#7f8c8d",
  valueColor: "#2c3e50",
};

const DARK_THEME = {
  infoBackground: "#4b5563",
  label: "#d1d5db",
  valueColor: "#f9fafb",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoItem: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7f8c8d",
  },
  value: {
    color: "#2c3e50",
    fontSize: 14,
    fontWeight: "700",
  },
  valueContainer: {
    minHeight: 18,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
  },
  expressionValue: {
    position: "absolute",
  },
  totalValueOverlay: {
    position: "absolute",
  },
  subtractValue: {
    color: "#c0392b",
  },
});

export default GameInfo;
