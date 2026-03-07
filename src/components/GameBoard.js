import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Platform, Easing } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';

const MIN_ZOOM = 1;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.010;
const BOARD_BORDER = 2;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_SIZE = 15;
// Board background border: 4px on each side
const BOARD_PADDING = 6;
// Base cell size; tiles are 2px smaller (TILE_SIZE), spacing increased to keep board size same
const BASE_CELL_MARGIN = 0.5;
const CELL_SIZE = Math.min(
    (SCREEN_WIDTH - 40 - (BOARD_SIZE - 1) * 2 * BASE_CELL_MARGIN - 2 * BOARD_PADDING) / BOARD_SIZE,
    35
);
const TILE_SIZE = CELL_SIZE - 2;

const TILE_GRADIENT_HEIGHT_PX = Math.max(1, Math.floor(TILE_SIZE * 0.5));
// Spacing between tiles; board size is then computed from content so it exactly encapsulates
const CELL_MARGIN = 1.5;
const ANDROID_GESTURE_PIPELINE_V2 =
    Platform.OS === 'android' && global.__ANDROID_GESTURE_PIPELINE_V2__ !== false;
const OVERLAY_PAN_MIN_DISTANCE = 0;

const CELL_SIZE_EFFECTIVE = TILE_SIZE + 2 * CELL_MARGIN;
const BOARD_INDICES = Array.from({ length: BOARD_SIZE }, (_, index) => index);

