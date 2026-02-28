import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  startTransition,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
  Platform,
  UIManager,
  LayoutAnimation,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SFSymbol } from "react-native-sfsymbols";
import { useGame } from "./hooks/useGame";
import { dictionary } from "./utils/dictionary";
import GameBoard from "./components/GameBoard";
import TileRack, { SLOT_WIDTH as RACK_SLOT_WIDTH } from "./components/TileRack";
import GameInfo from "./components/GameInfo";
import MenuScreen from "./components/MenuScreen";
import MessageOverlay from "./components/MessageOverlay";
import LetterPickerModal from "./components/LetterPickerModal";
import EndGameModal from "./components/EndGameModal";
import {
  buildUpdatedScoreRecords,
  getDefaultScoreRecords,
  loadScoreRecords,
  saveScoreRecords,
} from "./utils/scoreStorage";

const CONTROL_ICON_SIZE = 22;
const RACK_DROP_EXPANSION_TOP = 270;
const IPAD_RACK_DROP_EXPANSION_TOP_EXTRA = 1000;
const DRAG_TILE_HALF_SIZE = 21;
const DRAG_RACK_SETTLE_DURATION = 30;
const DRAG_BOARD_SETTLE_DURATION = 30;
const DRAG_RACK_RETURN_DURATION = 340;
const BOARD_TILE_PICKUP_SLOP = 35;
const DRAG_BOARD_PICKUP_DURATION = 30;
const DRAG_RACK_PICKUP_DURATION = 30;
const SWAP_TILE_LIFT = 20;
const SWAP_TILE_EXIT_LIFT = 40;
const SWAP_TILE_LIFT_DURATION = 300;
const SWAP_TILE_EXIT_DURATION = 160;
const SWAP_TILE_ENTER_DURATION = 180;
const SWAP_LAYOUT_DURATION = 180;
const SWAP_STEP_DELAY = 70;
const SWAP_MULTIPLIER_POP_DURATION = 300;
const SWAP_SCORE_REPLACE_DURATION = 300;
const SWAP_MULTIPLIER_HOLD_DURATION = 500;
const SCRABBLE_BANNER_FADE_IN_DURATION = 140;
const SCRABBLE_BANNER_VISIBLE_DURATION = 1100;
const SCRABBLE_BANNER_FADE_OUT_DURATION = 220;

const BOARD_SIZE = 15;

const getDailySeed = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const getMillisecondsUntilNextLocalMidnight = (date = new Date()) => {
  const nextMidnight = new Date(date);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - date.getTime());
};

