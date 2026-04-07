import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SFSymbolIcon from "./SFSymbolIcon";

const CHARACTER_TYPING_DELAY = 28;
const LINE_ADVANCE_DELAY = 180;
const FINAL_SCORE_REVEAL_DELAY = 180;
const PULSE_DURATION = 230;
const TITLE_START_DELAY = 180;
const EndGameModal = ({ visible, summary, onClose }) => {
  const [typedRows, setTypedRows] = useState([]);
  const [typedFinalScoreLabel, setTypedFinalScoreLabel] = useState("");
  const [showFinalScoreValue, setShowFinalScoreValue] = useState(false);
  const [showHighScoreText, setShowHighScoreText] = useState(false);
  const [showMinimizeButton, setShowMinimizeButton] = useState(false);
  const timeoutsRef = useRef([]);
  const finalScoreScale = useRef(new Animated.Value(1)).current;
  const titleScale = useRef(new Animated.Value(1)).current;

  const rows = useMemo(() => {
    if (!summary) return [];

    const nextRows = [
      {
        operator: "",
        label: "Points earned",
        value: {
          type: "static",
          text: `${summary.pointsEarned}`,
        },
      },
      {
        operator: "-",
        label: "Swap penalties",
        value: {
          type: "static",
          text: `- ${summary.swapPenalties}`,
        },
      },
      {
        operator: "-",
        label: "Turns played",
        value: {
          type: "static",
          text: `- ${summary.turnPenalties / 2} x 2.0`,
        },
      },
      {
        operator: "-",
        label: "Rack penalty",
        value: {
          type: "static",
          text: `- ${summary.rackPenalty}`,
        },
      },
    ];

    if (summary.scrabbleBonus > 0) {
      nextRows.push({
        operator: "+",
        label: "Scrabble bonus",
        value: {
          type: "static",
          text: `+ ${summary.scrabbleBonus}`,
        },
      });
    }

    if ((summary.timeBonus ?? 0) > 0) {
      nextRows.push({
        operator: "+",
        label: "Time bonus",
        value: {
          type: "static",
          text: `+ ${summary.timeBonus}`,
        },
      });
    }

    if ((summary.consistencyBonusTotal ?? 0) > 0) {
      nextRows.push({
        operator: "+",
        label: "Consistency bonus",
        value: {
          type: "static",
          text: `+ ${summary.consistencyBonusTotal}`,
        },
      });
    }

    return nextRows;
  }, [summary]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    finalScoreScale.stopAnimation();
    finalScoreScale.setValue(1);
    titleScale.stopAnimation();
    titleScale.setValue(1);

    if (!visible || !summary) {
      setTypedRows([]);
      setTypedFinalScoreLabel("");
      setShowFinalScoreValue(false);
      setShowHighScoreText(false);
      setShowMinimizeButton(false);
      return undefined;
    }

    setTypedRows(rows.map(() => ({ operator: "", label: "", value: "" })));
    setTypedFinalScoreLabel("");
    setShowFinalScoreValue(false);
    setShowHighScoreText(false);
    setShowMinimizeButton(false);

    const schedule = (callback, delay) => {
      const timeoutId = setTimeout(callback, delay);
      timeoutsRef.current.push(timeoutId);
    };

    const typeString = (text, onUpdate, onComplete) => {
      let index = 0;

      const typeNextCharacter = () => {
        if (index >= text.length) {
          onComplete?.();
          return;
        }

        index += 1;
        onUpdate(text.slice(0, index));
        schedule(typeNextCharacter, CHARACTER_TYPING_DELAY);
      };

      typeNextCharacter();
    };

    const startFinalScoreSequence = () => {
      typeString("Final score:", setTypedFinalScoreLabel, () => {
        schedule(() => {
          setShowFinalScoreValue(true);
          Animated.sequence([
            Animated.timing(finalScoreScale, {
              toValue: 1.5,
              duration: PULSE_DURATION,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(finalScoreScale, {
              toValue: 1,
              duration: PULSE_DURATION,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (summary.isNewHighScore) {
              setShowHighScoreText(true);
            }
            setShowMinimizeButton(true);
          });
        }, FINAL_SCORE_REVEAL_DELAY);
      });
    };

    const typeRow = (rowIndex) => {
      if (rowIndex >= rows.length) {
        schedule(startFinalScoreSequence, LINE_ADVANCE_DELAY);
        return;
      }

      const updateRow = (field, nextValue) => {
        setTypedRows((prev) => {
          const nextRows = [...prev];
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            [field]: nextValue,
          };
          return nextRows;
        });
      };
      const rowValue = rows[rowIndex].value;

      const typeValue = () => {
        typeString(rowValue.text, (nextValue) => updateRow("value", nextValue), () => {
          schedule(() => typeRow(rowIndex + 1), LINE_ADVANCE_DELAY);
        });
      };

      const typeLabel = () => {
        typeString(
          rows[rowIndex].label,
          (nextValue) => updateRow("label", nextValue),
          typeValue
        );
      };

      if (!rows[rowIndex].operator) {
        typeLabel();
        return;
      }

      typeString(
        rows[rowIndex].operator,
        (nextValue) => updateRow("operator", nextValue),
        typeLabel
      );
    };

    schedule(() => {
      Animated.sequence([
        Animated.timing(titleScale, {
          toValue: 1.16,
          duration: PULSE_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleScale, {
          toValue: 1,
          duration: PULSE_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        typeRow(0);
      });
    }, TITLE_START_DELAY);

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      finalScoreScale.stopAnimation();
      titleScale.stopAnimation();
    };
  }, [finalScoreScale, rows, summary, titleScale, visible]);

  if (!visible || !summary) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View style={styles.overlay} pointerEvents="none" />
      <View style={styles.card}>
        <Animated.Text
          style={[styles.title, { transform: [{ scale: titleScale }] }]}
        >
          Completed Board!
        </Animated.Text>

        <View style={styles.section}>
          {rows.map((row, index) => (
            <View key={`${index}-${row.label}`} style={styles.row}>
              <Text style={styles.rowOperator}>
                {typedRows[index]?.operator ?? ""}
              </Text>
              <Text style={styles.rowLabel}>{typedRows[index]?.label ?? ""}</Text>
              <Text style={styles.rowValue}>{typedRows[index]?.value ?? ""}</Text>
            </View>
          ))}
        </View>

        {typedFinalScoreLabel.length > 0 && (
          <View style={styles.finalScoreBlock}>
            <Text style={styles.finalScoreLabel}>{typedFinalScoreLabel}</Text>
            {showFinalScoreValue && (
              <Animated.Text
                style={[
                  styles.finalScoreValue,
                  { transform: [{ scale: finalScoreScale }] },
                ]}
              >
                {summary.finalScore}
              </Animated.Text>
            )}
          </View>
        )}

        {showHighScoreText && (
          <Text style={styles.highScoreText}>New high score!</Text>
        )}

        {showMinimizeButton && (
          <TouchableOpacity
            style={styles.minimizeButton}
            onPress={onClose}
            accessibilityLabel="Minimize final score"
            activeOpacity={0.8}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            {Platform.OS === "ios" ? (
              <SFSymbolIcon
                name="xmark.circle"
                size={28}
                color="#7f8c8d"
                weight="regular"
                scale="medium"
              />
            ) : (
              <Text style={styles.minimizeFallback}>X</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    backgroundColor: "#fffaf2",
    borderWidth: 1,
    borderColor: "#eadfcd",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2f6f4f",
    marginBottom: 18,
    textAlign: "center",
  },
  section: {
    gap: 10,
    minHeight: 120,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 28,
  },
  rowOperator: {
    width: 18,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 24,
    color: "#5f6c7b",
    fontWeight: "800",
  },
  rowLabel: {
    flex: 1,
    textAlign: "left",
    fontSize: 18,
    lineHeight: 24,
    color: "#5f6c7b",
    fontWeight: "700",
  },
  rowValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 24,
    color: "#2c3e50",
    fontWeight: "600",
  },
  finalScoreBlock: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#eadfcd",
    alignItems: "center",
    gap: 10,
    minHeight: 100,
  },
  finalScoreLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7f8c8d",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  finalScoreValue: {
    fontSize: 46,
    fontWeight: "900",
    color: "#2c3e50",
  },
  highScoreText: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#d97706",
  },
  minimizeButton: {
    position: "absolute",
    top: 35,
    right: 28,
    padding: 6,
  },
  minimizeFallback: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#7f8c8d",
  },
});

export default EndGameModal;