const GameBoard = ({ board, selectedCells, premiumSquares, onCellClick, BOARD_SIZE, boardLayoutRef, optimisticPlacement, dragSourceCell, settlingBoardTile = null, onBoardTilePickup, onBoardDragUpdate, onBoardTileDrop, getDraggableTileCell, onBoardTap, disableOverlayInteractions = false, allowEmptyCellPress = false, submitScorePreview = null, submitScorePreviewCell = null }) => {
    const boardViewRef = useRef(null);
    const zoomWrapperRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    // Pan as Animated.ValueXY so updates run on native driver (no re-render per frame = smooth)
    const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const panCurrentRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });
    const twoTouchStart = useRef(null); // { centerX, centerY, initialMaxDist, zoom, panX, panY } when active
    const pinchStartRef = useRef(null); // { zoom, panX, panY, focalX, focalY }
    const draggingTileFromOverlayRef = useRef(false);
    const onBoardTilePickupRef = useRef(onBoardTilePickup);
    const onBoardDragUpdateRef = useRef(onBoardDragUpdate);
    const onBoardTileDropRef = useRef(onBoardTileDrop);
    const getDraggableTileCellRef = useRef(getDraggableTileCell);
    const onBoardTapRef = useRef(onBoardTap);
    onBoardTilePickupRef.current = onBoardTilePickup;
    onBoardDragUpdateRef.current = onBoardDragUpdate;
    onBoardTileDropRef.current = onBoardTileDrop;
    getDraggableTileCellRef.current = getDraggableTileCell;
    onBoardTapRef.current = onBoardTap;

    const handleOverlayBoardPickup = useCallback((absoluteX, absoluteY) => {
        const cell = getDraggableTileCellRef.current?.(absoluteX, absoluteY);
        if (cell) {
            draggingTileFromOverlayRef.current = true;
            onBoardTilePickupRef.current?.(cell.row, cell.col, absoluteX, absoluteY);
            return true;
        }

        draggingTileFromOverlayRef.current = false;
        panStartRef.current = { x: panCurrentRef.current.x, y: panCurrentRef.current.y };
        return false;
    }, []);

    const handleOverlayBoardMove = useCallback((absoluteX, absoluteY, translationX, translationY) => {
        if (draggingTileFromOverlayRef.current) {
            onBoardDragUpdateRef.current?.(absoluteX, absoluteY);
            return;
        }

        const z = zoomRef.current;
        if (z <= 1) return;
        const next = {
            x: clampPan(panStartRef.current.x + translationX, z),
            y: clampPan(panStartRef.current.y + translationY, z),
        };
        panCurrentRef.current = next;
        panAnim.setValue(next);
    }, []);

    const handleOverlayBoardEnd = useCallback((absoluteX, absoluteY) => {
        if (draggingTileFromOverlayRef.current) {
            onBoardTileDropRef.current?.(absoluteX, absoluteY);
        } else if (zoomRef.current <= 1) {
            onBoardTapRef.current?.(absoluteX, absoluteY);
        }
        draggingTileFromOverlayRef.current = false;
    }, []);

    useEffect(() => {
        if (zoom <= 1) {
            panAnim.setValue({ x: 0, y: 0 });
            panCurrentRef.current = { x: 0, y: 0 };
        } else {
            const next = {
                x: clampPan(panCurrentRef.current.x, zoom),
                y: clampPan(panCurrentRef.current.y, zoom),
            };
            panCurrentRef.current = next;
            panAnim.setValue(next);
        }
    }, [zoom, panAnim]);

    // Board pan only (used when zoom <= 1 or as fallback; when zoomed, overlay pan handles both)
    const panGesture = useMemo(() => Gesture.Pan()
        .minPointers(1)
        .minDistance(10)
        .onStart(() => {
            panStartRef.current = { x: panCurrentRef.current.x, y: panCurrentRef.current.y };
        })
        .onUpdate((e) => {
            const z = zoomRef.current;
            if (z <= 1) return;
            const next = {
                x: clampPan(panStartRef.current.x + e.translationX, z),
                y: clampPan(panStartRef.current.y + e.translationY, z),
            };
            panCurrentRef.current = next;
            panAnim.setValue(next);
        }), [panAnim]);

    // Convert touch (pageX, pageY) to board content coords. Content origin = board view + border + padding.
    const touchToContent = useCallback((pageX, pageY) => {
        const layout = boardLayoutRef?.current;
        if (layout && typeof layout.x === 'number' && typeof layout.y === 'number') {
            const pad = zoomRef.current > 1 ? BOARD_PADDING / zoomRef.current : BOARD_PADDING;
            return {
                x: pageX - layout.x - BOARD_BORDER - pad,
                y: pageY - layout.y - BOARD_BORDER - pad,
            };
        }
        return { x: pageX, y: pageY };
    }, []);

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // Two-touch zoom: focal = bottom finger (fixed at start). Scale = longest drag from center (either finger).
    const handleTwoTouchMove = useCallback((e) => {
        const start = twoTouchStart.current;
        if (!start || !e.nativeEvent.touches || e.nativeEvent.touches.length < 2) return;
        const t0 = e.nativeEvent.touches[0];
        const t1 = e.nativeEvent.touches[1];
        const p0 = touchToContent(t0.pageX, t0.pageY);
        const p1 = touchToContent(t1.pageX, t1.pageY);
        const center = start.center;
        const d0 = dist(p0, center);
        const d1 = dist(p1, center);
        const currentMaxDist = Math.max(d0, d1);
        if (start.initialMaxDist <= 0) return;
        const scale = currentMaxDist / start.initialMaxDist;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * scale));
        const C = GRID_SIZE / 2;
        // Keep focal (bottom finger at start) fixed: pan_new = pan_old + (focal - C)*(z_old - z_new)
        const panX = start.panX + (start.focalX - C) * (start.zoom - newZoom);
        const panY = start.panY + (start.focalY - C) * (start.zoom - newZoom);
        const clampedX = clampPan(panX, newZoom);
        const clampedY = clampPan(panY, newZoom);
        panCurrentRef.current = { x: clampedX, y: clampedY };
        panAnim.setValue({ x: clampedX, y: clampedY });
        setZoom(newZoom);
    }, [touchToContent, panAnim]);

    const handleTwoTouchGrant = useCallback((e) => {
        if (!e.nativeEvent.touches || e.nativeEvent.touches.length < 2) return;
        const t0 = e.nativeEvent.touches[0];
        const t1 = e.nativeEvent.touches[1];
        const p0 = touchToContent(t0.pageX, t0.pageY);
        const p1 = touchToContent(t1.pageX, t1.pageY);
        const centerX = (p0.x + p1.x) / 2;
        const centerY = (p0.y + p1.y) / 2;
        const center = { x: centerX, y: centerY };
        const d0 = dist(p0, center);
        const d1 = dist(p1, center);
        const initialMaxDist = Math.max(d0, d1, 1); // avoid 0
        const pan = panCurrentRef.current;
        const bottom = p0.y >= p1.y ? p0 : p1;
        twoTouchStart.current = {
            focalX: bottom.x,
            focalY: bottom.y,
            centerX,
            centerY,
            center,
            initialMaxDist,
            zoom: zoomRef.current,
            panX: pan.x,
            panY: pan.y,
        };
    }, [touchToContent]);

    const handleTwoTouchRelease = useCallback(() => {
        twoTouchStart.current = null;
    }, []);

    const handlePinchBegin = useCallback((focalX, focalY) => {
        const focal = touchToContent(focalX, focalY);
        const pan = panCurrentRef.current;
        pinchStartRef.current = {
            zoom: zoomRef.current,
            panX: pan.x,
            panY: pan.y,
            focalX: focal.x,
            focalY: focal.y,
        };
    }, [touchToContent]);

    const handlePinchUpdate = useCallback((scale, focalX, focalY) => {
        const start = pinchStartRef.current;
        if (!start) return;
        const focal = touchToContent(focalX, focalY);
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * scale));
        const C = GRID_SIZE / 2;
        const focalXForPan = Number.isFinite(focal.x) ? focal.x : start.focalX;
        const focalYForPan = Number.isFinite(focal.y) ? focal.y : start.focalY;
        const panX = start.panX + (focalXForPan - C) * (start.zoom - nextZoom);
        const panY = start.panY + (focalYForPan - C) * (start.zoom - nextZoom);
        const clampedX = clampPan(panX, nextZoom);
        const clampedY = clampPan(panY, nextZoom);
        panCurrentRef.current = { x: clampedX, y: clampedY };
        panAnim.setValue({ x: clampedX, y: clampedY });
        setZoom(nextZoom);
    }, [panAnim, touchToContent]);

    const handlePinchEnd = useCallback(() => {
        pinchStartRef.current = null;
    }, []);

    const wantTwoTouch = useCallback((e) => e.nativeEvent.touches && e.nativeEvent.touches.length >= 2, []);
    const onMoveShouldSetResponderCapture = wantTwoTouch;
    const onMoveShouldSetResponder = wantTwoTouch;

    const onResponderGrant = useCallback((e) => {
        handleTwoTouchGrant(e);
    }, [handleTwoTouchGrant]);

    const onResponderMove = useCallback((e) => {
        handleTwoTouchMove(e);
    }, [handleTwoTouchMove]);

    const onResponderRelease = useCallback((e) => {
        if (!e.nativeEvent.touches || e.nativeEvent.touches.length < 2) {
            handleTwoTouchRelease();
        }
    }, [handleTwoTouchRelease]);

    const onResponderTerminate = useCallback(() => {
        handleTwoTouchRelease();
    }, [handleTwoTouchRelease]);

    // When zoomed: one Pan on overlay. On touch start, hit-test. If on a draggable tile → lift tile and drag it; else → board pan.
    // Refs for callbacks so gesture is stable across re-renders (pickup causes setState; recreating gesture would break active pan).
    // Keep the gesture itself on the UI thread and bridge only the JS controller callbacks that still require JS state.
    const overlayPanGesture = useMemo(() => {
        const base = Gesture.Pan()
            .minPointers(1)
            .maxPointers(1)
            .minDistance(OVERLAY_PAN_MIN_DISTANCE);

        if (ANDROID_GESTURE_PIPELINE_V2) {
            return base
                .runOnJS(true)
                .onBegin((e) => {
                    handleOverlayBoardPickup(e.absoluteX, e.absoluteY);
                })
                .onUpdate((e) => {
                    handleOverlayBoardMove(
                        e.absoluteX,
                        e.absoluteY,
                        e.translationX,
                        e.translationY
                    );
                })
                .onEnd((e) => {
                    handleOverlayBoardEnd(e.absoluteX, e.absoluteY);
                });
        }

        return base
            .runOnJS(true)
            .onBegin((e) => {
                handleOverlayBoardPickup(e.absoluteX, e.absoluteY);
            })
            .onUpdate((e) => {
                handleOverlayBoardMove(
                    e.absoluteX,
                    e.absoluteY,
                    e.translationX,
                    e.translationY
                );
            })
            .onEnd((e) => {
                handleOverlayBoardEnd(e.absoluteX, e.absoluteY);
            });
    }, [handleOverlayBoardEnd, handleOverlayBoardMove, handleOverlayBoardPickup]);

    const overlayPinchGesture = useMemo(() => {
        if (!ANDROID_GESTURE_PIPELINE_V2) return null;

        return Gesture.Pinch()
            .runOnJS(true)
            .onBegin((e) => {
                handlePinchBegin(e.focalX, e.focalY);
            })
            .onUpdate((e) => {
                handlePinchUpdate(e.scale, e.focalX, e.focalY);
            })
            .onEnd(() => {
                handlePinchEnd();
            });
    }, [handlePinchBegin, handlePinchEnd, handlePinchUpdate]);

    const overlayGesture = useMemo(() => {
        if (ANDROID_GESTURE_PIPELINE_V2 && overlayPinchGesture) {
            return Gesture.Simultaneous(overlayPanGesture, overlayPinchGesture);
        }
        return overlayPanGesture;
    }, [overlayPanGesture, overlayPinchGesture]);

    const updateGridBounds = useCallback(() => {
        if (!boardLayoutRef || !zoomWrapperRef.current) return;
        zoomWrapperRef.current.measureInWindow((lx, ly, w, h) => {
            if (boardLayoutRef.current) {
                boardLayoutRef.current.screenLeft = lx;
                boardLayoutRef.current.screenTop = ly;
                boardLayoutRef.current.screenRight = lx + w;
                boardLayoutRef.current.screenBottom = ly + h;
            }
        });
    }, [boardLayoutRef]);

    const updateBoardLayout = useCallback(() => {
        if (!boardLayoutRef || !boardViewRef.current) return;
        boardViewRef.current.measureInWindow((x, y, width, height) => {
            const z = zoomRef.current;
            const effectivePad = z <= 1 ? BOARD_PADDING : BOARD_PADDING / Math.max(1, z);
            const gridSize = BOARD_SIZE * CELL_SIZE_EFFECTIVE;
            boardLayoutRef.current = {
                x, y, width, height,
                padding: effectivePad,
                cellSize: CELL_SIZE_EFFECTIVE,
                gridSize,
                contentOriginX: effectivePad,
                contentOriginY: effectivePad,
                getZoomPan: () => ({ zoom: zoomRef.current, pan: panCurrentRef.current }),
            };
            updateGridBounds();
        });
    }, [boardLayoutRef, updateGridBounds]);

    useEffect(() => {
        if (!boardLayoutRef) return;
        updateBoardLayout();
    }, [boardLayoutRef, zoom, updateBoardLayout]);

    // Keep grid bounds current during pan (throttled)
    const lastMeasureRef = useRef(0);
    useEffect(() => {
        if (!boardLayoutRef) return;
        const throttleMs = 50;
        const listener = () => {
            const now = Date.now();
            if (now - lastMeasureRef.current >= throttleMs) {
                lastMeasureRef.current = now;
                updateGridBounds();
            }
        };
        const idX = panAnim.x.addListener(listener);
        const idY = panAnim.y.addListener(listener);
        return () => {
            panAnim.x.removeListener(idX);
            panAnim.y.removeListener(idY);
        };
    }, [boardLayoutRef, updateGridBounds, panAnim.x, panAnim.y]);

    const effectivePadding = zoom > 1 ? BOARD_PADDING / Math.max(1, zoom) : BOARD_PADDING;
    const selectedCellKeys = useMemo(
        () => new Set(selectedCells.map(({ row, col }) => `${row},${col}`)),
        [selectedCells]
    );
    const submitScorePreviewCellKey = useMemo(() => {
        if (!submitScorePreviewCell) return null;
        return `${submitScorePreviewCell.row},${submitScorePreviewCell.col}`;
    }, [submitScorePreviewCell]);

    return (
        <View
            ref={boardViewRef}
            style={[styles.board, { padding: effectivePadding }]}
            onLayout={boardLayoutRef ? updateBoardLayout : undefined}
        >
            <View style={styles.boardInner}>
                <Animated.View
                    ref={zoomWrapperRef}
                    style={[
                        styles.zoomWrapper,
                        {
                            transform: [
                                { translateX: -GRID_SIZE / 2 },
                                { translateY: -GRID_SIZE / 2 },
                                { scale: zoom },
                                { translateX: GRID_SIZE / 2 },
                                { translateY: GRID_SIZE / 2 },
                                { translateX: panAnim.x },
                                { translateY: panAnim.y },
                            ],
                        },
                    ]}
                >
                    {BOARD_INDICES.map((row) =>
                        <View key={row} style={styles.row}>
                            {BOARD_INDICES.map((col) => {
                                const cellTile = board[row][col];
                                const isOptimisticSource = optimisticPlacement?.fromRow != null && optimisticPlacement?.fromCol != null && row === optimisticPlacement.fromRow && col === optimisticPlacement.fromCol;
                                const isOptimisticTarget = optimisticPlacement && optimisticPlacement.row === row && optimisticPlacement.col === col && optimisticPlacement.renderTarget !== false;
                                const isSettlingSource = settlingBoardTile && settlingBoardTile.fromRow === row && settlingBoardTile.fromCol === col && cellTile?.id === settlingBoardTile.id;
                                const isSettlingTarget = settlingBoardTile && settlingBoardTile.row === row && settlingBoardTile.col === col && cellTile?.id === settlingBoardTile.id;
                                const optTile = isOptimisticTarget ? { letter: optimisticPlacement.letter, value: optimisticPlacement.value, isFromRack: true, rackIndex: optimisticPlacement.rackIndex } : null;
                                const tile = isOptimisticSource || isSettlingSource ? null : (cellTile ?? optTile);
                                const defaultSelected = selectedCellKeys.has(`${row},${col}`);
                                const isSelected = (isOptimisticSource || isSettlingTarget)
                                    ? false
                                    : (isOptimisticTarget ? true : defaultSelected);
                                return (
                                <BoardCell
                                    key={`${row}-${col}`}
                                    row={row}
                                    col={col}
                                    tile={tile}
                                    isSelected={isSelected}
                                    isDragSource={!!(dragSourceCell && dragSourceCell.row === row && dragSourceCell.col === col)}
                                    premium={premiumSquares[`${row},${col}`]}
                                    onBoardTilePickup={onBoardTilePickup}
                                    onBoardDragUpdate={onBoardDragUpdate}
                                    onBoardTileDrop={onBoardTileDrop}
                                    onCellClick={onCellClick}
                                    allowEmptyCellPress={allowEmptyCellPress}
                                    showSubmitScorePreview={
                                        submitScorePreview != null &&
                                        submitScorePreviewCellKey === `${row},${col}`
                                    }
                                    submitScorePreview={submitScorePreview}
                                />
                            ); })}
                        </View>
                    )}
                </Animated.View>
            </View>
            {/* Wrapper: take responder when 2 fingers (zoom); Pan has maxPointers(1) so single-touch goes to child. */}
            <View
                style={styles.panOverlay}
                pointerEvents={disableOverlayInteractions ? 'none' : 'auto'}
                onMoveShouldSetResponder={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onMoveShouldSetResponder
                }
                onMoveShouldSetResponderCapture={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onMoveShouldSetResponderCapture
                }
                onResponderGrant={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onResponderGrant
                }
                onResponderMove={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onResponderMove
                }
                onResponderRelease={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onResponderRelease
                }
                onResponderTerminate={
                    disableOverlayInteractions || ANDROID_GESTURE_PIPELINE_V2
                        ? undefined
                        : onResponderTerminate
                }
            >
                <GestureDetector gesture={overlayGesture}>
                    <View style={StyleSheet.absoluteFill} />
                </GestureDetector>
            </View>
        </View>
    );
};

