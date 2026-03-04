import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { SLOT_WIDTH as RACK_SLOT_WIDTH } from "../components/TileRack";

const DRAG_TILE_HALF_SIZE = 21;
const DRAG_RACK_SETTLE_DURATION = 30;
const DRAG_BOARD_SETTLE_DURATION = 30;
const DRAG_RACK_RETURN_DURATION = 340;
const DRAG_RACK_RETURN_RELEASE_DELAY = 220;
const DRAG_BOARD_PICKUP_DURATION = 1;
const DRAG_RACK_PICKUP_DURATION = 1;
const BOARD_TILE_PICKUP_SLOP = 35;
const RACK_HOVER_STEP_DURATION = 18;
const RACK_HOVER_MAX_DURATION = 90;

export const useTileDragDropController = ({
  containerRef,
  boardLayoutRef,
  rackTiles,
  isRackTileUsed,
  board,
  boardSize,
  rackDropExpansionTop = 270,
  canInteract = true,
  isBoardTileDraggable,
  isBlankRackTile,
  getRackTileByIndex,
  getRackIndexByTileId,
  onPlaceRackTile,
  onMoveBoardTile,
  onRemoveBoardTile,
  onReorderRack,
  onBoardCellTap,
  onBlankPlacementRequested,
}) => {
  const rackLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const containerWindowRef = useRef({ x: 0, y: 0 });
  const dragTouchOffsetRef = useRef({
    x: DRAG_TILE_HALF_SIZE,
    y: DRAG_TILE_HALF_SIZE,
  });
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const dragAnimatingPickupRef = useRef(false);
  const dragPendingFinalizeRef = useRef(null);
  const dragReleasedDuringPickupRef = useRef(false);
  const hoverIndexRef = useRef(null);
  const boardHoverRackIndexRef = useRef(null);
  const boardDragPayloadRef = useRef(null);
  const pendingDropTargetRackIndexRef = useRef(null);
  const dropTargetFrameRef = useRef(null);
  const rackSettleClearTimeoutRef = useRef(null);
  const boardReturnCommitTimeoutRef = useRef(null);

  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const settlePosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const settleScale = useRef(new Animated.Value(1)).current;
  const rackHoverIndexValue = useRef(new Animated.Value(-1)).current;
  const boardRackPlaceholderIndexValue = useRef(
    new Animated.Value(-1)
  ).current;
  const rackDraggingVisibleIndexValue = useRef(
    new Animated.Value(-1)
  ).current;

  const [draggingTile, setDraggingTile] = useState(null);
  const [settlingTile, setSettlingTile] = useState(null);
  const [dropTargetRackIndex, setDropTargetRackIndex] = useState(null);
  const [boardHoverRackIndex, setBoardHoverRackIndex] = useState(null);
  const [optimisticPlacement, setOptimisticPlacement] = useState(null);
  const draggingTileRef = useRef(null);
  const settlingTileRef = useRef(null);
  const dropTargetRackIndexRef = useRef(null);
  const optimisticPlacementRef = useRef(null);

  const updateDraggingTile = useCallback((value) => {
    draggingTileRef.current = value;
    setDraggingTile(value);
  }, []);

  const updateSettlingTile = useCallback((value) => {
    settlingTileRef.current = value;
    setSettlingTile(value);
  }, []);

  const updateDropTargetRackIndex = useCallback((value) => {
    dropTargetRackIndexRef.current = value;
    setDropTargetRackIndex(value);
  }, []);

  const flushDropTargetRackIndex = useCallback(() => {
    dropTargetFrameRef.current = null;
    if (pendingDropTargetRackIndexRef.current !== dropTargetRackIndexRef.current) {
      updateDropTargetRackIndex(pendingDropTargetRackIndexRef.current);
    }
  }, [updateDropTargetRackIndex]);

  const scheduleDropTargetRackIndex = useCallback(
    (value) => {
      pendingDropTargetRackIndexRef.current = value;
      if (dropTargetFrameRef.current != null) {
        return;
      }
      dropTargetFrameRef.current = requestAnimationFrame(flushDropTargetRackIndex);
    },
    [flushDropTargetRackIndex]
  );

  const updateOptimisticPlacement = useCallback((value) => {
    optimisticPlacementRef.current = value;
    setOptimisticPlacement(value);
  }, []);

  const visibleRackTiles = useMemo(
    () =>
      rackTiles
        .map((tile, index) => ({
          ...tile,
          hidden:
            ((settlingTile?.destination === "rack" &&
              settlingTile?.id != null &&
              settlingTile?.id === tile.id) ||
              (draggingTile?.settlingDestination === "rack" &&
                draggingTile?.tile?.id != null &&
                draggingTile?.tile?.id === tile.id)),
          used:
            optimisticPlacement?.id === tile.id ||
            (settlingTile?.destination === "board" &&
              settlingTile?.id === tile.id) ||
            isRackTileUsed(tile, index),
          rackIndex: index,
        }))
        .filter((tile) => !tile.used)
        .map((tile, visibleIndex) => ({
          ...tile,
          visibleIndex,
        })),
    [draggingTile, isRackTileUsed, optimisticPlacement, rackTiles, settlingTile]
  );

  const refreshContainerWindowPosition = useCallback(() => {
    containerRef.current?.measureInWindow?.((x, y) => {
      containerWindowRef.current = { x, y };
    });
  }, [containerRef]);

  const updateRackLayout = useCallback((layout) => {
    if (!layout) return;
    rackLayoutRef.current = layout;
  }, []);

  const resetController = useCallback(() => {
    hoverIndexRef.current = null;
    boardHoverRackIndexRef.current = null;
    boardDragPayloadRef.current = null;
    pendingDropTargetRackIndexRef.current = null;
    if (dropTargetFrameRef.current != null) {
      cancelAnimationFrame(dropTargetFrameRef.current);
      dropTargetFrameRef.current = null;
    }
    if (rackSettleClearTimeoutRef.current != null) {
      clearTimeout(rackSettleClearTimeoutRef.current);
      rackSettleClearTimeoutRef.current = null;
    }
    if (boardReturnCommitTimeoutRef.current != null) {
      clearTimeout(boardReturnCommitTimeoutRef.current);
      boardReturnCommitTimeoutRef.current = null;
    }
    updateDraggingTile(null);
    updateSettlingTile(null);
    updateDropTargetRackIndex(null);
    boardHoverRackIndexRef.current = null;
    setBoardHoverRackIndex(null);
    updateOptimisticPlacement(null);
    dragAnimatingPickupRef.current = false;
    dragPendingFinalizeRef.current = null;
    dragReleasedDuringPickupRef.current = false;
    dragPosition.stopAnimation();
    dragScale.stopAnimation();
    dragPosition.setValue({ x: 0, y: 0 });
    dragScale.setValue(1);
    settlePosition.stopAnimation();
    settleScale.stopAnimation();
    settlePosition.setValue({ x: 0, y: 0 });
    settleScale.setValue(1);
    rackHoverIndexValue.stopAnimation();
    rackDraggingVisibleIndexValue.stopAnimation();
    rackHoverIndexValue.setValue(-1);
    boardRackPlaceholderIndexValue.setValue(-1);
    rackDraggingVisibleIndexValue.setValue(-1);
  }, [
    boardRackPlaceholderIndexValue,
    dragPosition,
    dragScale,
    rackDraggingVisibleIndexValue,
    rackHoverIndexValue,
    settlePosition,
    settleScale,
    updateDraggingTile,
    updateDropTargetRackIndex,
    updateOptimisticPlacement,
    updateSettlingTile,
  ]);

  const resetDragAnimation = useCallback(() => {
    dragAnimatingPickupRef.current = false;
    dragPendingFinalizeRef.current = null;
    dragReleasedDuringPickupRef.current = false;
    dragPosition.stopAnimation();
    dragScale.stopAnimation();
    dragPosition.setValue(dragTargetRef.current);
    dragScale.setValue(1);
  }, [dragPosition, dragScale]);

  const setDragPositionFromScreen = useCallback(
    (screenX, screenY) => {
      const { x: ox, y: oy } = containerWindowRef.current;
      const { x: touchOffsetX, y: touchOffsetY } = dragTouchOffsetRef.current;
      dragTargetRef.current = {
        x: screenX - ox - touchOffsetX,
        y: screenY - oy - touchOffsetY,
      };
      if (dragAnimatingPickupRef.current) {
        dragAnimatingPickupRef.current = false;
        dragPendingFinalizeRef.current = null;
        dragReleasedDuringPickupRef.current = false;
        dragPosition.stopAnimation();
        dragScale.stopAnimation();
        dragScale.setValue(1);
      }
      dragPosition.setValue(dragTargetRef.current);
    },
    [dragPosition]
  );

  const getRackTileSourceTarget = useCallback((visibleIndex, slotCount) => {
    const {
      x: rackScreenX,
      y: rackScreenY,
      width: rackWidth,
      height: rackHeight,
    } = rackLayoutRef.current;
    const { x: containerScreenX, y: containerScreenY } =
      containerWindowRef.current;
    if (
      typeof rackScreenX !== "number" ||
      typeof rackScreenY !== "number" ||
      typeof rackWidth !== "number" ||
      typeof rackHeight !== "number" ||
      typeof containerScreenX !== "number" ||
      typeof containerScreenY !== "number" ||
      slotCount <= 0 ||
      visibleIndex == null
    ) {
      return null;
    }

    const tileSize = DRAG_TILE_HALF_SIZE * 2;
    const rackLeft =
      rackScreenX -
      containerScreenX +
      (rackWidth - slotCount * RACK_SLOT_WIDTH) / 2;
    const tileTop =
      rackScreenY - containerScreenY + Math.max(0, (rackHeight - tileSize) / 2);
    return {
      x:
        rackLeft +
        visibleIndex * RACK_SLOT_WIDTH +
        (RACK_SLOT_WIDTH - tileSize) / 2,
      y: tileTop,
    };
  }, []);

  const getRackSlotTarget = useCallback((slotIndex, slotCount) => {
    const {
      x: rackScreenX,
      y: rackScreenY,
      width: rackWidth,
      height: rackHeight,
    } = rackLayoutRef.current;
    const { x: containerScreenX, y: containerScreenY } =
      containerWindowRef.current;
    if (
      typeof rackScreenX !== "number" ||
      typeof rackScreenY !== "number" ||
      typeof rackWidth !== "number" ||
      typeof rackHeight !== "number" ||
      typeof containerScreenX !== "number" ||
      typeof containerScreenY !== "number" ||
      slotCount <= 0 ||
      slotIndex == null
    ) {
      return null;
    }

    const tileSize = DRAG_TILE_HALF_SIZE * 2;
    const rackLeft =
      rackScreenX -
      containerScreenX +
      (rackWidth - slotCount * RACK_SLOT_WIDTH) / 2;
    const tileTop =
      rackScreenY - containerScreenY + Math.max(0, (rackHeight - tileSize) / 2);

    return {
      x:
        rackLeft +
        slotIndex * RACK_SLOT_WIDTH +
        (RACK_SLOT_WIDTH - tileSize) / 2,
      y: tileTop,
    };
  }, []);

  const getBoardTileSettleTarget = useCallback(
    (row, col) => {
      const layout = boardLayoutRef.current;
      const { x: containerScreenX, y: containerScreenY } =
        containerWindowRef.current;
      if (
        !layout ||
        typeof containerScreenX !== "number" ||
        typeof containerScreenY !== "number"
      ) {
        return null;
      }

      const { screenLeft, screenTop, screenRight, screenBottom } = layout;
      if (
        typeof screenLeft !== "number" ||
        typeof screenTop !== "number" ||
        typeof screenRight !== "number" ||
        typeof screenBottom !== "number"
      ) {
        return null;
      }

      const boardScreenSize = screenRight - screenLeft;
      const boardScreenHeight = screenBottom - screenTop;
      if (boardScreenSize <= 0 || boardScreenHeight <= 0) return null;

      const screenCellWidth = boardScreenSize / boardSize;
      const screenCellHeight = boardScreenHeight / boardSize;
      const tileRatio =
        layout.cellSize > 0
          ? Math.max(0.01, (layout.cellSize - 3) / layout.cellSize)
          : 1;
      const tileScreenSize =
        Math.min(screenCellWidth, screenCellHeight) * tileRatio;
      const tileScale = tileScreenSize / (DRAG_TILE_HALF_SIZE * 2);
      const cellCenterX =
        screenLeft - containerScreenX + (col + 0.5) * screenCellWidth;
      const cellCenterY =
        screenTop - containerScreenY + (row + 0.5) * screenCellHeight;

      return {
        x: cellCenterX - DRAG_TILE_HALF_SIZE,
        y: cellCenterY - DRAG_TILE_HALF_SIZE,
        scale: tileScale,
      };
    },
    [boardLayoutRef, boardSize]
  );

  const animateDragPickup = useCallback(() => {
    dragAnimatingPickupRef.current = false;
    dragPendingFinalizeRef.current = null;
    dragReleasedDuringPickupRef.current = false;
    dragPosition.stopAnimation();
    dragScale.stopAnimation();
    dragPosition.setValue(dragTargetRef.current);
    dragScale.setValue(1);
  }, [dragPosition, dragScale]);

  const animateBoardPickupToDragTarget = useCallback(
    (row, col) => {
      const sourceTarget = getBoardTileSettleTarget(row, col);
      if (!sourceTarget) {
        animateDragPickup();
        return;
      }
      dragAnimatingPickupRef.current = true;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      dragPosition.setValue({ x: sourceTarget.x, y: sourceTarget.y });
      dragScale.setValue(sourceTarget.scale);
      Animated.parallel([
        Animated.timing(dragPosition, {
          toValue: dragTargetRef.current,
          duration: DRAG_BOARD_PICKUP_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(dragScale, {
          toValue: 1,
          duration: DRAG_BOARD_PICKUP_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        dragAnimatingPickupRef.current = false;
        dragPosition.setValue(dragTargetRef.current);
        dragScale.setValue(1);
        if (!finished) return;
        const pendingFinalize = dragPendingFinalizeRef.current;
        if (pendingFinalize) {
          dragPendingFinalizeRef.current = null;
          pendingFinalize();
        }
      });
    },
    [animateDragPickup, dragPosition, dragScale, getBoardTileSettleTarget]
  );

  const animateRackPickupToDragTarget = useCallback(
    (sourceX, sourceY) => {
      dragAnimatingPickupRef.current = true;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      dragPosition.setValue({ x: sourceX, y: sourceY });
      dragScale.setValue(1);
      Animated.parallel([
        Animated.timing(dragPosition, {
          toValue: dragTargetRef.current,
          duration: DRAG_RACK_PICKUP_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(dragScale, {
          toValue: 1,
          duration: DRAG_RACK_PICKUP_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        dragAnimatingPickupRef.current = false;
        dragPosition.setValue(dragTargetRef.current);
        dragScale.setValue(1);
        if (!finished) return;
        const pendingFinalize = dragPendingFinalizeRef.current;
        if (pendingFinalize) {
          dragPendingFinalizeRef.current = null;
          pendingFinalize();
        }
      });
    },
    [dragPosition, dragScale]
  );

  const animateSettlingTileToBoard = useCallback(
    (startPosition, startScaleValue, settleTarget, onComplete) => {
      settlePosition.setValue(startPosition);
      settleScale.setValue(startScaleValue);
      Animated.parallel([
        Animated.timing(settlePosition, {
          toValue: { x: settleTarget.x, y: settleTarget.y },
          duration: DRAG_BOARD_SETTLE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(settleScale, {
          toValue: settleTarget.scale,
          duration: DRAG_BOARD_SETTLE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => onComplete?.());
    },
    [settlePosition, settleScale]
  );

  const animateDragIntoRackSlot = useCallback(
    (slotIndex, slotCount, onComplete) => {
      const settleTarget = getRackSlotTarget(slotIndex, slotCount);
      if (!settleTarget) {
        onComplete();
        return;
      }
      dragTargetRef.current = settleTarget;
      Animated.timing(dragPosition, {
        toValue: settleTarget,
        duration: DRAG_RACK_SETTLE_DURATION,
        useNativeDriver: true,
      }).start(() => onComplete());
    },
    [dragPosition, getRackSlotTarget]
  );

  const finalizeDrag = useCallback(
    (commit, animateBeforeCommit, options = {}) => {
      const { interruptPickup = false } = options;
      const runCommit = () => {
        const finish = () => {
          updateDraggingTile(null);
          updateDropTargetRackIndex(null);
          resetDragAnimation();
          commit();
        };
        if (animateBeforeCommit) {
          animateBeforeCommit(finish);
          return;
        }
        finish();
      };

      if (dragAnimatingPickupRef.current) {
        if (interruptPickup) {
          dragAnimatingPickupRef.current = false;
          dragPendingFinalizeRef.current = null;
          dragReleasedDuringPickupRef.current = false;
          dragPosition.stopAnimation();
          dragScale.stopAnimation();
          runCommit();
          return;
        }
        dragReleasedDuringPickupRef.current = true;
        dragPendingFinalizeRef.current = runCommit;
        return;
      }

      runCommit();
    },
    [
      dragPosition,
      dragScale,
      resetDragAnimation,
      updateDraggingTile,
      updateDropTargetRackIndex,
    ]
  );

  const completeBoardDrop = useCallback(
    (tile, settleTarget, optimistic, commit) => {
      if (!settleTarget) {
        updateDraggingTile(null);
        updateDropTargetRackIndex(null);
        resetDragAnimation();
        commit?.();
        return;
      }

      dragAnimatingPickupRef.current = false;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      updateSettlingTile({
        ...tile,
        destination: "board",
        fromRow: optimistic?.fromRow ?? null,
        fromCol: optimistic?.fromCol ?? null,
        row: optimistic?.row ?? null,
        col: optimistic?.col ?? null,
      });
      dragTargetRef.current = {
        x: settleTarget.x,
        y: settleTarget.y,
      };
      Animated.parallel([
        Animated.timing(dragPosition, {
          toValue: { x: settleTarget.x, y: settleTarget.y },
          duration: DRAG_BOARD_SETTLE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(dragScale, {
          toValue: settleTarget.scale,
          duration: DRAG_BOARD_SETTLE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        updateDraggingTile(null);
        updateSettlingTile(null);
        updateDropTargetRackIndex(null);
        resetDragAnimation();
      });
      requestAnimationFrame(() => {
        commit?.();
      });
    },
    [
      dragPosition,
      dragScale,
      resetDragAnimation,
      updateDraggingTile,
      updateDropTargetRackIndex,
      updateSettlingTile,
    ]
  );

  const completeRackReturn = useCallback(
    (tile, slotIndex, slotCount, commit) => {
      const settleTarget = getRackSlotTarget(slotIndex, slotCount);
      if (!settleTarget) {
        updateDraggingTile(null);
        updateDropTargetRackIndex(null);
        resetDragAnimation();
        commit?.();
        return;
      }
      dragAnimatingPickupRef.current = false;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      dragTargetRef.current = settleTarget;
      Animated.parallel([
        Animated.timing(dragPosition, {
          toValue: { x: settleTarget.x, y: settleTarget.y },
          duration: DRAG_RACK_RETURN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dragScale, {
          toValue: 1,
          duration: DRAG_RACK_RETURN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (rackSettleClearTimeoutRef.current != null) {
          clearTimeout(rackSettleClearTimeoutRef.current);
          rackSettleClearTimeoutRef.current = null;
        }
        updateDraggingTile(null);
        updateSettlingTile(null);
        resetDragAnimation();
      });
      updateSettlingTile({
        ...tile,
        destination: "rack",
        slotIndex,
        slotCount,
        from: "rack",
        visibleRackOrder: visibleRackTiles
          .filter((rackTile) => rackTile.id !== tile.id)
          .map((rackTile) => rackTile.id),
      });
      updateDraggingTile({
        ...(draggingTileRef.current ?? {
          from: "rack",
          index: tile.rackIndex,
          visibleIndex: slotIndex,
          tile: {
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            rackIndex: tile.rackIndex,
          },
        }),
        settlingDestination: "rack",
      });
      updateDropTargetRackIndex(null);
      rackDraggingVisibleIndexValue.setValue(-1);
      rackHoverIndexValue.setValue(-1);
      hoverIndexRef.current = null;
      if (rackSettleClearTimeoutRef.current != null) {
        clearTimeout(rackSettleClearTimeoutRef.current);
      }
      if (boardReturnCommitTimeoutRef.current != null) {
        clearTimeout(boardReturnCommitTimeoutRef.current);
        boardReturnCommitTimeoutRef.current = null;
      }
      rackSettleClearTimeoutRef.current = setTimeout(() => {
        rackSettleClearTimeoutRef.current = null;
        updateSettlingTile(null);
      }, DRAG_RACK_RETURN_RELEASE_DELAY);
      commit?.();
    },
    [
      dragPosition,
      dragScale,
      getRackSlotTarget,
      rackDraggingVisibleIndexValue,
      rackHoverIndexValue,
      resetDragAnimation,
      settlePosition,
      settleScale,
      updateDraggingTile,
      updateDropTargetRackIndex,
      updateSettlingTile,
      visibleRackTiles,
    ]
  );

  const completeBoardReturnToRack = useCallback(
    (tile, slotIndex, slotCount, commit) => {
      const settleTarget = getRackSlotTarget(slotIndex, slotCount);
      if (!settleTarget) {
        updateDraggingTile(null);
        updateDropTargetRackIndex(null);
        resetDragAnimation();
        commit?.();
        return;
      }

      dragAnimatingPickupRef.current = false;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      dragTargetRef.current = settleTarget;
      Animated.parallel([
        Animated.timing(dragPosition, {
          toValue: { x: settleTarget.x, y: settleTarget.y },
          duration: DRAG_RACK_RETURN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dragScale, {
          toValue: 1,
          duration: DRAG_RACK_RETURN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (rackSettleClearTimeoutRef.current != null) {
          clearTimeout(rackSettleClearTimeoutRef.current);
          rackSettleClearTimeoutRef.current = null;
        }
        updateDraggingTile(null);
        updateSettlingTile(null);
        resetDragAnimation();
      });
      updateSettlingTile({
        ...tile,
        destination: "rack",
        slotIndex,
        slotCount,
        from: "board",
        visibleRackOrder: visibleRackTiles
          .filter((rackTile) => rackTile.id !== tile.id)
          .map((rackTile) => rackTile.id),
      });
      updateDraggingTile({
        ...(draggingTileRef.current ?? {
          from: "board",
          row: null,
          col: null,
          tile: {
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            rackIndex: tile.rackIndex,
          },
        }),
        settlingDestination: "rack",
      });
      updateDropTargetRackIndex(null);
      rackDraggingVisibleIndexValue.setValue(-1);
      rackHoverIndexValue.setValue(-1);
      hoverIndexRef.current = null;
      if (rackSettleClearTimeoutRef.current != null) {
        clearTimeout(rackSettleClearTimeoutRef.current);
      }
      if (boardReturnCommitTimeoutRef.current != null) {
        clearTimeout(boardReturnCommitTimeoutRef.current);
        boardReturnCommitTimeoutRef.current = null;
      }
      rackSettleClearTimeoutRef.current = setTimeout(() => {
        rackSettleClearTimeoutRef.current = null;
        updateSettlingTile(null);
      }, DRAG_RACK_RETURN_RELEASE_DELAY);
      boardReturnCommitTimeoutRef.current = setTimeout(() => {
        boardReturnCommitTimeoutRef.current = null;
        commit?.();
      }, 0);
    },
    [
      boardReturnCommitTimeoutRef,
      dragPosition,
      dragScale,
      getRackSlotTarget,
      rackDraggingVisibleIndexValue,
      rackHoverIndexValue,
      resetDragAnimation,
      settlePosition,
      settleScale,
      updateDraggingTile,
      updateDropTargetRackIndex,
      updateSettlingTile,
      visibleRackTiles,
    ]
  );

  const computeRackIndex = useCallback(
    (screenX, screenY, rackLength, options = {}) => {
      const { clampToEdges = true } = options;
      const rack = rackLayoutRef.current;
      if (rack.width <= 0 || rack.height <= 0 || rackLength <= 0) return null;
      const { x: touchOffsetX, y: touchOffsetY } = dragTouchOffsetRef.current;
      const tileCenterX = screenX - touchOffsetX + DRAG_TILE_HALF_SIZE;
      const tileCenterY = screenY - touchOffsetY + DRAG_TILE_HALF_SIZE;
      if (
        tileCenterY < rack.y - rackDropExpansionTop ||
        tileCenterY > rack.y + rack.height
      ) {
        return null;
      }
      const rackLeft =
        rack.x + (rack.width - rackLength * RACK_SLOT_WIDTH) / 2;
      const rackRight = rackLeft + rackLength * RACK_SLOT_WIDTH;
      if (tileCenterX <= rackLeft) {
        return clampToEdges ? 0 : null;
      }
      if (tileCenterX >= rackRight) {
        return clampToEdges ? rackLength - 1 : null;
      }
      const index = Math.floor(
        (tileCenterX - rackLeft + RACK_SLOT_WIDTH / 2) / RACK_SLOT_WIDTH
      );
      return Math.min(rackLength - 1, Math.max(0, index));
    },
    [rackDropExpansionTop]
  );

  const screenToBoardCell = useCallback(
    (screenX, screenY) => {
      const layout = boardLayoutRef.current;
      if (!layout) return null;
      const { cellSize, gridSize } = layout;
      if (gridSize == null) return null;

      const viewportX = layout.x;
      const viewportY = layout.y;
      const viewportWidth = layout.width;
      const viewportHeight = layout.height;
      const hasViewportBounds =
        typeof viewportX === "number" &&
        typeof viewportY === "number" &&
        typeof viewportWidth === "number" &&
        typeof viewportHeight === "number" &&
        viewportWidth > 0 &&
        viewportHeight > 0;
      if (hasViewportBounds) {
        const viewportRight = viewportX + viewportWidth;
        const viewportBottom = viewportY + viewportHeight;
        if (
          screenX < viewportX ||
          screenX > viewportRight ||
          screenY < viewportY ||
          screenY > viewportBottom
        ) {
          return null;
        }
      }

      const sl = layout.screenLeft;
      const st = layout.screenTop;
      const sr = layout.screenRight;
      const sb = layout.screenBottom;
      const hasMeasuredBounds =
        typeof sl === "number" &&
        typeof st === "number" &&
        typeof sr === "number" &&
        typeof sb === "number";

      let gx;
      let gy;
      if (hasMeasuredBounds) {
        const width = sr - sl;
        const height = sb - st;
        if (width <= 0 || height <= 0) return null;
        gx = ((screenX - sl) / width) * gridSize;
        gy = ((screenY - st) / height) * gridSize;
        if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return null;
      } else {
        const padding = layout.padding ?? 0;
        const contentLeft = layout.x + (layout.contentOriginX ?? padding);
        const contentTop = layout.y + (layout.contentOriginY ?? padding);
        gx = screenX - contentLeft;
        gy = screenY - contentTop;
      }

      const col = Math.floor(gx / cellSize);
      const row = Math.floor(gy / cellSize);
      if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
        return { row, col };
      }
      return null;
    },
    [boardLayoutRef, boardSize]
  );

  const getDropTargetCell = useCallback(
    (screenX, screenY) => {
      const cell = screenToBoardCell(screenX, screenY);
      if (cell != null && board[cell.row][cell.col] === null) {
        return cell;
      }
      return null;
    },
    [board, screenToBoardCell]
  );

  const getCellAtPosition = useCallback(
    (screenX, screenY) => screenToBoardCell(screenX, screenY),
    [screenToBoardCell]
  );

  const getDraggableTileCell = useCallback(
    (screenX, screenY) => {
      const cell = getCellAtPosition(screenX, screenY);
      if (cell && isBoardTileDraggable(board[cell.row]?.[cell.col], cell.row, cell.col)) {
        return cell;
      }

      const layout = boardLayoutRef.current;
      if (
        !layout ||
        typeof layout.cellSize !== "number" ||
        layout.cellSize <= 0
      ) {
        return null;
      }

      const rowCandidates = cell
        ? [cell.row - 1, cell.row, cell.row + 1]
        : Array.from({ length: boardSize }, (_, row) => row);
      const colCandidates = cell
        ? [cell.col - 1, cell.col, cell.col + 1]
        : Array.from({ length: boardSize }, (_, col) => col);
      const tileScreenSize = Math.max(1, layout.cellSize - 3);

      for (const row of rowCandidates) {
        if (row < 0 || row >= boardSize) continue;
        for (const col of colCandidates) {
          if (col < 0 || col >= boardSize) continue;
          const tile = board[row]?.[col];
          if (!isBoardTileDraggable(tile, row, col)) continue;
          const settleTarget = getBoardTileSettleTarget(row, col);
          if (!settleTarget) continue;
          const left =
            settleTarget.x + containerWindowRef.current.x - BOARD_TILE_PICKUP_SLOP;
          const top =
            settleTarget.y + containerWindowRef.current.y - BOARD_TILE_PICKUP_SLOP;
          const size = tileScreenSize + BOARD_TILE_PICKUP_SLOP * 2;
          if (
            screenX >= left &&
            screenX <= left + size &&
            screenY >= top &&
            screenY <= top + size
          ) {
            return { row, col };
          }
        }
      }
      return null;
    },
    [
      board,
      boardLayoutRef,
      boardSize,
      getBoardTileSettleTarget,
      getCellAtPosition,
      isBoardTileDraggable,
    ]
  );

  const handleRackDragStart = useCallback(
    (index, tile, x, y, touchOffsetX, touchOffsetY) => {
      if (!canInteract) return;
      let interruptedSettlePosition = null;
      if (
        settlingTileRef.current?.destination === "rack" &&
        settlingTileRef.current?.id != null &&
        settlingTileRef.current.id === tile.id
      ) {
        if (rackSettleClearTimeoutRef.current != null) {
          clearTimeout(rackSettleClearTimeoutRef.current);
          rackSettleClearTimeoutRef.current = null;
        }
        settlePosition.stopAnimation((value) => {
          interruptedSettlePosition = value;
        });
      } else {
        settlePosition.stopAnimation();
      }
      settleScale.stopAnimation();
      updateSettlingTile(null);
      dragTouchOffsetRef.current = {
        x: touchOffsetX ?? DRAG_TILE_HALF_SIZE,
        y: touchOffsetY ?? DRAG_TILE_HALF_SIZE,
      };
      setDragPositionFromScreen(x ?? 0, y ?? 0);
      hoverIndexRef.current = tile.visibleIndex;
      updateDraggingTile({
        from: "rack",
        index,
        visibleIndex: tile.visibleIndex,
        tile,
      });
      rackDraggingVisibleIndexValue.setValue(tile.visibleIndex);
      rackHoverIndexValue.setValue(tile.visibleIndex);
      const pickupSource =
        interruptedSettlePosition &&
        typeof interruptedSettlePosition.x === "number" &&
        typeof interruptedSettlePosition.y === "number"
          ? interruptedSettlePosition
          : null;

      if (pickupSource) {
        animateRackPickupToDragTarget(pickupSource.x, pickupSource.y);
      } else {
        animateDragPickup();
      }
    },
    [
      animateDragPickup,
      animateRackPickupToDragTarget,
      canInteract,
      rackDraggingVisibleIndexValue,
      rackHoverIndexValue,
      setDragPositionFromScreen,
      settlePosition,
      settleScale,
      updateDraggingTile,
      updateSettlingTile,
      visibleRackTiles.length,
    ]
  );

  const handleRackDragUpdate = useCallback(
    (x, y) => {
      if (!canInteract) return;
      setDragPositionFromScreen(x, y);
      const nextIndex = computeRackIndex(x, y, visibleRackTiles.length);
      if (nextIndex !== hoverIndexRef.current) {
        const previousIndex = hoverIndexRef.current;
        hoverIndexRef.current = nextIndex;
        const targetValue = nextIndex ?? -1;
        if (nextIndex == null) {
          rackHoverIndexValue.stopAnimation();
          rackHoverIndexValue.setValue(-1);
          return;
        }
        if (previousIndex == null || previousIndex < 0) {
          rackHoverIndexValue.stopAnimation();
          rackHoverIndexValue.setValue(targetValue);
          return;
        }
        rackHoverIndexValue.stopAnimation((currentValue) => {
          const distance = Math.abs(targetValue - currentValue);
          if (distance <= 1) {
            rackHoverIndexValue.setValue(targetValue);
            return;
          }

          Animated.timing(rackHoverIndexValue, {
            toValue: targetValue,
            duration: Math.min(
              RACK_HOVER_MAX_DURATION,
              Math.max(RACK_HOVER_STEP_DURATION, distance * RACK_HOVER_STEP_DURATION)
            ),
            easing: Easing.linear,
            useNativeDriver: false,
          }).start();
        });
      }
    },
    [
      canInteract,
      computeRackIndex,
      rackHoverIndexValue,
      setDragPositionFromScreen,
      visibleRackTiles.length,
    ]
  );

  const handleTileDrop = useCallback(
    (tileIndex, screenX, screenY) => {
      if (!canInteract) return;
      hoverIndexRef.current = null;
      setDragPositionFromScreen(screenX, screenY);
      const placeAt = getDropTargetCell(screenX, screenY);
      const rackTargetIndex = computeRackIndex(
        screenX,
        screenY,
        visibleRackTiles.length
      );
      const returnRackIndex =
        rackTargetIndex ??
        (draggingTileRef.current?.from === "rack"
          ? draggingTileRef.current.visibleIndex
          : null);

      if (placeAt) {
        const tile = getRackTileByIndex(tileIndex);
        if (!tile) return;
        if (isBlankRackTile(tile)) {
          finalizeDrag(
            () => onBlankPlacementRequested?.(tileIndex, placeAt.row, placeAt.col),
            undefined,
            { interruptPickup: true }
          );
          return;
        }

        completeBoardDrop(
          {
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            rackIndex: tileIndex,
          },
          getBoardTileSettleTarget(placeAt.row, placeAt.col),
          {
            row: placeAt.row,
            col: placeAt.col,
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            rackIndex: tileIndex,
            renderTarget: false,
          },
          () => onPlaceRackTile(tileIndex, placeAt.row, placeAt.col)
        );
        return;
      }

      if (
        returnRackIndex != null &&
        visibleRackTiles.length > 0 &&
        draggingTileRef.current?.from === "rack"
      ) {
        completeRackReturn(
          {
            id: draggingTileRef.current.tile.id,
            letter: draggingTileRef.current.tile.letter,
            value: draggingTileRef.current.tile.value,
            rackIndex: draggingTileRef.current.index,
          },
          returnRackIndex,
          visibleRackTiles.length,
          () => onReorderRack(tileIndex, returnRackIndex)
        );
        return;
      }

      finalizeDrag(
        () => {
          if (rackTargetIndex != null && visibleRackTiles.length > 0) {
            onReorderRack(tileIndex, rackTargetIndex);
          }
        },
        rackTargetIndex != null && visibleRackTiles.length > 0
          ? (finish) =>
              animateDragIntoRackSlot(
                returnRackIndex,
                visibleRackTiles.length,
                finish
              )
          : undefined
      );
    },
    [
      animateDragIntoRackSlot,
      canInteract,
      completeBoardDrop,
      completeRackReturn,
      computeRackIndex,
      finalizeDrag,
      getBoardTileSettleTarget,
      getDropTargetCell,
      getRackTileByIndex,
      isBlankRackTile,
      onBlankPlacementRequested,
      onPlaceRackTile,
      onReorderRack,
      setDragPositionFromScreen,
      visibleRackTiles.length,
    ]
  );

  const handleBoardTilePickup = useCallback(
    (row, col, pageX, pageY) => {
      if (!canInteract) return;
      settlePosition.stopAnimation();
      settleScale.stopAnimation();
      updateSettlingTile(null);
      const tile = board[row]?.[col];
      if (!isBoardTileDraggable(tile, row, col)) return;
      const sx = pageX ?? 0;
      const sy = pageY ?? 0;
      const payload = {
        from: "board",
        row,
        col,
        tile: {
          id: tile.id,
          letter: tile.letter,
          value: tile.value,
          rackIndex: tile.rackIndex,
        },
      };
      boardDragPayloadRef.current = payload;
      hoverIndexRef.current = null;
      boardHoverRackIndexRef.current = null;
      pendingDropTargetRackIndexRef.current = null;
      if (dropTargetFrameRef.current != null) {
        cancelAnimationFrame(dropTargetFrameRef.current);
        dropTargetFrameRef.current = null;
      }
      updateDropTargetRackIndex(null);
      setBoardHoverRackIndex(null);
      dragTouchOffsetRef.current = {
        x: DRAG_TILE_HALF_SIZE,
        y: DRAG_TILE_HALF_SIZE,
      };
      const { x: ox, y: oy } = containerWindowRef.current;
      dragTargetRef.current = {
        x: sx - ox - DRAG_TILE_HALF_SIZE,
        y: sy - oy - DRAG_TILE_HALF_SIZE,
      };
      rackDraggingVisibleIndexValue.setValue(-1);
      boardRackPlaceholderIndexValue.setValue(-1);
      updateDraggingTile(payload);
      animateBoardPickupToDragTarget(row, col);
    },
    [
      animateBoardPickupToDragTarget,
      boardRackPlaceholderIndexValue,
      board,
      canInteract,
      isBoardTileDraggable,
      rackDraggingVisibleIndexValue,
      settlePosition,
      settleScale,
      updateDraggingTile,
      updateSettlingTile,
    ]
  );

  const handleBoardDragUpdate = useCallback(
    (x, y) => {
      if (!canInteract) return;
      setDragPositionFromScreen(x, y);
      const nextIndex = computeRackIndex(x, y, visibleRackTiles.length + 1, {
        clampToEdges: false,
      });
      boardRackPlaceholderIndexValue.setValue(nextIndex ?? -1);
      boardHoverRackIndexRef.current = nextIndex;
      if (nextIndex !== hoverIndexRef.current) {
        hoverIndexRef.current = nextIndex;
      }
    },
    [
      boardRackPlaceholderIndexValue,
      canInteract,
      computeRackIndex,
      setDragPositionFromScreen,
      visibleRackTiles.length,
    ]
  );

  const handleBoardTileDrop = useCallback(
    (screenX, screenY) => {
      if (!canInteract) return;
      const payload =
        draggingTileRef.current?.from === "board"
          ? draggingTileRef.current
          : boardDragPayloadRef.current;
      if (!payload || payload.from !== "board") return;

      boardDragPayloadRef.current = null;
      const lastHoverIndex = boardHoverRackIndexRef.current;
      hoverIndexRef.current = null;
      boardHoverRackIndexRef.current = null;
      setBoardHoverRackIndex(null);
      setDragPositionFromScreen(screenX, screenY);
      const sameCellDrop = (() => {
        const cell = screenToBoardCell(screenX, screenY);
        if (!cell) return null;
        return cell.row === payload.row && cell.col === payload.col ? cell : null;
      })();
      const target = sameCellDrop ?? getDropTargetCell(screenX, screenY);
      const rackTargetIndex =
        lastHoverIndex ??
        computeRackIndex(screenX, screenY, visibleRackTiles.length + 1, {
          clampToEdges: false,
        });
      if (target != null) {
        const { tile, row: fromRow, col: fromCol } = payload;
        const rackIndex = tile?.rackIndex;
        if (rackIndex !== undefined && tile) {
          if (target.row === fromRow && target.col === fromCol) {
          completeBoardDrop(
            { id: tile.id, letter: tile.letter, value: tile.value, rackIndex },
            getBoardTileSettleTarget(target.row, target.col),
            null,
            () => {}
          );
            return;
          }
          completeBoardDrop(
            { id: tile.id, letter: tile.letter, value: tile.value, rackIndex },
            getBoardTileSettleTarget(target.row, target.col),
            {
              fromRow,
              fromCol,
              row: target.row,
              col: target.col,
              id: tile.id,
              letter: tile.letter,
              value: tile.value,
              rackIndex,
              renderTarget: false,
            },
            () => onMoveBoardTile(fromRow, fromCol, target.row, target.col)
          );
        }
        return;
      }

      if (rackTargetIndex == null) {
        const { tile, row: fromRow, col: fromCol } = payload;
        if (tile) {
          completeBoardDrop(
            {
              id: tile.id,
              letter: tile.letter,
              value: tile.value,
              rackIndex: tile.rackIndex,
            },
            getBoardTileSettleTarget(fromRow, fromCol),
            null,
            () => {}
          );
        }
        return;
      }

      const { tile, row: fromRow, col: fromCol } = payload;
      const rackIndex =
        tile?.id != null
          ? getRackIndexByTileId?.(tile.id) ?? tile?.rackIndex
          : tile?.rackIndex;
      if (rackIndex !== undefined && rackIndex != null && tile) {
        completeBoardReturnToRack(
          {
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            rackIndex,
          },
          rackTargetIndex,
          visibleRackTiles.length + 1,
          () => {
            onRemoveBoardTile(fromRow, fromCol);
            onReorderRack(rackIndex, rackTargetIndex, rackIndex);
          }
        );
      }
    },
    [
      canInteract,
      completeBoardDrop,
      completeBoardReturnToRack,
      computeRackIndex,
      getRackIndexByTileId,
      getBoardTileSettleTarget,
      getDropTargetCell,
      onMoveBoardTile,
      onRemoveBoardTile,
      onReorderRack,
      screenToBoardCell,
      setDragPositionFromScreen,
      visibleRackTiles.length,
    ]
  );

  const handleBoardTap = useCallback(
    (screenX, screenY) => {
      if (!canInteract) return;
      const cell = getCellAtPosition(screenX, screenY);
      if (cell) {
        onBoardCellTap?.(cell.row, cell.col);
      }
    },
    [canInteract, getCellAtPosition, onBoardCellTap]
  );

  return {
    visibleRackTiles,
    draggingTile,
    settlingTile,
    dropTargetRackIndex,
    boardHoverRackIndex,
    rackHoverIndexValue,
    boardRackPlaceholderIndexValue,
    rackDraggingVisibleIndexValue,
    optimisticPlacement,
    dragPosition,
    dragScale,
    settlePosition,
    settleScale,
    refreshContainerWindowPosition,
    updateRackLayout,
    resetController,
    getDraggableTileCell,
    handleRackDragStart,
    handleRackDragUpdate,
    handleTileDrop,
    handleBoardTilePickup,
    handleBoardDragUpdate,
    handleBoardTileDrop,
    handleBoardTap,
  };
};
