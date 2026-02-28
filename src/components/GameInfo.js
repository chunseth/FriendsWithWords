import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";

const GameInfo = ({
  wordCount,
  turnCount,
  tilesRemaining,
  overallHighScore,
  turnFlavor,
  pendingTurnFlavor,
}) => {
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

    const tileStepTimeouts = [];
    const tileStepDuration = 180;
    for (let step = 1; step <= (turnFlavor.tilesDelta ?? 0); step += 1) {
      const timeoutId = setTimeout(() => {
        setTileAnimationState({
          current: turnFlavor.previousTilesRemaining - step,
          remaining: Math.max(0, turnFlavor.tilesDelta - step),
        });
      }, step * tileStepDuration);
      tileStepTimeouts.push(timeoutId);
    }

    const totalDelay = Math.max(
      850,
      (turnFlavor.tilesDelta ?? 0) * tileStepDuration + 220
    );
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
      pendingTurnFlavor && typeof flavorValue?.pendingPrevious === "number"
        ? flavorValue.pendingPrevious
        : null;

    return (
      <View style={styles.infoItem}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          {hasFlavor ? (
            <>
              <Animated.Text
                style={[
                  styles.value,
                  styles.expressionValue,
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
                  { opacity: totalOpacity },
                ]}
              >
                {total}
              </Animated.Text>
            </>
          ) : pendingValue != null ? (
            <Text style={styles.value}>{pendingValue}</Text>
          ) : (
            <Text style={styles.value}>{total}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderTilesValue = () => {
    const hasFlavor = displayFlavor && displayFlavor.tilesDelta > 0;
    const pendingValue = pendingTurnFlavor?.previousTilesRemaining ?? null;

    return (
      <View style={styles.infoItem}>
        <Text style={styles.label}>Tiles</Text>
        <View style={styles.valueContainer}>
          {hasFlavor ? (
            <>
              <Animated.Text
                style={[
                  styles.value,
                  styles.expressionValue,
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
                  { opacity: totalOpacity },
                ]}
              >
                {tilesRemaining}
              </Animated.Text>
            </>
          ) : pendingValue != null ? (
            <Text style={styles.value}>{pendingValue}</Text>
          ) : (
            <Text style={styles.value}>{tilesRemaining}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Best</Text>
          <Text style={styles.value}>{overallHighScore ?? "-"}</Text>
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