// Board size from content: each cell takes TILE_SIZE + 2*CELL_MARGIN. Ceil to avoid rounding
// making the row slightly wider than the board. Add 3px extra on the right.
const boardContentWidth = BOARD_SIZE * (TILE_SIZE + 2 * CELL_MARGIN);
const BOARD_WIDTH = 2 * BOARD_PADDING + Math.ceil(boardContentWidth) + 3;
const BOARD_INNER_SIZE = BOARD_WIDTH - 2 * BOARD_PADDING;
const GRID_SIZE = BOARD_SIZE * (TILE_SIZE + 2 * CELL_MARGIN);

// Base viewport inset (border + padding). Pan viewport is adjusted by a zoom-dependent multiplier.
const PAN_VIEWPORT_INSET_BASE = (2 + BOARD_PADDING); // 12

// Inset multiplier varies continuously with zoom (1–1.75) so pinch on iPhone works at any zoom level.
function getInsetMultiplier(zoom) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    if (z <= 1.05) return -0.1;
    if (z <= 1.10) return 0.1;
    if (z <= 1.25) {
        const t = (z - 1.1) / (1.25 - 1.1);
        return 0.1 + t * (2 - 0.1);
    }
    if (z >= 1.75) return 15;
    if (z <= 1.4) {
        const t = (z - 1.25) / (1.4 - 1.25);
        return 2 + t * (4.4 - 2);
    }
    if (z <= 1.5) {
        const t = (z - 1.4) / (1.5 - 1.4);
        return 4.4 + t * (6.7 - 4.4);
    }
    if (z <= 1.6) {
        const t = (z - 1.5) / (1.6 - 1.5);
        return 6.7 + t * (9 - 6.7);
    }
    const t = (z - 1.6) / (1.75 - 1.6);
    return 11 + t * (15 - 11);
}

