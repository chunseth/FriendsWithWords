import React, { useEffect, useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

const DraggablePremiumToken = ({
  tileType,
  label,
  color,
  source,
  fromKey = null,
  hidden = false,
  size = 28,
  borderRadius = 6,
  labelSize = 10,
  style = null,
  textStyle = null,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const dragStartRef = useRef(onDragStart);
  const dragMoveRef = useRef(onDragMove);
  const dragEndRef = useRef(onDragEnd);
  const tileMetaRef = useRef({ tileType, source, fromKey });

  useEffect(() => {
    dragStartRef.current = onDragStart;
    dragMoveRef.current = onDragMove;
    dragEndRef.current = onDragEnd;
  }, [onDragEnd, onDragMove, onDragStart]);

  useEffect(() => {
    tileMetaRef.current = { tileType, source, fromKey };
  }, [fromKey, source, tileType]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const meta = tileMetaRef.current;
        dragStartRef.current?.({
          tileType: meta.tileType,
          source: meta.source,
          fromKey: meta.fromKey,
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        });
      },
      onPanResponderMove: (event) => {
        dragMoveRef.current?.({
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        });
      },
      onPanResponderRelease: (event) => {
        dragEndRef.current?.({
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        });
      },
      onPanResponderTerminate: (event) => {
        dragEndRef.current?.({
          pageX: event.nativeEvent.pageX,
          pageY: event.nativeEvent.pageY,
        });
      },
    })
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.token,
        { backgroundColor: color, width: size, height: size, borderRadius },
        style,
        hidden ? styles.hidden : null,
      ]}
    >
      <Text style={[styles.tokenText, { fontSize: labelSize }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  token: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.55)",
  },
  tokenText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 10,
  },
  hidden: {
    opacity: 0,
  },
});

export default DraggablePremiumToken;