function App() {
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [dailySeed, setDailySeed] = useState(() => getDailySeed());
  const [scoreRecords, setScoreRecords] = useState(getDefaultScoreRecords);
  const [activeDailySeed, setActiveDailySeed] = useState(null);
  const [endGameSummary, setEndGameSummary] = useState(null);
  const [draggingTile, setDraggingTile] = useState(null);
  const [settlingTile, setSettlingTile] = useState(null);
  const [dropTargetRackIndex, setDropTargetRackIndex] = useState(null);
  const [optimisticPlacement, setOptimisticPlacement] = useState(null);
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [clearedRackIndices, setClearedRackIndices] = useState([]);
  const [pendingBlankPlacement, setPendingBlankPlacement] = useState(null);
  const [swapAnimating, setSwapAnimating] = useState(false);
  const [swapAnimatedPenalty, setSwapAnimatedPenalty] = useState(0);
  const [swapDisplayRack, setSwapDisplayRack] = useState(null);
  const [rackTileAnimationStates, setRackTileAnimationStates] = useState({});
  const [showScrabbleBanner, setShowScrabbleBanner] = useState(false);
  const game = useGame();
  const spinValue = useRef(new Animated.Value(0)).current;
  const scrabbleBannerOpacity = useRef(new Animated.Value(0)).current;
  const scrabbleBannerScale = useRef(new Animated.Value(0.92)).current;
  const scrabbleBannerTimeoutRef = useRef(null);
  const dailySeedRefreshTimeoutRef = useRef(null);
  const persistedGameRef = useRef(null);
  const boardLayoutRef = useRef(null);
  const safeAreaRef = useRef(null);
  const containerWindowRef = useRef({ x: 0, y: 0 });
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const settlePosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const settleScale = useRef(new Animated.Value(1)).current;
  const dragTouchOffsetRef = useRef({
    x: DRAG_TILE_HALF_SIZE,
    y: DRAG_TILE_HALF_SIZE,
  });
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const dragAnimatingPickupRef = useRef(false);
  const dragPendingFinalizeRef = useRef(null);
  const dragReleasedDuringPickupRef = useRef(false);
  const hoverIndexRef = useRef(null);
  const boardDragPayloadRef = useRef(null);
  const pendingPlacementFrameRef = useRef(null);
  const rackLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const rackTileAnimationsRef = useRef({});
  const rackSourceTiles = swapDisplayRack ?? game.tileRack;
  const visibleRackTiles = rackSourceTiles
    .map((tile, index) => ({
      ...tile,
      used:
        optimisticPlacement?.rackIndex === index ||
        (settlingTile?.destination === "board" &&
          settlingTile?.rackIndex === index) ||
        game.selectedCells.some((c) => {
          const boardTile = game.board[c.row][c.col];
          return boardTile && boardTile.rackIndex === index;
        }),
      rackIndex: index,
    }))
    .filter((t) => !t.used)
    .map((tile, visibleIndex) => ({
      ...tile,
      visibleIndex,
    }));
  const displayedScore = game.gameOver
    ? game.finalScore
    : game.totalScore - swapAnimatedPenalty;
  const currentDailyHighScore = scoreRecords.dailySeedScores[dailySeed] ?? null;
  const rackDropExpansionTop =
    Platform.OS === "ios" && Platform.isPad
      ? RACK_DROP_EXPANSION_TOP + IPAD_RACK_DROP_EXPANSION_TOP_EXTRA
      : RACK_DROP_EXPANSION_TOP;

  const refreshContainerWindowPosition = useCallback(() => {
    safeAreaRef.current?.measureInWindow?.((x, y) => {
      containerWindowRef.current = { x, y };
    });
  }, []);

  const updateRackLayout = useCallback((layout) => {
    if (!layout) return;
    rackLayoutRef.current = layout;
  }, []);

  const ensureRackTileAnimationState = useCallback(
    (tileId, scoreText = null) => {
      if (!rackTileAnimationsRef.current[tileId]) {
        rackTileAnimationsRef.current[tileId] = {
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(1),
          scoreOpacity: new Animated.Value(0),
          scoreTranslateY: new Animated.Value(0),
          scoreScale: new Animated.Value(1),
          multiplierOpacity: new Animated.Value(0),
          multiplierScale: new Animated.Value(0.85),
          scoreText,
        };
      } else if (scoreText !== null) {
        rackTileAnimationsRef.current[tileId].scoreText = scoreText;
      }

      return rackTileAnimationsRef.current[tileId];
    },
    []
  );

  const syncRackTileAnimationStates = useCallback(() => {
    setRackTileAnimationStates(
      Object.fromEntries(
        Object.entries(rackTileAnimationsRef.current).map(([tileId, state]) => [
          tileId,
          { ...state },
        ])
      )
    );
  }, []);

  const clearRackTileAnimationState = useCallback(
    (tileId) => {
      delete rackTileAnimationsRef.current[tileId];
      syncRackTileAnimationStates();
    },
    [syncRackTileAnimationStates]
  );

  const runParallel = useCallback(
    (animations) =>
      new Promise((resolve) => {
        Animated.parallel(animations).start(() => resolve());
      }),
    []
  );

  const wait = useCallback(
    (duration) =>
      new Promise((resolve) => {
        setTimeout(resolve, duration);
      }),
    []
  );

  const waitForNextFrame = useCallback(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
    []
  );

  const triggerScrabbleBanner = useCallback(() => {
    if (scrabbleBannerTimeoutRef.current != null) {
      clearTimeout(scrabbleBannerTimeoutRef.current);
      scrabbleBannerTimeoutRef.current = null;
    }

    setShowScrabbleBanner(true);
    scrabbleBannerOpacity.stopAnimation();
    scrabbleBannerScale.stopAnimation();
    scrabbleBannerOpacity.setValue(0);
    scrabbleBannerScale.setValue(0.92);

    Animated.parallel([
      Animated.timing(scrabbleBannerOpacity, {
        toValue: 1,
        duration: SCRABBLE_BANNER_FADE_IN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scrabbleBannerScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();

    scrabbleBannerTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scrabbleBannerOpacity, {
          toValue: 0,
          duration: SCRABBLE_BANNER_FADE_OUT_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrabbleBannerScale, {
          toValue: 0.97,
          duration: SCRABBLE_BANNER_FADE_OUT_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowScrabbleBanner(false);
      });
      scrabbleBannerTimeoutRef.current = null;
    }, SCRABBLE_BANNER_VISIBLE_DURATION);
  }, [scrabbleBannerOpacity, scrabbleBannerScale]);

  const animateRackLayout = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: SWAP_LAYOUT_DURATION,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  const runOptimisticPlacement = useCallback((placement, commit) => {
    if (pendingPlacementFrameRef.current != null) {
      cancelAnimationFrame(pendingPlacementFrameRef.current);
      pendingPlacementFrameRef.current = null;
    }
    setOptimisticPlacement(placement);
    pendingPlacementFrameRef.current = requestAnimationFrame(() => {
      pendingPlacementFrameRef.current = null;
      startTransition(() => {
        commit();
        setOptimisticPlacement(null);
      });
    });
  }, []);

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

  const resetDragAnimation = useCallback(() => {
    dragAnimatingPickupRef.current = false;
    dragPendingFinalizeRef.current = null;
    dragReleasedDuringPickupRef.current = false;
    dragPosition.stopAnimation();
    dragScale.stopAnimation();
    dragPosition.setValue(dragTargetRef.current);
    dragScale.setValue(1);
  }, [dragPosition, dragScale]);

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
      ]).start(() => {
        onComplete?.();
      });
    },
    [settlePosition, settleScale]
  );

  const animateSettlingTileToRack = useCallback(
    (startPosition, settleTarget, onComplete) => {
      settlePosition.setValue(startPosition);
      settleScale.setValue(1);
      Animated.parallel([
        Animated.timing(settlePosition, {
          toValue: { x: settleTarget.x, y: settleTarget.y },
          duration: DRAG_RACK_RETURN_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(settleScale, {
          toValue: 1,
          duration: DRAG_RACK_RETURN_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete?.();
      });
    },
    [settlePosition, settleScale]
  );

  const setDragPositionFromScreen = useCallback(
    (screenX, screenY) => {
      const { x: ox, y: oy } = containerWindowRef.current;
      const { x: touchOffsetX, y: touchOffsetY } = dragTouchOffsetRef.current;
      dragTargetRef.current = {
        x: screenX - ox - touchOffsetX,
        y: screenY - oy - touchOffsetY,
      };
      if (!dragAnimatingPickupRef.current) {
        dragPosition.setValue(dragTargetRef.current);
      }
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
      rackScreenY -
      containerScreenY +
      Math.max(0, (rackHeight - tileSize) / 2);
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
      rackScreenY -
      containerScreenY +
      Math.max(0, (rackHeight - tileSize) / 2);

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
      )
        return null;

      const sl = layout.screenLeft;
      const st = layout.screenTop;
      const sr = layout.screenRight;
      const sb = layout.screenBottom;
      const hasMeasuredBounds =
        typeof sl === "number" &&
        typeof st === "number" &&
        typeof sr === "number" &&
        typeof sb === "number";
      if (!hasMeasuredBounds) return null;

      const boardScreenSize = sr - sl;
      const boardScreenHeight = sb - st;
      if (boardScreenSize <= 0 || boardScreenHeight <= 0) return null;

      const screenCellWidth = boardScreenSize / BOARD_SIZE;
      const screenCellHeight = boardScreenHeight / BOARD_SIZE;
      const tileRatio =
        layout.cellSize > 0
          ? Math.max(0.01, (layout.cellSize - 3) / layout.cellSize)
          : 1;
      const tileScreenSize =
        Math.min(screenCellWidth, screenCellHeight) * tileRatio;
      const tileScale = tileScreenSize / (DRAG_TILE_HALF_SIZE * 2);
      const cellCenterX = sl - containerScreenX + (col + 0.5) * screenCellWidth;
      const cellCenterY =
        st - containerScreenY + (row + 0.5) * screenCellHeight;

      return {
        x: cellCenterX - DRAG_TILE_HALF_SIZE,
        y: cellCenterY - DRAG_TILE_HALF_SIZE,
        scale: tileScale,
      };
    },
    [boardLayoutRef]
  );

  const animateDragIntoBoardCell = useCallback(
    (row, col, onComplete) => {
      const settleTarget = getBoardTileSettleTarget(row, col);
      if (!settleTarget) {
        onComplete();
        return;
      }
      dragTargetRef.current = { x: settleTarget.x, y: settleTarget.y };
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
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
        onComplete();
      });
    },
    [dragPosition, dragScale, getBoardTileSettleTarget]
  );

  const completeBoardDrop = useCallback(
    (tile, settleTarget, optimistic, commit, options = {}) => {
      const { deferDragClear = true } = options;
      if (!settleTarget) {
        if (optimistic) setOptimisticPlacement(optimistic);
        setDraggingTile(null);
        setDropTargetRackIndex(null);
        resetDragAnimation();
        startTransition(() => {
          commit();
          setOptimisticPlacement(null);
        });
        return;
      }

      const startPosition = { ...dragTargetRef.current };
      const startScaleValue = 1;
      dragAnimatingPickupRef.current = false;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      setSettlingTile({ ...tile, destination: "board" });
      settlePosition.setValue(startPosition);
      settleScale.setValue(startScaleValue);
      const clearDrag = () => {
        setDraggingTile(null);
        setDropTargetRackIndex(null);
        resetDragAnimation();
      };
      if (deferDragClear) {
        requestAnimationFrame(clearDrag);
      } else {
        clearDrag();
      }
      animateSettlingTileToBoard(
        startPosition,
        startScaleValue,
        settleTarget,
        () => {
          if (optimistic) {
            setOptimisticPlacement({ ...optimistic, renderTarget: true });
          }
          setSettlingTile(null);
          requestAnimationFrame(() => {
            startTransition(() => {
              commit();
              setOptimisticPlacement(null);
            });
          });
        }
      );
    },
    [
      resetDragAnimation,
      animateSettlingTileToBoard,
      settlePosition,
      settleScale,
    ]
  );

  const completeRackReturn = useCallback(
    (tile, slotIndex, slotCount, commit) => {
      const settleTarget = getRackSlotTarget(slotIndex, slotCount);
      if (!settleTarget) {
        setDraggingTile(null);
        setDropTargetRackIndex(null);
        resetDragAnimation();
        commit?.();
        return;
      }
      const startPosition = { ...dragTargetRef.current };

      dragAnimatingPickupRef.current = false;
      dragPendingFinalizeRef.current = null;
      dragReleasedDuringPickupRef.current = false;
      dragPosition.stopAnimation();
      dragScale.stopAnimation();
      setSettlingTile({ ...tile, destination: "rack" });
      settlePosition.setValue(startPosition);
      settleScale.setValue(1);
      resetDragAnimation();
      animateSettlingTileToRack(startPosition, settleTarget, () => {
        commit?.();
        setSettlingTile(null);
        setDraggingTile(null);
        setDropTargetRackIndex(null);
      });
    },
    [
      resetDragAnimation,
      animateSettlingTileToRack,
      settlePosition,
      settleScale,
      getRackSlotTarget,
    ]
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
      }).start(() => {
        onComplete();
      });
    },
    [dragPosition, getRackSlotTarget]
  );

  const finalizeDrag = useCallback(
    (commit, animateBeforeCommit, options = {}) => {
      const { interruptPickup = false } = options;
      const runCommit = () => {
        const finish = () => {
          setDraggingTile(null);
          setDropTargetRackIndex(null);
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
    [dragPosition, dragScale, resetDragAnimation]
  );

  // Math-based index from finger X: rackLeft + slotWidth * index. Only used for hover; no measure per frame.
  const computeRackIndex = useCallback((screenX, screenY, rackLength) => {
    const r = rackLayoutRef.current;
    if (r.width <= 0 || r.height <= 0 || rackLength <= 0) return null;
    if (screenY < r.y - rackDropExpansionTop || screenY > r.y + r.height)
      return null;
    const rackLeft = r.x + (r.width - rackLength * RACK_SLOT_WIDTH) / 2;
    const rackRight = rackLeft + rackLength * RACK_SLOT_WIDTH;
    if (screenX <= rackLeft) return 0;
    if (screenX >= rackRight) return rackLength - 1;
    const index = Math.floor(
      (screenX - rackLeft + RACK_SLOT_WIDTH / 2) / RACK_SLOT_WIDTH
    );
    return Math.min(rackLength - 1, Math.max(0, index));
  }, [rackDropExpansionTop]);

  // Convert screen coords to board cell using measured grid bounds (scale-aware, no transform math).
  const screenToBoardCell = useCallback((screenX, screenY) => {
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

    let gx, gy;
    if (hasMeasuredBounds) {
      const w = sr - sl;
      const h = sb - st;
      if (w <= 0 || h <= 0) return null;
      // Map screen point to grid space [0, gridSize) using measured rect
      gx = ((screenX - sl) / w) * gridSize;
      gy = ((screenY - st) / h) * gridSize;
      // Reject if outside the visible grid
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return null;
    } else {
      // Fallback for 1x before first measure: content-origin mapping
      const padding = layout.padding ?? 0;
      const contentLeft = layout.x + (layout.contentOriginX ?? padding);
      const contentTop = layout.y + (layout.contentOriginY ?? padding);
      gx = screenX - contentLeft;
      gy = screenY - contentTop;
    }

    const col = Math.floor(gx / cellSize);
    const row = Math.floor(gy / cellSize);
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      return { row, col };
    }
    return null;
  }, []);

  const getDropTargetCell = useCallback(
    (screenX, screenY) => {
      const cell = screenToBoardCell(screenX, screenY);
      if (cell != null && game.board[cell.row][cell.col] === null) {
        return cell;
      }
      return null;
    },
    [game.board, screenToBoardCell]
  );

  const getCellAtPosition = useCallback(
    (screenX, screenY) => {
      return screenToBoardCell(screenX, screenY);
    },
    [screenToBoardCell]
  );

  // For zoomed overlay: return cell under (screenX, screenY) if it has a draggable tile (in play, not scored).
  const getDraggableTileCell = useCallback(
    (screenX, screenY) => {
      const isDraggableCell = (row, col) => {
        const tile = game.board[row]?.[col];
        return !!(
          tile &&
          tile.isFromRack &&
          tile.rackIndex !== undefined &&
          !tile.scored
        );
      };

      const cell = getCellAtPosition(screenX, screenY);
      if (cell && isDraggableCell(cell.row, cell.col)) return cell;

      const layout = boardLayoutRef.current;
      if (
        !layout ||
        typeof layout.cellSize !== "number" ||
        layout.cellSize <= 0
      )
        return null;

      const rowCandidates = cell
        ? [cell.row - 1, cell.row, cell.row + 1]
        : Array.from({ length: BOARD_SIZE }, (_, row) => row);
      const colCandidates = cell
        ? [cell.col - 1, cell.col, cell.col + 1]
        : Array.from({ length: BOARD_SIZE }, (_, col) => col);
      const tileScreenSize = Math.max(1, layout.cellSize - 3);

      for (const row of rowCandidates) {
        if (row < 0 || row >= BOARD_SIZE) continue;
        for (const col of colCandidates) {
          if (col < 0 || col >= BOARD_SIZE) continue;
          if (!isDraggableCell(row, col)) continue;
          const settleTarget = getBoardTileSettleTarget(row, col);
          if (!settleTarget) continue;
          const left =
            settleTarget.x +
            containerWindowRef.current.x -
            BOARD_TILE_PICKUP_SLOP;
          const top =
            settleTarget.y +
            containerWindowRef.current.y -
            BOARD_TILE_PICKUP_SLOP;
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
    [game.board, getCellAtPosition, getBoardTileSettleTarget]
  );

  const handleTileDrop = useCallback(
    (tileIndex, screenX, screenY) => {
      hoverIndexRef.current = null;
      setDragPositionFromScreen(screenX, screenY);
      if (game.isSwapMode || swapAnimating) return; // In swap mode only tap-to-select and Swap button do anything
      const cell = screenToBoardCell(screenX, screenY);
      const placeAt =
        cell != null && game.board[cell.row][cell.col] === null
          ? { row: cell.row, col: cell.col }
          : null;
      const rackTargetIndex = computeRackIndex(
        screenX,
        screenY,
        visibleRackTiles.length
      );
      const rackSettleSlotCount = visibleRackTiles.length;
      const returnRackIndex =
        rackTargetIndex ??
        (draggingTile?.from === "rack" ? draggingTile.visibleIndex : null);
      const shouldAnimateIntoRack =
        placeAt == null && returnRackIndex != null && rackSettleSlotCount > 0;
      if (placeAt) {
        const tile = game.tileRack[tileIndex];
        if (tile) {
          if (game.isBlankRackTile(tile)) {
            finalizeDrag(
              () => {
                setPendingBlankPlacement({
                  tileIndex,
                  row: placeAt.row,
                  col: placeAt.col,
                });
              },
              undefined,
              { interruptPickup: true }
            );
          } else {
            const settleTarget = getBoardTileSettleTarget(
              placeAt.row,
              placeAt.col
            );
            completeBoardDrop(
              { letter: tile.letter, value: tile.value, rackIndex: tileIndex },
              settleTarget,
              {
                row: placeAt.row,
                col: placeAt.col,
                letter: tile.letter,
                value: tile.value,
                rackIndex: tileIndex,
                renderTarget: false,
              },
              () => game.placeTileOnBoard(tileIndex, placeAt.row, placeAt.col)
            );
          }
        } else {
          completeBoardDrop(
            draggingTile?.tile ?? null,
            getBoardTileSettleTarget(placeAt.row, placeAt.col),
            null,
            () => game.placeTileOnBoard(tileIndex, placeAt.row, placeAt.col)
          );
        }
        return;
      }
      if (shouldAnimateIntoRack && draggingTile?.from === "rack") {
        completeRackReturn(
          {
            letter: draggingTile.tile.letter,
            value: draggingTile.tile.value,
            rackIndex: draggingTile.index,
          },
          returnRackIndex,
          rackSettleSlotCount,
          () => {
            if (rackTargetIndex != null && visibleRackTiles.length > 0) {
              game.reorderRack(tileIndex, rackTargetIndex);
            }
          }
        );
        return;
      }
      finalizeDrag(
        () => {
          if (rackTargetIndex != null && visibleRackTiles.length > 0) {
            game.reorderRack(tileIndex, rackTargetIndex);
          }
        },
        shouldAnimateIntoRack
          ? (finish) =>
              animateDragIntoRackSlot(
                returnRackIndex,
                rackSettleSlotCount,
                finish
              )
          : undefined,
        { interruptPickup: false }
      );
    },
    [
      game.isSwapMode,
      game.board,
      game.tileRack,
      game.placeTileOnBoard,
      game.reorderRack,
      game.isBlankRackTile,
      screenToBoardCell,
      computeRackIndex,
      visibleRackTiles.length,
      draggingTile,
      setDragPositionFromScreen,
      finalizeDrag,
      animateDragIntoRackSlot,
      getBoardTileSettleTarget,
      completeBoardDrop,
      completeRackReturn,
      swapAnimating,
    ]
  );

  // Same pickup visual at 1x and when zoomed. Do NOT remove tile from board on pickup (avoids full board re-render = lag).
  // Tile stays in state; dragSourceCell hides it in the cell. We remove/place only on drop.
  const handleBoardTilePickup = useCallback(
    (row, col, pageX, pageY) => {
      if (game.isSwapMode || swapAnimating) return;
      const tile = game.board[row]?.[col];
      if (
        !tile ||
        !tile.isFromRack ||
        tile.rackIndex === undefined ||
        tile.scored
      )
        return;
      const sx = pageX ?? 0;
      const sy = pageY ?? 0;
      const payload = {
        from: "board",
        row,
        col,
        tile: {
          letter: tile.letter,
          value: tile.value,
          rackIndex: tile.rackIndex,
        },
      };
      boardDragPayloadRef.current = payload;
      dragTouchOffsetRef.current = {
        x: DRAG_TILE_HALF_SIZE,
        y: DRAG_TILE_HALF_SIZE,
      };
      const { x: ox, y: oy } = containerWindowRef.current;
      dragTargetRef.current = {
        x: sx - ox - DRAG_TILE_HALF_SIZE,
        y: sy - oy - DRAG_TILE_HALF_SIZE,
      };
      setDraggingTile(payload);
      animateBoardPickupToDragTarget(row, col);
      refreshContainerWindowPosition();
    },
    [
      game.board,
      game.isSwapMode,
      animateBoardPickupToDragTarget,
      refreshContainerWindowPosition,
      swapAnimating,
    ]
  );

  const handleBoardTileDrop = useCallback(
    (screenX, screenY) => {
      const payload =
        draggingTile?.from === "board"
          ? draggingTile
          : boardDragPayloadRef.current;
      if (!payload || payload.from !== "board") return;
      if (swapAnimating) return;
      boardDragPayloadRef.current = null;
      hoverIndexRef.current = null;
      setDragPositionFromScreen(screenX, screenY);
      const sameCellDrop = (() => {
        const cell = screenToBoardCell(screenX, screenY);
        if (!cell) return null;
        return cell.row === payload.row && cell.col === payload.col
          ? cell
          : null;
      })();
      const target = sameCellDrop ?? getDropTargetCell(screenX, screenY);
      const rackTargetIndex = computeRackIndex(
        screenX,
        screenY,
        visibleRackTiles.length + 1
      );
      const shouldAnimateIntoRack = target == null && rackTargetIndex != null;
      if (target != null) {
        const { tile, row: fromRow, col: fromCol } = payload;
        const rackIndex = tile?.rackIndex;
        if (rackIndex !== undefined && tile) {
          if (target.row === fromRow && target.col === fromCol) {
            completeBoardDrop(
              { letter: tile.letter, value: tile.value, rackIndex },
              getBoardTileSettleTarget(target.row, target.col),
              null,
              () => {}
            );
            return;
          }
          completeBoardDrop(
            { letter: tile.letter, value: tile.value, rackIndex },
            getBoardTileSettleTarget(target.row, target.col),
            {
              fromRow,
              fromCol,
              row: target.row,
              col: target.col,
              letter: tile.letter,
              value: tile.value,
              rackIndex,
              renderTarget: false,
            },
            () => game.moveTileOnBoard(fromRow, fromCol, target.row, target.col)
          );
        }
        return;
      }
      if (rackTargetIndex == null) {
        const { tile, row: fromRow, col: fromCol } = payload;
        if (tile) {
          completeBoardDrop(
            {
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
      finalizeDrag(
        () => {
          const { tile, row: fromRow, col: fromCol } = payload;
          const rackIndex = tile?.rackIndex;
          if (rackIndex !== undefined && tile) {
            game.removeTileFromBoard(fromRow, fromCol);
            if (rackTargetIndex != null) {
              game.reorderRack(rackIndex, rackTargetIndex, rackIndex);
            }
          }
        },
        shouldAnimateIntoRack
          ? (finish) =>
              animateDragIntoRackSlot(
                rackTargetIndex,
                visibleRackTiles.length + 1,
                finish
              )
          : undefined,
        { interruptPickup: false }
      );
    },
    [
      draggingTile,
      getDropTargetCell,
      screenToBoardCell,
      computeRackIndex,
      visibleRackTiles.length,
      game.moveTileOnBoard,
      game.removeTileFromBoard,
      game.reorderRack,
      setDragPositionFromScreen,
      finalizeDrag,
      animateDragIntoRackSlot,
      getBoardTileSettleTarget,
      completeBoardDrop,
      swapAnimating,
    ]
  );

  const handleRackDragStart = useCallback(
    (index, tile, x, y, touchOffsetX, touchOffsetY) => {
      const sx = x ?? 0;
      const sy = y ?? 0;
      refreshContainerWindowPosition();
      const offsetX = touchOffsetX ?? DRAG_TILE_HALF_SIZE;
      const offsetY = touchOffsetY ?? DRAG_TILE_HALF_SIZE;
      dragTouchOffsetRef.current = { x: offsetX, y: offsetY };
      setDragPositionFromScreen(sx, sy);
      const sourceTarget = getRackTileSourceTarget(
        tile.visibleIndex,
        visibleRackTiles.length
      );
      hoverIndexRef.current = tile.visibleIndex;
      setDraggingTile({
        from: "rack",
        index,
        visibleIndex: tile.visibleIndex,
        tile,
      });
      setDropTargetRackIndex(tile.visibleIndex);
      requestAnimationFrame(() => {
        if (sourceTarget) {
          animateRackPickupToDragTarget(sourceTarget.x, sourceTarget.y);
        } else {
          animateDragPickup();
        }
      });
    },
    [
      setDragPositionFromScreen,
      getRackTileSourceTarget,
      visibleRackTiles.length,
      animateRackPickupToDragTarget,
      animateDragPickup,
      refreshContainerWindowPosition,
    ]
  );

  const handleRackDragUpdate = useCallback(
    (x, y) => {
      setDragPositionFromScreen(x, y);
      const nextIndex = computeRackIndex(x, y, visibleRackTiles.length);
      if (nextIndex !== hoverIndexRef.current) {
        hoverIndexRef.current = nextIndex;
        setDropTargetRackIndex(nextIndex);
      }
    },
    [computeRackIndex, setDragPositionFromScreen, visibleRackTiles.length]
  );

  const handleClearReturnAnimationComplete = useCallback(() => {
    setClearedRackIndices([]);
  }, []);

  const handleBoardDragUpdate = useCallback(
    (x, y) => {
      setDragPositionFromScreen(x, y);
      const nextIndex = computeRackIndex(x, y, visibleRackTiles.length + 1);
      if (nextIndex !== hoverIndexRef.current) {
        hoverIndexRef.current = nextIndex;
        setDropTargetRackIndex(nextIndex);
      }
    },
    [computeRackIndex, setDragPositionFromScreen, visibleRackTiles.length]
  );

  const handleBoardTap = useCallback(
    (screenX, screenY) => {
      if (swapAnimating) return;
      const cell = getCellAtPosition(screenX, screenY);
      if (cell) game.handleCellClick(cell.row, cell.col);
    },
    [getCellAtPosition, game.handleCellClick, swapAnimating]
  );

  const resetSwapAnimationState = useCallback(() => {
    rackTileAnimationsRef.current = {};
    setRackTileAnimationStates({});
    setSwapDisplayRack(null);
    setSwapAnimatedPenalty(0);
    setSwapAnimating(false);
  }, []);

  const animateRackInsertSequence = useCallback(
    async (tilesToInsert) => {
      for (const tile of tilesToInsert) {
        const animationState = ensureRackTileAnimationState(tile.id);
        animationState.translateY.setValue(-SWAP_TILE_LIFT);
        animationState.opacity.setValue(0);
        animationState.scoreOpacity.setValue(0);
        animationState.scoreTranslateY.setValue(0);
        animationState.scoreScale?.setValue?.(1);
        animationState.multiplierOpacity?.setValue?.(0);
        animationState.multiplierScale?.setValue?.(0.85);
        animationState.scoreText = null;
        animationState.multiplierText = null;
        syncRackTileAnimationStates();

        animateRackLayout();
        setSwapDisplayRack((prev) => [...(prev ?? []), tile]);
        await waitForNextFrame();
        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: 0,
            duration: SWAP_TILE_ENTER_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 1,
            duration: SWAP_TILE_ENTER_DURATION,
            useNativeDriver: true,
          }),
        ]);
        clearRackTileAnimationState(tile.id);
        await wait(SWAP_STEP_DELAY);
      }
    },
    [
      animateRackLayout,
      clearRackTileAnimationState,
      ensureRackTileAnimationState,
      runParallel,
      syncRackTileAnimationStates,
      wait,
      waitForNextFrame,
    ]
  );

  const handleSwapButtonPress = useCallback(async () => {
    if (swapAnimating) return;
    if (!game.isSwapMode) {
      game.swapTiles();
      return;
    }

    const preparedSwap = game.prepareSwapTiles();
    if (!preparedSwap) return;

    try {
      setSwapAnimating(true);
      setSwapDisplayRack(game.tileRack);
      setSwapAnimatedPenalty(0);

      for (const tile of preparedSwap.removedTiles) {
        const animationState = ensureRackTileAnimationState(
          tile.id,
          `- ${tile.value}`
        );
        const tilePenalty = (tile.value ?? 0) * preparedSwap.multiplier;
        animationState.translateY.setValue(0);
        animationState.opacity.setValue(1);
        animationState.scoreOpacity.setValue(0);
        animationState.scoreTranslateY.setValue(0);
        animationState.scoreScale.setValue(1);
        animationState.multiplierOpacity.setValue(0);
        animationState.multiplierScale.setValue(0.85);
        animationState.multiplierText = null;
        syncRackTileAnimationStates();

        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: -SWAP_TILE_LIFT,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreOpacity, {
            toValue: 1,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreTranslateY, {
            toValue: -10,
            duration: SWAP_TILE_LIFT_DURATION,
            useNativeDriver: true,
          }),
        ]);

        if (preparedSwap.multiplier > 1) {
          animationState.multiplierText = `x ${preparedSwap.multiplier.toFixed(
            1
          )}`;
          syncRackTileAnimationStates();
          await runParallel([
            Animated.timing(animationState.multiplierOpacity, {
              toValue: 1,
              duration: SWAP_MULTIPLIER_POP_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(animationState.multiplierScale, {
              toValue: 1,
              duration: SWAP_MULTIPLIER_POP_DURATION,
              useNativeDriver: true,
            }),
          ]);
          await wait(SWAP_MULTIPLIER_HOLD_DURATION);
          animationState.scoreText = `- ${tilePenalty}`;
          animationState.multiplierText = null;
          animationState.multiplierOpacity.setValue(0);
          animationState.multiplierScale.setValue(0.85);
          syncRackTileAnimationStates();
          await runParallel([
            Animated.sequence([
              Animated.timing(animationState.scoreScale, {
                toValue: 1.2,
                duration: SWAP_SCORE_REPLACE_DURATION,
                useNativeDriver: true,
              }),
              Animated.timing(animationState.scoreScale, {
                toValue: 1,
                duration: SWAP_SCORE_REPLACE_DURATION,
                useNativeDriver: true,
              }),
            ]),
          ]);
        } else {
          animationState.scoreText = `- ${tilePenalty}`;
          syncRackTileAnimationStates();
        }

        setSwapAnimatedPenalty((prev) => prev + tilePenalty);

        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: -SWAP_TILE_EXIT_LIFT,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 0,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreOpacity, {
            toValue: 0,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.scoreTranslateY, {
            toValue: -18,
            duration: SWAP_TILE_EXIT_DURATION,
            useNativeDriver: true,
          }),
        ]);

        animateRackLayout();
        setSwapDisplayRack(
          (prev) => prev?.filter((rackTile) => rackTile.id !== tile.id) ?? prev
        );
        clearRackTileAnimationState(tile.id);
        await wait(SWAP_LAYOUT_DURATION + SWAP_STEP_DELAY);
      }

      await animateRackInsertSequence(preparedSwap.drawnTiles);

      setSwapAnimatedPenalty(0);
      game.commitPreparedSwap(preparedSwap);
      await waitForNextFrame();
      await waitForNextFrame();
    } finally {
      resetSwapAnimationState();
    }
  }, [
    animateRackLayout,
    animateRackInsertSequence,
    clearRackTileAnimationState,
    ensureRackTileAnimationState,
    game,
    resetSwapAnimationState,
    swapAnimating,
    wait,
    waitForNextFrame,
  ]);

  const handleSubmitButtonPress = useCallback(async () => {
    if (swapAnimating || game.gameOver) return;
    if (game.tilesRemaining === 0 && game.selectedCells.length === 0) {
      game.finishGame();
      return;
    }

    const preparedSubmit = game.prepareSubmitWord();
    if (!preparedSubmit) return;

    game.commitPreparedSubmitWord(preparedSubmit);
    if (preparedSubmit.earnedScrabbleBonus) {
      triggerScrabbleBanner();
    }
    if (preparedSubmit.drawnTiles.length === 0) {
      game.finalizePreparedSubmitRack(preparedSubmit);
      return;
    }

    try {
      setSwapAnimating(true);
      setSwapAnimatedPenalty(0);
      setSwapDisplayRack(preparedSubmit.remainingRack);
      await animateRackInsertSequence(preparedSubmit.drawnTiles);
      game.finalizePreparedSubmitRack(preparedSubmit);
      await waitForNextFrame();
      await waitForNextFrame();
    } finally {
      resetSwapAnimationState();
    }
  }, [
    animateRackInsertSequence,
    game,
    resetSwapAnimationState,
    swapAnimating,
    triggerScrabbleBanner,
    waitForNextFrame,
  ]);

  useEffect(() => {
    if (!swapAnimating) {
      setSwapDisplayRack(null);
    }
  }, [swapAnimating, game.tileRack]);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    // Start spinner animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    const loadDictionary = async () => {
      await dictionary.load();
      setDictionaryLoaded(true);
    };
    loadDictionary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadPersistedScores = async () => {
      const storedRecords = await loadScoreRecords();
      setScoreRecords(storedRecords);
    };

    loadPersistedScores();
  }, []);

  useEffect(() => {
    if (
      !game.gameOver ||
      typeof game.finalScore !== "number" ||
      !game.finalScoreBreakdown
    ) {
      return;
    }

    const persistedGameKey = `${game.currentSeed ?? ""}:${game.finalScore}:${
      activeDailySeed ?? ""
    }`;
    if (persistedGameRef.current === persistedGameKey) {
      return;
    }
    persistedGameRef.current = persistedGameKey;

    const isNewHighScore =
      scoreRecords.overallHighScore == null ||
      game.finalScore > scoreRecords.overallHighScore;
    setEndGameSummary({
      ...game.finalScoreBreakdown,
      isNewHighScore,
    });

    const nextRecords = buildUpdatedScoreRecords(
      scoreRecords,
      game.finalScore,
      activeDailySeed
    );
    setScoreRecords(nextRecords);
    saveScoreRecords(nextRecords);
  }, [
    activeDailySeed,
    game.finalScore,
    game.finalScoreBreakdown,
    game.gameOver,
    game.currentSeed,
    scoreRecords,
  ]);

  useEffect(() => {
    const scheduleDailySeedRefresh = () => {
      setDailySeed(getDailySeed());
      dailySeedRefreshTimeoutRef.current = setTimeout(() => {
        scheduleDailySeedRefresh();
      }, getMillisecondsUntilNextLocalMidnight());
    };

    scheduleDailySeedRefresh();

    return () => {
      if (dailySeedRefreshTimeoutRef.current != null) {
        clearTimeout(dailySeedRefreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pendingPlacementFrameRef.current != null) {
        cancelAnimationFrame(pendingPlacementFrameRef.current);
      }
      if (scrabbleBannerTimeoutRef.current != null) {
        clearTimeout(scrabbleBannerTimeoutRef.current);
      }
      if (dailySeedRefreshTimeoutRef.current != null) {
        clearTimeout(dailySeedRefreshTimeoutRef.current);
      }
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const startGameWithSeed = useCallback(
    (seed, options = {}) => {
      game.startNewGame(seed);
      setActiveDailySeed(options.isDaily ? seed : null);
      setEndGameSummary(null);
      persistedGameRef.current = null;
      setGameStarted(true);
      setMenuVisible(false);
    },
    [game]
  );

  const handleDailyGameStart = useCallback(() => {
    startGameWithSeed(dailySeed, { isDaily: true });
  }, [dailySeed, startGameWithSeed]);

  const handleRandomGameStart = useCallback(() => {
    game.startNewGame();
    setActiveDailySeed(null);
    setEndGameSummary(null);
    persistedGameRef.current = null;
    setGameStarted(true);
    setMenuVisible(false);
  }, [game]);

  const handleResetSeed = useCallback(() => {
    game.resetGame();
    setEndGameSummary(null);
    persistedGameRef.current = null;
    setGameStarted(true);
  }, [game]);

  if (!dictionaryLoaded) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <Animated.View
            style={[styles.spinner, { transform: [{ rotate: spin }] }]}
          />
          <Text style={styles.loadingText}>Loading dictionary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView
        ref={safeAreaRef}
        style={styles.container}
        onLayout={refreshContainerWindowPosition}
      >
        <StatusBar barStyle="dark-content" />
        {gameStarted ? (
          <View style={styles.gameContainer}>
            {/* Top: full-width panel with menu button + game info */}
            <View style={styles.topPanel}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
                accessibilityLabel="Open menu"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {Platform.OS === "ios" ? (
                  <SFSymbol
                    name="list.bullet"
                    size={24}
                    color="#2c3e50"
                    weight="medium"
                    scale="medium"
                    style={styles.menuButtonIcon}
                  />
                ) : (
                  <Text style={styles.menuButtonText}>☰</Text>
                )}
              </TouchableOpacity>
              <GameInfo
                wordCount={game.wordCount}
                turnCount={game.turnCount}
                tilesRemaining={game.tilesRemaining}
                overallHighScore={scoreRecords.overallHighScore}
                currentDailyHighScore={currentDailyHighScore}
              />
            </View>

            <View style={styles.scoreSection}>
              <Text style={styles.scoreValue}>{displayedScore}</Text>
              <Text style={styles.scoreLabel}>
                {game.gameOver ? "Final Score" : "Score"}
              </Text>
            </View>

            <View style={styles.boardSection}>
              <GameBoard
                board={game.board}
                selectedCells={game.selectedCells}
                premiumSquares={game.premiumSquares}
                onCellClick={game.handleCellClick}
                BOARD_SIZE={game.BOARD_SIZE}
                boardLayoutRef={boardLayoutRef}
                optimisticPlacement={optimisticPlacement}
                dragSourceCell={
                  draggingTile?.from === "board"
                    ? { row: draggingTile.row, col: draggingTile.col }
                    : null
                }
                onBoardTilePickup={handleBoardTilePickup}
                onBoardDragUpdate={handleBoardDragUpdate}
                onBoardTileDrop={handleBoardTileDrop}
                getDraggableTileCell={getDraggableTileCell}
                onBoardTap={handleBoardTap}
                disableOverlayInteractions={
                  draggingTile?.from === "rack" || swapAnimating
                }
              />
              {showScrabbleBanner && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scrabbleBanner,
                    {
                      opacity: scrabbleBannerOpacity,
                      transform: [{ scale: scrabbleBannerScale }],
                    },
                  ]}
                >
                  <Text style={styles.scrabbleBannerTitle}>Scrabble!</Text>
                  <Text style={styles.scrabbleBannerScore}>+50</Text>
                </Animated.View>
              )}
            </View>

            <View style={styles.bottomSection}>
              <View style={styles.tilesSection}>
                <TileRack
                  tiles={visibleRackTiles}
                  isSwapMode={game.isSwapMode}
                  interactionsDisabled={swapAnimating}
                  swapMultiplier={game.swapCount + 1}
                  onMeasureLayout={updateRackLayout}
                  tileAnimationStates={rackTileAnimationStates}
                  shuffleTrigger={shuffleTrigger}
                  clearedRackIndices={clearedRackIndices}
                  onClearReturnAnimationComplete={
                    handleClearReturnAnimationComplete
                  }
                  draggingRackIndex={
                    draggingTile?.from === "rack" ? draggingTile.index : null
                  }
                  draggingVisibleIndex={
                    draggingTile?.from === "rack"
                      ? draggingTile.visibleIndex
                      : null
                  }
                  predictedInsertionIndex={
                    draggingTile?.from === "rack" ? dropTargetRackIndex : null
                  }
                  rackPlaceholderIndex={
                    draggingTile?.from === "board" ? dropTargetRackIndex : null
                  }
                  onDragStart={handleRackDragStart}
                  onDragUpdate={handleRackDragUpdate}
                  onDrop={handleTileDrop}
                  onTilePress={
                    game.isSwapMode && !swapAnimating
                      ? game.selectTile
                      : undefined
                  }
                  swapSelectedIndices={
                    game.isSwapMode && !swapAnimating ? game.selectedTiles : []
                  }
                />
                {game.isSwapMode && game.tilesRemaining < 7 && (
                  <Text style={styles.swapHint}>
                    You can only swap {game.tilesRemaining} tiles
                  </Text>
                )}
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[
                      styles.controlButtonNarrow,
                      game.isSwapMode && styles.controlButtonSwapActive,
                      swapAnimating && styles.controlButtonDisabled,
                    ]}
                    onPress={handleSwapButtonPress}
                    accessibilityLabel={
                      game.isSwapMode ? "Confirm swap" : "Swap tiles"
                    }
                    delayPressIn={0}
                    activeOpacity={0.6}
                  >
                    {Platform.OS === "ios" ? (
                      <SFSymbol
                        name="arrow.down.left.arrow.up.right.square"
                        size={CONTROL_ICON_SIZE}
                        color="#fff"
                        weight="medium"
                        scale="medium"
                        style={styles.controlIcon}
                      />
                    ) : (
                      <Text style={styles.controlButtonTextLarge}>
                        {game.isSwapMode ? "Confirm" : "Swap"}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      swapAnimating && styles.controlButtonDisabled,
                      game.gameOver && styles.controlButtonDisabled,
                      !game.gameOver &&
                        game.selectedCells.length === 0 &&
                        game.tilesRemaining > 0 &&
                        styles.controlButtonDisabled,
                    ]}
                    onPress={
                      swapAnimating ? undefined : handleSubmitButtonPress
                    }
                    disabled={
                      swapAnimating ||
                      game.gameOver ||
                      (game.tilesRemaining > 0 &&
                        game.selectedCells.length === 0)
                    }
                  >
                    <Text style={styles.controlButtonText}>
                      {game.gameOver
                        ? "Game Over"
                        : game.tilesRemaining === 0 &&
                          game.selectedCells.length === 0
                        ? "Finish!"
                        : "Submit"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.controlButtonNarrow,
                      swapAnimating && styles.controlButtonDisabled,
                    ]}
                    onPress={() => {
                      if (swapAnimating) return;
                      if (game.selectedCells.length > 0) {
                        const indices = game.selectedCells
                          .map(
                            ({ row, col }) => game.board[row]?.[col]?.rackIndex
                          )
                          .filter((r) => r != null);
                        setClearedRackIndices(indices);
                        game.clearSelection();
                      } else {
                        setShuffleTrigger((c) => c + 1);
                        game.shuffleRack();
                      }
                    }}
                    accessibilityLabel={
                      game.selectedCells.length > 0
                        ? "Clear selection"
                        : "Shuffle rack"
                    }
                    delayPressIn={0}
                    activeOpacity={0.6}
                  >
                    {game.selectedCells.length > 0 ? (
                      Platform.OS === "ios" ? (
                        <SFSymbol
                          name="arrow.uturn.down.square"
                          size={CONTROL_ICON_SIZE}
                          color="#fff"
                          weight="medium"
                          scale="medium"
                          style={styles.controlIcon}
                        />
                      ) : (
                        <Text style={styles.controlButtonTextLarge}>Clear</Text>
                      )
                    ) : Platform.OS === "ios" ? (
                      <SFSymbol
                        name="shuffle"
                        size={CONTROL_ICON_SIZE}
                        color="#fff"
                        weight="medium"
                        scale="medium"
                        style={styles.controlIcon}
                      />
                    ) : (
                      <Text style={styles.controlButtonText}>Shuffle</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.launchContainer}>
            <Text style={styles.launchTitle}>Words With Real Friends</Text>
            <Text style={styles.launchSubtitle}>
              Start a daily run, a random board, or jump into a specific seed.
            </Text>
          </View>
        )}

        <MenuScreen
          visible={menuVisible}
          canDismiss={gameStarted}
          currentSeed={game.currentSeed}
          dailySeed={dailySeed}
          overallHighScore={scoreRecords.overallHighScore}
          dailyHighScore={currentDailyHighScore}
          onClose={() => setMenuVisible(false)}
          onDailyGame={handleDailyGameStart}
          onNewGameRandom={handleRandomGameStart}
          onNewGameWithSeed={(seed) =>
            startGameWithSeed(seed, { isDaily: false })
          }
          onResetSeed={handleResetSeed}
        />
        <MessageOverlay
          message={game.message}
          onClose={() => game.setMessage(null)}
        />
        <LetterPickerModal
          visible={pendingBlankPlacement != null}
          onChooseLetter={(letter) => {
            if (pendingBlankPlacement) {
              game.placeTileOnBoard(
                pendingBlankPlacement.tileIndex,
                pendingBlankPlacement.row,
                pendingBlankPlacement.col,
                letter
              );
              setPendingBlankPlacement(null);
            }
          }}
          onCancel={() => setPendingBlankPlacement(null)}
        />
        <EndGameModal
          visible={endGameSummary != null}
          summary={endGameSummary}
          onClose={() => setEndGameSummary(null)}
        />
        {(draggingTile || settlingTile) && (
          <View style={styles.dragOverlayContainer} pointerEvents="none">
            {draggingTile && !settlingTile && (
              <Animated.View
                style={[
                  styles.dragOverlay,
                  {
                    transform: [
                      { translateX: dragPosition.x },
                      { translateY: dragPosition.y },
                      { scale: dragScale },
                    ],
                  },
                ]}
              >
                <View style={[styles.dragTile, styles.dragTileLifted]}>
                  <Text
                    style={[
                      styles.dragTileLetter,
                      (draggingTile.tile.letter === " " ||
                        draggingTile.tile.letter === "") &&
                        styles.dragTileLetterBlank,
                    ]}
                  >
                    {draggingTile.tile.letter === " " ||
                    draggingTile.tile.letter === ""
                      ? " "
                      : draggingTile.tile.letter}
                  </Text>
                  {draggingTile.tile.value > 0 && (
                    <Text style={styles.dragTileValue}>
                      {draggingTile.tile.value}
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}
            {settlingTile && (
              <Animated.View
                style={[
                  styles.dragOverlay,
                  {
                    transform: [
                      { translateX: settlePosition.x },
                      { translateY: settlePosition.y },
                      { scale: settleScale },
                    ],
                  },
                ]}
              >
                <View style={styles.dragTile}>
                  <Text
                    style={[
                      styles.dragTileLetter,
                      (settlingTile.letter === " " ||
                        settlingTile.letter === "") &&
                        styles.dragTileLetterBlank,
                    ]}
                  >
                    {settlingTile.letter === " " || settlingTile.letter === ""
                      ? " "
                      : settlingTile.letter}
                  </Text>
                  {settlingTile.value > 0 && (
                    <Text style={styles.dragTileValue}>
                      {settlingTile.value}
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
  },
  spinner: {
    width: 50,
    height: 50,
    borderWidth: 4,
    borderColor: "rgba(102, 126, 234, 0.3)",
    borderTopColor: "#667eea",
    borderRadius: 25,
    marginBottom: 20,
  },
  loadingText: {
    color: "#667eea",
    fontSize: 16,
  },
  gameContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
  },
  launchContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#f8f4ed",
  },
  launchTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#2c3e50",
    textAlign: "center",
  },
  launchSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 320,
  },
  /** Top: full-width panel with grey background, menu button + game info */
  topPanel: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    backgroundColor: "#f5f6f7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  menuButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  menuButtonIcon: {
    width: 24,
    height: 24,
  },
  menuButtonText: {
    fontSize: 24,
    color: "#2c3e50",
  },
  /** Score section: below top panel, centered, larger font */
  scoreSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7f8c8d",
    marginTop: -2,
    marginBottom: 8,
  },
  /** Board: fills available space, aligned to top to sit close to score */
  boardSection: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "center",
    minHeight: 0,
  },
  scrabbleBanner: {
    position: "absolute",
    top: "18%",
    width: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  scrabbleBannerTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    color: "#d62828",
  },
  scrabbleBannerScore: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: "#d62828",
  },
  /** Bottom strip: tiles + controls */
  bottomSection: {
    width: "100%",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  tilesSection: {
    width: "100%",
    alignItems: "center",
  },
  swapHint: {
    marginTop: 6,
    fontSize: 13,
    color: "#2980b9",
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    marginTop: 8,
    width: "100%",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "#667eea",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  controlButtonNarrow: {
    flex: 1 / 3,
    backgroundColor: "#667eea",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonSwapActive: {
    backgroundColor: "#2980b9",
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  controlButtonTextLarge: {
    color: "white",
    fontWeight: "600",
    fontSize: 18,
  },
  controlIcon: {
    width: CONTROL_ICON_SIZE,
    height: CONTROL_ICON_SIZE,
  },
  dragOverlayContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  dragOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 42,
    height: 42,
  },
  dragTile: {
    width: 42,
    height: 42,
    backgroundColor: "#f5ebe0",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#667eea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  dragTileLifted: {
    opacity: 0.6,
  },
  dragTileLetter: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  dragTileLetterBlank: {
    color: "transparent",
    opacity: 0,
  },
  dragTileValue: {
    position: "absolute",
    top: 2,
    right: 3,
    fontSize: 9,
    color: "#7f8c8d",
  },
});

export default App;