function clampPan(value, zoom) {
    const inset = PAN_VIEWPORT_INSET_BASE * getInsetMultiplier(zoom);
    const viewportRight = BOARD_INNER_SIZE + inset;
    const min = viewportRight - GRID_SIZE * zoom;
    const max = 0;
    return Math.min(max, Math.max(min, value));
}

const BOARD_BG_COLOR = '#e0e0e0';
const BOARD_BORDER_COLOR = '#2c3e50';

const styles = StyleSheet.create({
    board: {
        backgroundColor: BOARD_BG_COLOR,
        borderWidth: 2,
        borderColor: BOARD_BORDER_COLOR,
        padding: BOARD_PADDING,
        borderRadius: 10,
        width: BOARD_WIDTH,
        height: BOARD_WIDTH,
        alignSelf: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    boardInner: {
        width: BOARD_INNER_SIZE,
        height: BOARD_INNER_SIZE,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        overflow: 'hidden',
        borderRadius: 8,
    },
    zoomWrapper: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
    },
    row: {
        flexDirection: 'row',
    },
    cell: {
        width: TILE_SIZE,
        height: TILE_SIZE,
        backgroundColor: '#ffffff',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        margin: CELL_MARGIN,
        overflow: 'visible',
    },
    cellInner: {
        width: '100%',
        height: '100%',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tileGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: TILE_GRADIENT_HEIGHT_PX,
        borderRadius: 4,
        overflow: 'hidden',
    },
    cellOccupied: {
        backgroundColor: '#f39c12',
    },
    cellSelected: {
        backgroundColor: '#3498db',
        transform: [{ scale: 1.05 }],
        zIndex: 10,
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    premiumDW: {
        backgroundColor: '#e8a0a0', // lighter pink (Double Word)
    },
    premiumTW: {
        backgroundColor: '#c41e3a', // reddish/dark pink (Triple Word)
    },
    premiumDL: {
        backgroundColor: '#87ceeb', // light blue (Double Letter)
    },
    premiumTL: {
        backgroundColor: '#1e90ff', // cyan/dark blue (Triple Letter)
    },
    premiumCenter: {
        backgroundColor: '#e8a0a0', // same as Double Word, with star for first-turn
    },
    premiumLabel: {
        color: 'white',
        fontSize: TILE_SIZE * 0.3,
        fontWeight: '700',
    },
    tile: {
        width: '100%',
        height: '100%',
        backgroundColor: '#fff59d',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bdc3c7',
    },
    tileLetter: {
        fontSize: TILE_SIZE * 0.4 + 2,
        fontWeight: '700',
        color: '#2c3e50',
    },
    tileValue: {
        position: 'absolute',
        top: 2,
        right: 3,
        fontSize: TILE_SIZE * 0.2,
        color: '#7f8c8d',
    },
    submitScorePreviewBadge: {
        position: 'absolute',
        top: -2,
        right: -4,
        zIndex: 30,
        minWidth: 12,
        height: 10,
        borderRadius: 3,
        paddingHorizontal: 2,
        backgroundColor: '#3f3f3f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitScorePreviewText: {
        fontSize: 5,
        lineHeight: 6,
        color: '#ffffff',
        fontWeight: '700',
    },
});

const PREMIUM_LABELS = { dw: 'DW', tw: 'TW', dl: 'DL', tl: 'TL', center: '★' };

const BoardCell = React.memo(function BoardCell({
    row, col, tile, isSelected, isDragSource, premium,
    onBoardTilePickup, onBoardDragUpdate, onBoardTileDrop, onCellClick, allowEmptyCellPress,
    showSubmitScorePreview, submitScorePreview,
}) {
    const previewBadgeScale = useRef(new Animated.Value(1)).current;
    const previousPreviewValueRef = useRef(null);

    useEffect(() => {
        if (!showSubmitScorePreview || submitScorePreview == null) {
            previousPreviewValueRef.current = null;
            previewBadgeScale.setValue(1);
            return;
        }

        const shouldPulse =
            previousPreviewValueRef.current == null ||
            previousPreviewValueRef.current !== submitScorePreview;
        previousPreviewValueRef.current = submitScorePreview;

        if (!shouldPulse) return;

        previewBadgeScale.setValue(0.86);
        Animated.sequence([
            Animated.timing(previewBadgeScale, {
                toValue: 1.18,
                duration: 110,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(previewBadgeScale, {
                toValue: 1,
                duration: 120,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    }, [previewBadgeScale, showSubmitScorePreview, submitScorePreview]);

    const cellStyle = useMemo(() => [
        styles.cell,
        tile !== null && styles.cellOccupied,
        isSelected && styles.cellSelected,
        premium === 'dw' && styles.premiumDW,
        premium === 'tw' && styles.premiumTW,
        premium === 'dl' && styles.premiumDL,
        premium === 'tl' && styles.premiumTL,
        premium === 'center' && styles.premiumCenter,
    ].filter(Boolean), [tile !== null, isSelected, premium]);

    const showTileInCell = tile && !isDragSource;
    const canPickup = (tile && tile.isFromRack && !tile.scored) || isDragSource;
    const cellContent = (
        <View style={styles.cellInner}>
            {showTileInCell ? (
                <View style={styles.tile}>
                    <Text style={styles.tileLetter}>{tile.letter}</Text>
                    {showSubmitScorePreview && (
                        <Animated.View
                            style={[
                                styles.submitScorePreviewBadge,
                                { transform: [{ scale: previewBadgeScale }] },
                            ]}
                        >
                            <Text style={styles.submitScorePreviewText}>{submitScorePreview}</Text>
                        </Animated.View>
                    )}
                    {!tile.isBlank && <Text style={styles.tileValue}>{tile.value}</Text>}
                </View>
            ) : (
                premium && (
                    <Text style={styles.premiumLabel}>{PREMIUM_LABELS[premium] ?? premium}</Text>
                )
            )}
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.tileGradient}
            />
        </View>
    );

    if (canPickup) {
        return (
            <View
                style={cellStyle}
                onStartShouldSetResponder={() => true}
                onTouchStart={(e) => {
                    if (!(tile && tile.isFromRack && !tile.scored) || !onBoardTilePickup) return;
                    const { pageX, pageY } = e.nativeEvent;
                    onBoardTilePickup(row, col, pageX, pageY);
                }}
                onResponderMove={(e) => {
                    if (onBoardDragUpdate) {
                        const { pageX, pageY } = e.nativeEvent;
                        onBoardDragUpdate(pageX, pageY);
                    }
                }}
                onResponderRelease={(e) => {
                    const { pageX, pageY } = e.nativeEvent;
                    if (onBoardTileDrop && canPickup) onBoardTileDrop(pageX, pageY);
                    else if (tile && onCellClick) onCellClick(row, col);
                }}
            >
                {cellContent}
            </View>
        );
    }
    return (
        <TouchableOpacity
            style={cellStyle}
            onPress={() => {
                if ((tile || allowEmptyCellPress) && onCellClick) onCellClick(row, col);
            }}
            activeOpacity={0.3}
            disabled={!tile && !allowEmptyCellPress}
        >
            {cellContent}
        </TouchableOpacity>
    );
});

export default React.memo(GameBoard);
