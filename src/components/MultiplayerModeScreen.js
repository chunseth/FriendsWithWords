import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SFSymbolIcon from "./SFSymbolIcon";
import GameBoard from "./GameBoard";
import TileRack from "./TileRack";
import MessageOverlay from "./MessageOverlay";
import LetterPickerModal from "./LetterPickerModal";
import InGameMenu from "./InGameMenu";
import { useAsyncCoopSession } from "../hooks/useAsyncCoopSession";
import { useTileDragDropController } from "../hooks/useTileDragDropController";
import { buildResolvedSubmitPayload } from "../game/shared/turnResolution";
import { validateSubmitTurn } from "../game/shared/validation";
import { BLANK_LETTER } from "../game/shared/bag";
import { dictionary } from "../utils/dictionary";
import { markSessionSeen, upsertPresence } from "../services/multiplayerInboxService";
import { setSessionReminderMute } from "../services/multiplayerNotificationSettingsService";
import { trackMultiplayerEvent } from "../services/analyticsService";

const DRAG_TILE_HALF_SIZE = 21;
const BOARD_SIZE = 15;
const CONTROL_ICON_SIZE = 22;
const RACK_INSERT_LIFT = 20;
const RACK_INSERT_DURATION = 120;
const RACK_INSERT_STEP_DELAY = 70;
const REMOTE_UPDATE_BANNER_IN_DURATION = 180;
const REMOTE_UPDATE_BANNER_VISIBLE_DURATION = 1700;
const REMOTE_UPDATE_BANNER_OUT_DURATION = 220;
const SCORE_STEP_DURATION = 85;
const REMOTE_BOARD_REVEAL_STEP_DURATION = 260;
const REMOTE_SCORE_DELAY =
  REMOTE_UPDATE_BANNER_IN_DURATION +
  REMOTE_UPDATE_BANNER_VISIBLE_DURATION +
  REMOTE_UPDATE_BANNER_OUT_DURATION;

const AnimatedScoreDisplay = React.memo(function AnimatedScoreDisplay({
  totalScore,
  remoteUpdateEventId,
}) {
  const [displayScore, setDisplayScore] = useState(totalScore ?? 0);
  const [pendingScoreDelta, setPendingScoreDelta] = useState(0);
  const scoreAnimationTimeoutRef = useRef(null);
  const scoreDelayTimeoutRef = useRef(null);
  const scoreInitializedRef = useRef(false);
  const displayScoreRef = useRef(totalScore ?? 0);
  const deferNextScoreAnimationRef = useRef(false);
  const lastRemoteEventIdRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scoreAnimationTimeoutRef.current) {
        clearTimeout(scoreAnimationTimeoutRef.current);
      }
      if (scoreDelayTimeoutRef.current) {
        clearTimeout(scoreDelayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      remoteUpdateEventId &&
      remoteUpdateEventId !== lastRemoteEventIdRef.current
    ) {
      lastRemoteEventIdRef.current = remoteUpdateEventId;
      deferNextScoreAnimationRef.current = true;
    }
  }, [remoteUpdateEventId]);

  const startScoreAnimation = useCallback((targetScore) => {
    const startingScore = displayScoreRef.current;
    const totalDelta = targetScore - startingScore;

    if (totalDelta === 0) {
      displayScoreRef.current = targetScore;
      setDisplayScore(targetScore);
      setPendingScoreDelta(0);
      return;
    }

    setPendingScoreDelta(totalDelta);

    let nextScore = startingScore;
    let remainingDelta = totalDelta;

    const tick = () => {
      const direction = remainingDelta > 0 ? 1 : -1;
      nextScore += direction;
      remainingDelta -= direction;
      displayScoreRef.current = nextScore;
      setDisplayScore(nextScore);
      setPendingScoreDelta(remainingDelta);

      if (remainingDelta === 0) {
        scoreAnimationTimeoutRef.current = null;
        return;
      }

      scoreAnimationTimeoutRef.current = setTimeout(tick, SCORE_STEP_DURATION);
    };

    scoreAnimationTimeoutRef.current = setTimeout(tick, SCORE_STEP_DURATION);
  }, []);

  useEffect(() => {
    const targetScore = totalScore ?? 0;

    if (scoreAnimationTimeoutRef.current) {
      clearTimeout(scoreAnimationTimeoutRef.current);
      scoreAnimationTimeoutRef.current = null;
    }
    if (scoreDelayTimeoutRef.current) {
      clearTimeout(scoreDelayTimeoutRef.current);
      scoreDelayTimeoutRef.current = null;
    }

    if (!scoreInitializedRef.current) {
      scoreInitializedRef.current = true;
      displayScoreRef.current = targetScore;
      setDisplayScore(targetScore);
      setPendingScoreDelta(0);
      return undefined;
    }

    if (deferNextScoreAnimationRef.current) {
      deferNextScoreAnimationRef.current = false;
      setPendingScoreDelta(0);
      scoreDelayTimeoutRef.current = setTimeout(() => {
        scoreDelayTimeoutRef.current = null;
        startScoreAnimation(targetScore);
      }, REMOTE_SCORE_DELAY);
      return undefined;
    }

    startScoreAnimation(targetScore);

    return () => {
      if (scoreAnimationTimeoutRef.current) {
        clearTimeout(scoreAnimationTimeoutRef.current);
        scoreAnimationTimeoutRef.current = null;
      }
      if (scoreDelayTimeoutRef.current) {
        clearTimeout(scoreDelayTimeoutRef.current);
        scoreDelayTimeoutRef.current = null;
      }
    };
  }, [startScoreAnimation, totalScore]);

  return (
    <View style={styles.scoreSection}>
      <View style={styles.scoreValueRow}>
        <Text style={styles.scoreValue}>{displayScore}</Text>
        {pendingScoreDelta !== 0 ? (
          <Text
            style={[
              styles.scoreDelta,
              pendingScoreDelta > 0
                ? styles.scoreDeltaPositive
                : styles.scoreDeltaNegative,
            ]}
          >
            {`${pendingScoreDelta > 0 ? "+" : "-"}${Math.abs(
              pendingScoreDelta
            )}`}
          </Text>
        ) : null}
      </View>
      <Text style={styles.scoreLabel}>Score</Text>
    </View>
  );
});

const WaitingRackDisplay = React.memo(function WaitingRackDisplay({
  tiles,
  tileAnimationStates,
}) {
  return (
    <View style={styles.waitingRackSection}>
      <TileRack
        tiles={tiles}
        interactionsDisabled
        onMeasureLayout={undefined}
        onDragStart={undefined}
        onDragUpdate={undefined}
        onDrop={undefined}
        shuffleTrigger={0}
        clearedRackTileIds={[]}
        onClearReturnAnimationComplete={undefined}
        tileAnimationStates={tileAnimationStates}
      />
    </View>
  );
});

const MultiplayerModeScreen = ({
  onBack = null,
  sessionId = "local-multiplayer-prototype",
  onSessionCompleted = null,
}) => {
  const screenInstanceIdRef = useRef(
    `screen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const {
    session,
    localPlayerId,
    localPlayer,
    activePlayer,
    canLocalPlayerAct,
    remoteUpdateEvent,
    submitResolvedPlay,
    submitSwapTurn,
    passTurn,
  } = useAsyncCoopSession({ sessionId });

  const containerRef = useRef(null);
  const boardLayoutRef = useRef(null);
  const boardAtTurnStartRef = useRef(null);

  const [draftBoard, setDraftBoard] = useState(session.sharedBoard);
  const [draftRack, setDraftRack] = useState(localPlayer?.rack ?? []);
  const [waitingRack, setWaitingRack] = useState(
    session.players.find((player) => player.id !== localPlayerId)?.rack ?? []
  );
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [message, setMessage] = useState(null);
  const [pendingBlankPlacement, setPendingBlankPlacement] = useState(null);
  const [clearedRackTileIds, setClearedRackTileIds] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rackTileAnimationStates, setRackTileAnimationStates] = useState({});
  const [waitingRackTileAnimationStates, setWaitingRackTileAnimationStates] =
    useState({});
  const [isSubmitAnimating, setIsSubmitAnimating] = useState(false);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [remoteUpdateBannerText, setRemoteUpdateBannerText] = useState("");
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictDraft, setConflictDraft] = useState(null);
  const rackTileAnimationsRef = useRef({});
  const waitingRackTileAnimationsRef = useRef({});
  const waitingRackRef = useRef(waitingRack);
  const draftBoardRef = useRef(draftBoard);
  const lastAnimatedWaitingRackEventIdRef = useRef(null);
  const lastHandledRemotePlayEventIdRef = useRef(null);
  const completionEventHandledRef = useRef(null);
  const remoteUpdateBannerOpacity = useRef(new Animated.Value(0)).current;
  const remoteUpdateBannerTranslateY = useRef(new Animated.Value(-10)).current;

  const cloneBoard = useCallback(
    (board) => (board ?? []).map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    []
  );
  const cloneRack = useCallback((rack) => (rack ?? []).map((tile) => ({ ...tile })), []);

  const captureConflictDraft = useCallback(
    (intent, options = {}) => {
      const payload = {
        intent,
        draftBoard: cloneBoard(draftBoard),
        draftRack: cloneRack(draftRack),
        selectedCells: [...selectedCells],
        selectedTiles: [...selectedTiles],
        createdAt: Date.now(),
        ...options,
      };
      setConflictDraft(payload);
      return payload;
    },
    [cloneBoard, cloneRack, draftBoard, draftRack, selectedCells, selectedTiles]
  );

  const openConflictModal = useCallback(() => {
    setConflictModalVisible(true);
  }, []);

  useEffect(() => {
    console.log("[multiplayer-lifecycle] MultiplayerModeScreen mounted", {
      screenInstanceId: screenInstanceIdRef.current,
      sessionId,
    });

    return () => {
      console.log("[multiplayer-lifecycle] MultiplayerModeScreen unmounted", {
        screenInstanceId: screenInstanceIdRef.current,
        sessionId,
      });
    };
  }, [sessionId]);

  useEffect(() => {
    dictionary.load();
  }, []);

  useEffect(() => {
    void upsertPresence({
      status: "online",
      lastSessionId: session.sessionId ?? sessionId,
    });

    return () => {
      void upsertPresence({
        status: "away",
        lastSessionId: session.sessionId ?? sessionId,
      });
    };
  }, [session.sessionId, sessionId]);

  useEffect(() => {
    if (!session?.sessionId) {
      return;
    }

    void markSessionSeen({
      sessionId: session.sessionId,
      seenRevision: session.boardRevision ?? 0,
    });
  }, [session.boardRevision, session.sessionId]);

  useEffect(() => {
    if (
      session.status !== "completed" ||
      typeof session.sharedScore.finalScore !== "number"
    ) {
      return;
    }

    const completionKey = `${session.sessionId}:${session.savedAt}:${session.sharedScore.finalScore}`;
    if (completionEventHandledRef.current === completionKey) {
      return;
    }
    completionEventHandledRef.current = completionKey;

    onSessionCompleted?.({
      sessionId: session.sessionId,
      seed: session.seed,
      isDailySeed: session.isDailySeed === true,
      finalScore: session.sharedScore.finalScore,
      finalScoreBreakdown: {
        pointsEarned: session.sharedScore.wordPointsTotal ?? 0,
        swapPenalties: session.sharedScore.swapPenaltyTotal ?? 0,
        turnPenalties: session.sharedScore.turnPenaltyTotal ?? 0,
        rackPenalty: session.sharedScore.rackPenaltyTotal ?? 0,
        scrabbleBonus: session.sharedScore.scrabbleBonusTotal ?? 0,
        timeBonus: 0,
        perfectionBonus: 0,
        consistencyBonusTotal: session.sharedScore.consistencyBonusTotal ?? 0,
        skillBonusTotal:
          (session.sharedScore.scrabbleBonusTotal ?? 0) +
          (session.sharedScore.consistencyBonusTotal ?? 0),
        finalScore: session.sharedScore.finalScore,
      },
    });
  }, [
    onSessionCompleted,
    session.isDailySeed,
    session.savedAt,
    session.seed,
    session.sessionId,
    session.sharedScore.finalScore,
    session.sharedScore.rackPenaltyTotal,
    session.sharedScore.scrabbleBonusTotal,
    session.sharedScore.consistencyBonusTotal,
    session.sharedScore.swapPenaltyTotal,
    session.sharedScore.turnPenaltyTotal,
    session.sharedScore.wordPointsTotal,
    session.status,
  ]);

  useEffect(() => {
    waitingRackRef.current = waitingRack;
  }, [waitingRack]);

  useEffect(() => {
    draftBoardRef.current = draftBoard;
  }, [draftBoard]);

  useEffect(() => {
    if (!remoteUpdateEvent?.id) {
      return undefined;
    }

    if (remoteUpdateEvent.action === "conflict") {
      void trackMultiplayerEvent("mp_turn_conflict", {
        sessionId: session.sessionId,
        source: "remote_event",
      });
      openConflictModal();
    }

    const leadWord =
      Array.isArray(remoteUpdateEvent.words) &&
      remoteUpdateEvent.words.length > 0 &&
      remoteUpdateEvent.words[0]?.word
        ? ` ${String(remoteUpdateEvent.words[0].word).toUpperCase()}`
        : "";
    const actionText =
      remoteUpdateEvent.action === "play"
        ? `played${leadWord}`
        : remoteUpdateEvent.action === "swap"
          ? "swapped tiles"
          : remoteUpdateEvent.action === "pass"
            ? "passed"
            : "finished a turn";

    setRemoteUpdateBannerText(
      `${remoteUpdateEvent.actorLabel} ${actionText}`
    );
    remoteUpdateBannerOpacity.stopAnimation();
    remoteUpdateBannerTranslateY.stopAnimation();
    remoteUpdateBannerOpacity.setValue(0);
    remoteUpdateBannerTranslateY.setValue(-10);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(remoteUpdateBannerOpacity, {
          toValue: 1,
          duration: REMOTE_UPDATE_BANNER_IN_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(remoteUpdateBannerTranslateY, {
          toValue: 0,
          duration: REMOTE_UPDATE_BANNER_IN_DURATION,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(REMOTE_UPDATE_BANNER_VISIBLE_DURATION),
      Animated.parallel([
        Animated.timing(remoteUpdateBannerOpacity, {
          toValue: 0,
          duration: REMOTE_UPDATE_BANNER_OUT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(remoteUpdateBannerTranslateY, {
          toValue: -10,
          duration: REMOTE_UPDATE_BANNER_OUT_DURATION,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    openConflictModal,
    remoteUpdateBannerOpacity,
    remoteUpdateBannerTranslateY,
    remoteUpdateEvent,
    session.sessionId,
  ]);

  useEffect(() => {
    const targetWaitingRack =
      session.players.find((player) => player.id !== localPlayerId)?.rack ?? [];
    const isUnanimatedRemotePlay =
      remoteUpdateEvent?.action === "play" &&
      !!remoteUpdateEvent.id &&
      remoteUpdateEvent.id !== lastHandledRemotePlayEventIdRef.current;

    if (!isUnanimatedRemotePlay) {
      setDraftBoard(session.sharedBoard.map((row) => [...row]));
      setWaitingRack(targetWaitingRack.map((tile, rackIndex) => ({
        ...tile,
        rackIndex,
      })));
    }
    setDraftRack((localPlayer?.rack ?? []).map((tile, rackIndex) => ({
      ...tile,
      rackIndex,
    })));
    setSelectedCells([]);
    setSelectedTiles([]);
    setIsSwapMode(false);
    setPendingBlankPlacement(null);
    boardAtTurnStartRef.current = session.sharedBoard.map((row) =>
      row.map((cell) => cell !== null)
    );
  }, [
    localPlayer,
    localPlayerId,
    remoteUpdateEvent?.action,
    remoteUpdateEvent?.id,
    session.boardRevision,
    session.sharedBoard,
    session.players,
    session.turn.activePlayerId,
  ]);

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

  const syncWaitingRackTileAnimationStates = useCallback(() => {
    setWaitingRackTileAnimationStates(
      Object.fromEntries(
        Object.entries(waitingRackTileAnimationsRef.current).map(
          ([tileId, state]) => [tileId, { ...state }]
        )
      )
    );
  }, []);

  const ensureTileAnimationState = useCallback((animationRef, tileId) => {
    if (!animationRef.current[tileId]) {
      animationRef.current[tileId] = {
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(1),
        scoreOpacity: new Animated.Value(0),
        scoreTranslateY: new Animated.Value(0),
        scoreScale: new Animated.Value(1),
        multiplierOpacity: new Animated.Value(0),
        multiplierScale: new Animated.Value(0.85),
        scoreText: null,
        multiplierText: null,
      };
    }

    return animationRef.current[tileId];
  }, []);

  const ensureRackTileAnimationState = useCallback(
    (tileId) => ensureTileAnimationState(rackTileAnimationsRef, tileId),
    [ensureTileAnimationState]
  );

  const ensureWaitingRackTileAnimationState = useCallback(
    (tileId) => ensureTileAnimationState(waitingRackTileAnimationsRef, tileId),
    [ensureTileAnimationState]
  );

  const clearRackTileAnimationState = useCallback(
    (tileId) => {
      delete rackTileAnimationsRef.current[tileId];
      syncRackTileAnimationStates();
    },
    [syncRackTileAnimationStates]
  );

  const clearWaitingRackTileAnimationState = useCallback(
    (tileId) => {
      delete waitingRackTileAnimationsRef.current[tileId];
      syncWaitingRackTileAnimationStates();
    },
    [syncWaitingRackTileAnimationStates]
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

  const resetTileAnimationState = useCallback((animationState) => {
    animationState.translateY.setValue(0);
    animationState.opacity.setValue(1);
    animationState.scoreOpacity.setValue(0);
    animationState.scoreTranslateY.setValue(0);
    animationState.scoreScale.setValue(1);
    animationState.multiplierOpacity.setValue(0);
    animationState.multiplierScale.setValue(0.85);
    animationState.scoreText = null;
    animationState.multiplierText = null;
  }, []);

  const animateRackInsertSequenceForTarget = useCallback(
    async ({
      tilesToInsert,
      ensureAnimationState,
      clearAnimationState,
      syncAnimationStates,
      appendTile,
    }) => {
      for (const tile of tilesToInsert) {
        const animationState = ensureAnimationState(tile.id);
        resetTileAnimationState(animationState);
        animationState.translateY.setValue(-RACK_INSERT_LIFT);
        animationState.opacity.setValue(0);
        syncAnimationStates();

        appendTile(tile);
        await waitForNextFrame();
        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: 0,
            duration: RACK_INSERT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 1,
            duration: RACK_INSERT_DURATION,
            useNativeDriver: true,
          }),
        ]);
        clearAnimationState(tile.id);
        await wait(RACK_INSERT_STEP_DELAY);
      }
    },
    [resetTileAnimationState, runParallel, wait, waitForNextFrame]
  );

  const animateRackRemovalSequenceForTarget = useCallback(
    async ({
      tilesToRemove,
      ensureAnimationState,
      clearAnimationState,
      syncAnimationStates,
      removeTile,
    }) => {
      for (const tile of tilesToRemove) {
        const animationState = ensureAnimationState(tile.id);
        resetTileAnimationState(animationState);
        syncAnimationStates();

        await runParallel([
          Animated.timing(animationState.translateY, {
            toValue: -RACK_INSERT_LIFT,
            duration: RACK_INSERT_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.opacity, {
            toValue: 0,
            duration: RACK_INSERT_DURATION,
            useNativeDriver: true,
          }),
        ]);
        removeTile(tile.id);
        clearAnimationState(tile.id);
        await waitForNextFrame();
        await wait(RACK_INSERT_STEP_DELAY);
      }
    },
    [resetTileAnimationState, runParallel, wait, waitForNextFrame]
  );

  const animateRackInsertSequence = useCallback(
    async (tilesToInsert) => {
      await animateRackInsertSequenceForTarget({
        tilesToInsert,
        ensureAnimationState: ensureRackTileAnimationState,
        clearAnimationState: clearRackTileAnimationState,
        syncAnimationStates: syncRackTileAnimationStates,
        appendTile: (tile) => {
          setDraftRack((prev) => [...prev, tile]);
        },
      });
    },
    [
      animateRackInsertSequenceForTarget,
      clearRackTileAnimationState,
      ensureRackTileAnimationState,
      syncRackTileAnimationStates,
    ]
  );

  const targetWaitingRack = useMemo(
    () =>
      (
        session.players.find((player) => player.id !== localPlayerId)?.rack ?? []
      ).map((tile, rackIndex) => ({
        ...tile,
        rackIndex,
      })),
    [localPlayerId, session.players]
  );

  const waitingRackTiles = useMemo(
    () =>
      waitingRack.map((tile, rackIndex) => ({
        ...tile,
        rackIndex,
        visibleIndex: rackIndex,
      })),
    [waitingRack]
  );

  useEffect(() => {
    const remoteEventId = remoteUpdateEvent?.id ?? null;
    if (
      remoteUpdateEvent?.action !== "play" ||
      !remoteEventId ||
      remoteEventId === lastHandledRemotePlayEventIdRef.current
    ) {
      return undefined;
    }

    lastHandledRemotePlayEventIdRef.current = remoteEventId;

    const currentBoard = draftBoardRef.current;
    const currentRack = waitingRackRef.current;
    const targetBoard = session.sharedBoard.map((row) => [...row]);
    const targetRack = targetWaitingRack;
    const targetTileIds = new Set(targetRack.map((tile) => tile.id));
    const currentTileIds = new Set(currentRack.map((tile) => tile.id));
    const tilesToRemove = currentRack.filter((tile) => !targetTileIds.has(tile.id));
    const tilesToInsert = targetRack.filter((tile) => !currentTileIds.has(tile.id));
    const placedTiles = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const previousCell = currentBoard[row]?.[col] ?? null;
        const nextCell = targetBoard[row]?.[col] ?? null;
        if (
          previousCell == null &&
          nextCell != null &&
          nextCell.ownerId !== localPlayerId
        ) {
          placedTiles.push({ row, col, tile: nextCell });
        }
      }
    }

    let cancelled = false;

    const animateRemotePlaySequence = async () => {
      if (tilesToRemove.length > 0) {
        await animateRackRemovalSequenceForTarget({
          tilesToRemove,
          ensureAnimationState: ensureWaitingRackTileAnimationState,
          clearAnimationState: clearWaitingRackTileAnimationState,
          syncAnimationStates: syncWaitingRackTileAnimationStates,
          removeTile: (tileId) => {
            setWaitingRack((prev) => prev.filter((tile) => tile.id !== tileId));
          },
        });
      }

      if (cancelled) {
        return;
      }

      if (placedTiles.length > 0) {
        setDraftBoard(currentBoard.map((row) => [...row]));
        for (const placedTile of placedTiles) {
          setDraftBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[placedTile.row][placedTile.col] = placedTile.tile;
            return next;
          });
          await wait(REMOTE_BOARD_REVEAL_STEP_DURATION);
          if (cancelled) {
            return;
          }
        }
      } else {
        setDraftBoard(targetBoard);
      }

      if (cancelled) {
        return;
      }

      const carriedTiles = targetRack.filter((tile) => currentTileIds.has(tile.id));
      setWaitingRack(
        carriedTiles.map((tile, rackIndex) => ({
          ...tile,
          rackIndex,
        }))
      );
      await waitForNextFrame();

      if (cancelled) {
        return;
      }

      if (tilesToInsert.length > 0) {
        await animateRackInsertSequenceForTarget({
          tilesToInsert,
          ensureAnimationState: ensureWaitingRackTileAnimationState,
          clearAnimationState: clearWaitingRackTileAnimationState,
          syncAnimationStates: syncWaitingRackTileAnimationStates,
          appendTile: (tile) => {
            setWaitingRack((prev) => [
              ...prev,
              {
                ...tile,
                rackIndex: prev.length,
              },
            ]);
          },
        });
      }

      if (!cancelled) {
        setDraftBoard(targetBoard);
        setWaitingRack(targetRack);
      }
    };

    void animateRemotePlaySequence();

    return () => {
      cancelled = true;
    };
  }, [
    animateRackInsertSequenceForTarget,
    animateRackRemovalSequenceForTarget,
    clearWaitingRackTileAnimationState,
    ensureWaitingRackTileAnimationState,
    localPlayerId,
    remoteUpdateEvent?.action,
    remoteUpdateEvent?.id,
    session.sharedBoard,
    syncWaitingRackTileAnimationStates,
    targetWaitingRack,
    wait,
    waitForNextFrame,
  ]);

  useEffect(() => {
    const currentRack = waitingRackRef.current;
    const targetRack = targetWaitingRack;
    const isPendingRemotePlay =
      remoteUpdateEvent?.action === "play" &&
      !!remoteUpdateEvent.id &&
      remoteUpdateEvent.id === lastHandledRemotePlayEventIdRef.current;

    if (isPendingRemotePlay) {
      return undefined;
    }

    const isNewRemoteEvent =
      remoteUpdateEvent?.id &&
      remoteUpdateEvent.id !== lastAnimatedWaitingRackEventIdRef.current;

    if (!isNewRemoteEvent) {
      setWaitingRack(targetRack);
      return undefined;
    }

    lastAnimatedWaitingRackEventIdRef.current = remoteUpdateEvent.id;

    const targetTileIds = new Set(targetRack.map((tile) => tile.id));
    const currentTileIds = new Set(currentRack.map((tile) => tile.id));
    const tilesToRemove = currentRack.filter((tile) => !targetTileIds.has(tile.id));
    const tilesToInsert = targetRack.filter((tile) => !currentTileIds.has(tile.id));

    if (tilesToRemove.length === 0 && tilesToInsert.length === 0) {
      setWaitingRack(targetRack);
      return undefined;
    }

    let cancelled = false;

    const animateWaitingRackUpdate = async () => {
      if (tilesToRemove.length > 0) {
        await animateRackRemovalSequenceForTarget({
          tilesToRemove,
          ensureAnimationState: ensureWaitingRackTileAnimationState,
          clearAnimationState: clearWaitingRackTileAnimationState,
          syncAnimationStates: syncWaitingRackTileAnimationStates,
          removeTile: (tileId) => {
            setWaitingRack((prev) => prev.filter((tile) => tile.id !== tileId));
          },
        });
      }

      if (cancelled) {
        return;
      }

      const carriedTiles = targetRack.filter((tile) => currentTileIds.has(tile.id));
      setWaitingRack(
        carriedTiles.map((tile, rackIndex) => ({
          ...tile,
          rackIndex,
        }))
      );
      await waitForNextFrame();

      if (cancelled) {
        return;
      }

      await animateRackInsertSequenceForTarget({
        tilesToInsert,
        ensureAnimationState: ensureWaitingRackTileAnimationState,
        clearAnimationState: clearWaitingRackTileAnimationState,
        syncAnimationStates: syncWaitingRackTileAnimationStates,
        appendTile: (tile) => {
          setWaitingRack((prev) => [
            ...prev,
            {
              ...tile,
              rackIndex: prev.length,
            },
          ]);
        },
      });

      if (!cancelled) {
        setWaitingRack(targetRack);
      }
    };

    void animateWaitingRackUpdate();

    return () => {
      cancelled = true;
    };
  }, [
    animateRackInsertSequenceForTarget,
    animateRackRemovalSequenceForTarget,
    clearWaitingRackTileAnimationState,
    ensureWaitingRackTileAnimationState,
    remoteUpdateEvent?.id,
    syncWaitingRackTileAnimationStates,
    targetWaitingRack,
    waitForNextFrame,
  ]);

  const usedIndices = useMemo(() => {
    const next = new Set();
    const usedIds = new Set();
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const tile = draftBoard[row]?.[col];
        if (
          tile?.isFromRack &&
          !tile.scored &&
          tile.rackIndex !== undefined &&
          tile.ownerId === localPlayerId
        ) {
          next.add(tile.rackIndex);
          if (tile.id != null) {
            usedIds.add(tile.id);
          }
        }
      }
    }
    return { indices: next, ids: usedIds };
  }, [draftBoard, localPlayerId]);

  const isBlankRackTile = useCallback(
    (tile) =>
      tile &&
      tile.value === 0 &&
      (tile.letter === BLANK_LETTER || tile.letter === ""),
    []
  );

  const reorderRack = useCallback((fromIndex, toIndex, releasedIndex = null) => {
    setDraftRack((prev) => {
      const activeUsedIndices = new Set();
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          const tile = draftBoard[row][col];
          if (
            tile?.isFromRack &&
            !tile.scored &&
            tile.rackIndex !== undefined &&
            tile.ownerId === localPlayerId
          ) {
            activeUsedIndices.add(tile.rackIndex);
          }
        }
      }
      if (releasedIndex != null) {
        activeUsedIndices.delete(releasedIndex);
      }

      const visibleIndices = prev
        .map((_, index) => index)
        .filter((index) => !activeUsedIndices.has(index));
      const fromVisibleIndex = visibleIndices.indexOf(fromIndex);
      const clampedToIndex = Math.max(
        0,
        Math.min(toIndex, visibleIndices.length - 1)
      );
      if (fromVisibleIndex === -1 || fromVisibleIndex === clampedToIndex) {
        return prev;
      }

      const reorderedVisibleTiles = visibleIndices.map((index) => prev[index]);
      const [removed] = reorderedVisibleTiles.splice(fromVisibleIndex, 1);
      reorderedVisibleTiles.splice(clampedToIndex, 0, removed);

      const next = [...prev];
      visibleIndices.forEach((index, visibleIndex) => {
        next[index] = reorderedVisibleTiles[visibleIndex];
      });
      return next;
    });
  }, [draftBoard, localPlayerId]);

  const placeTileOnBoard = useCallback(
    (tileIndex, row, col, chosenLetter = null) => {
      if (!canLocalPlayerAct) return;
      if (tileIndex == null || tileIndex < 0 || tileIndex >= draftRack.length) {
        return;
      }
      if (draftBoard[row][col] !== null) return;

      const tile = draftRack[tileIndex];
      if (!tile) return;

      setDraftBoard((prev) => {
        const next = prev.map((draftRow) => [...draftRow]);
        const isBlank = isBlankRackTile(tile);
        next[row][col] = {
          ...tile,
          letter: isBlank ? chosenLetter?.toUpperCase?.() ?? tile.letter : tile.letter,
          value: isBlank ? 0 : tile.value,
          isBlank,
          rackIndex: tileIndex,
          isFromRack: true,
          ownerId: localPlayerId,
        };
        return next;
      });
      setSelectedCells((prev) => [...prev, { row, col }]);
    },
    [canLocalPlayerAct, draftBoard, draftRack, isBlankRackTile, localPlayerId]
  );

  const removeTileFromBoard = useCallback((row, col) => {
    setDraftBoard((prev) => {
      const next = prev.map((draftRow) => [...draftRow]);
      const tile = next[row][col];
      if (!tile || tile.scored || tile.ownerId !== localPlayerId) {
        return prev;
      }
      next[row][col] = null;
      return next;
    });
    setSelectedCells((prev) =>
      prev.filter((cell) => !(cell.row === row && cell.col === col))
    );
  }, [localPlayerId]);

  const moveTileOnBoard = useCallback((fromRow, fromCol, toRow, toCol) => {
    if (fromRow === toRow && fromCol === toCol) return;
    setDraftBoard((prev) => {
      const next = prev.map((draftRow) => [...draftRow]);
      const tile = next[fromRow][fromCol];
      if (
        !tile ||
        tile.scored ||
        tile.ownerId !== localPlayerId ||
        next[toRow][toCol] !== null
      ) {
        return prev;
      }
      next[fromRow][fromCol] = null;
      next[toRow][toCol] = { ...tile };
      return next;
    });
    setSelectedCells((prev) => {
      const withoutSource = prev.filter(
        (cell) => !(cell.row === fromRow && cell.col === fromCol)
      );
      return [...withoutSource, { row: toRow, col: toCol }];
    });
  }, [localPlayerId]);

  const handleCellClick = useCallback((row, col) => {
    const tile = draftBoard[row]?.[col];
    if (!tile || tile.scored || tile.ownerId !== localPlayerId) return;
    setSelectedCells((prev) => {
      const existingIndex = prev.findIndex(
        (cell) => cell.row === row && cell.col === col
      );
      if (existingIndex >= 0) {
        return prev.filter((_, index) => index !== existingIndex);
      }
      return [...prev, { row, col }];
    });
  }, [draftBoard, localPlayerId]);

  const clearSelection = useCallback(() => {
    selectedCells.forEach(({ row, col }) => removeTileFromBoard(row, col));
    setSelectedCells([]);
  }, [removeTileFromBoard, selectedCells]);

  const shuffleRack = useCallback(() => {
    setDraftRack((prev) => {
      const visibleIndices = prev
        .map((_, index) => index)
        .filter((index) => !usedIndices.indices.has(index));
      const visibleTiles = visibleIndices.map((index) => prev[index]);
      const shuffled = [...visibleTiles].sort(() => Math.random() - 0.5);
      const next = [...prev];
      visibleIndices.forEach((index, visibleIndex) => {
        next[index] = shuffled[visibleIndex];
      });
      return next;
    });
  }, [usedIndices]);

  const isDraftRackTileUsed = useCallback(
    (tile, index) =>
      usedIndices.ids.has(tile?.id) || usedIndices.indices.has(index),
    [usedIndices]
  );

  const isDraftBoardTileDraggable = useCallback(
    (tile) =>
      !!(
        tile &&
        tile.isFromRack &&
        tile.ownerId === localPlayerId &&
        tile.rackIndex !== undefined &&
        !tile.scored
      ),
    [localPlayerId]
  );

  const getDraftRackTileByIndex = useCallback(
    (index) => draftRack[index] ?? null,
    [draftRack]
  );

  const getDraftRackIndexByTileId = useCallback(
    (tileId) => draftRack.findIndex((tile) => tile?.id === tileId),
    [draftRack]
  );

  const handleBlankPlacementRequest = useCallback((tileIndex, row, col) => {
    setPendingBlankPlacement({ tileIndex, row, col });
  }, []);

  const {
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
  } = useTileDragDropController({
    containerRef,
    boardLayoutRef,
    rackTiles: draftRack,
    isRackTileUsed: isDraftRackTileUsed,
    board: draftBoard,
    boardSize: BOARD_SIZE,
    canInteract: canLocalPlayerAct && !isSubmitAnimating && !isSwapMode,
    isBoardTileDraggable: isDraftBoardTileDraggable,
    isBlankRackTile,
    getRackTileByIndex: getDraftRackTileByIndex,
    getRackIndexByTileId: getDraftRackIndexByTileId,
    onPlaceRackTile: placeTileOnBoard,
    onMoveBoardTile: moveTileOnBoard,
    onRemoveBoardTile: removeTileFromBoard,
    onReorderRack: reorderRack,
    onBoardCellTap: handleCellClick,
    onBlankPlacementRequested: handleBlankPlacementRequest,
  });

  useEffect(() => {
    resetController();
  }, [resetController, session.boardRevision, session.turn.activePlayerId]);

  const handleSubmit = useCallback(async () => {
    if (!canLocalPlayerAct || isSubmitAnimating) return;
    const validation = validateSubmitTurn({
      board: draftBoard,
      isFirstTurn: session.sharedBoard.every((row) => row.every((cell) => cell == null)),
      boardAtTurnStart: boardAtTurnStartRef.current,
      dictionary,
      boardSize: BOARD_SIZE,
    });

    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }

    const payload = buildResolvedSubmitPayload({
      board: draftBoard,
      tileRack: draftRack,
      tileBag: session.bag.tiles ?? [],
      nextTileId: session.bag.nextTileId ?? 0,
      premiumSquares: session.sharedPremiumSquares,
      turnCount: session.turn.number - 1,
      placedCells: validation.placedCells,
      words: validation.words,
      newWords: validation.newWords,
      drawOwnerId: localPlayerId,
    });

    setDraftBoard((prev) => {
      const next = prev.map((row) => [...row]);
      validation.placedCells.forEach(({ row, col }) => {
        const tile = next[row]?.[col];
        if (tile) {
          next[row][col] = { ...tile, scored: true };
        }
      });
      return next;
    });
    setSelectedCells([]);
    captureConflictDraft("play", {
      selectedCells: [...validation.placedCells],
      selectedTiles: [],
    });

    if (payload.drawnTiles.length === 0) {
      setDraftRack(payload.remainingRack);
      const result = await submitResolvedPlay(payload);
      if (!result?.ok) {
        await trackMultiplayerEvent("mp_turn_conflict", {
          sessionId: session.sessionId,
          source: "submit_without_animation",
          reason: result?.reason ?? "unknown",
        });
        if (result?.reason === "revision_conflict") {
          openConflictModal();
        } else {
          setMessage({
            title: "Submit Turn",
            text:
              result?.reason === "not_active_player"
                ? "It's no longer your turn."
                : result?.reason === "session_not_active"
                  ? "This multiplayer run is no longer active."
                  : "Could not submit turn right now.",
          });
        }
      }
      return;
    }

    setIsSubmitAnimating(true);
    setDraftRack(payload.remainingRack);

    try {
      await animateRackInsertSequence(payload.drawnTiles);
      const result = await submitResolvedPlay(payload);
      if (!result?.ok) {
        await trackMultiplayerEvent("mp_turn_conflict", {
          sessionId: session.sessionId,
          source: "submit_with_animation",
          reason: result?.reason ?? "unknown",
        });
        if (result?.reason === "revision_conflict") {
          openConflictModal();
        } else {
          setMessage({
            title: "Submit Turn",
            text:
              result?.reason === "not_active_player"
                ? "It's no longer your turn."
                : result?.reason === "session_not_active"
                  ? "This multiplayer run is no longer active."
                  : "Could not submit turn right now.",
          });
        }
      }
      await waitForNextFrame();
    } finally {
      rackTileAnimationsRef.current = {};
      setRackTileAnimationStates({});
      setIsSubmitAnimating(false);
    }
  }, [
    animateRackInsertSequence,
    canLocalPlayerAct,
    draftBoard,
    draftRack,
    isSubmitAnimating,
    localPlayerId,
    session.bag.nextTileId,
    session.bag.tiles,
    session.sharedBoard,
    session.sharedPremiumSquares,
    session.turn.number,
    submitResolvedPlay,
    captureConflictDraft,
    openConflictModal,
    waitForNextFrame,
  ]);

  const swapMultiplier =
    session.players.reduce(
      (total, player) => total + (player?.contribution?.swapsUsed ?? 0),
      0
    ) + 1;

  const handleSwapTilePress = useCallback(
    (rackIndex) => {
      if (!isSwapMode) {
        return;
      }

      setSelectedTiles((prev) =>
        prev.includes(rackIndex)
          ? prev.filter((index) => index !== rackIndex)
          : [...prev, rackIndex]
      );
    },
    [isSwapMode]
  );

  const handleSwapButtonPress = useCallback(async () => {
    if (!canLocalPlayerAct || isSubmitAnimating) {
      return;
    }

    if (!isSwapMode) {
      clearSelection();
      setSelectedTiles([]);
      if ((session.bag.remainingCount ?? 0) === 0) {
        setMessage({ title: "Swap Tiles", text: "The bag is empty." });
        return;
      }
      setIsSwapMode(true);
      return;
    }

    if (selectedTiles.length === 0) {
      setIsSwapMode(false);
      return;
    }

    captureConflictDraft("swap");
    const result = await Promise.resolve(
      submitSwapTurn({ selectedRackIndices: selectedTiles })
    );
      if (!result?.ok) {
      await trackMultiplayerEvent("mp_turn_conflict", {
        sessionId: session.sessionId,
        source: "swap",
        reason: result?.reason ?? "unknown",
      });
      setMessage({
        title: "Swap Tiles",
        text:
          result?.reason === "no_tiles_selected"
            ? "Choose at least one tile to swap."
          : result?.reason === "bag_empty"
            ? "The bag is empty."
            : result?.reason === "revision_conflict"
              ? "Session updated on another device. Your draft was not applied."
              : result?.reason === "not_active_player"
                ? "It's no longer your turn."
                : result?.reason === "session_not_active"
                  ? "This multiplayer run is no longer active."
                  : "Could not swap tiles right now.",
      });
      if (result?.reason === "revision_conflict") {
        openConflictModal();
      }
      return;
    }

    setSelectedTiles([]);
    setIsSwapMode(false);
  }, [
    canLocalPlayerAct,
    clearSelection,
    isSubmitAnimating,
    isSwapMode,
    selectedTiles,
    session.bag.remainingCount,
    submitSwapTurn,
    captureConflictDraft,
    openConflictModal,
  ]);

  const handlePassButtonPress = useCallback(async () => {
    if (!canLocalPlayerAct || isSubmitAnimating) {
      return;
    }

    if (isSwapMode) {
      setSelectedTiles([]);
      setIsSwapMode(false);
    }
    if (selectedCells.length > 0) {
      clearSelection();
    }

    captureConflictDraft("pass");
    const result = await passTurn();
    if (!result?.ok) {
      await trackMultiplayerEvent("mp_turn_conflict", {
        sessionId: session.sessionId,
        source: "pass",
        reason: result?.reason ?? "unknown",
      });
      setMessage({
        title: "Pass Turn",
        text:
          result?.reason === "revision_conflict"
            ? "Session updated on another device. Your draft was not applied."
            : result?.reason === "not_active_player"
              ? "It's no longer your turn."
              : result?.reason === "session_not_active"
                ? "This multiplayer run is no longer active."
                : "Could not pass your turn right now.",
      });
      if (result?.reason === "revision_conflict") {
        openConflictModal();
      }
    }
  }, [
    canLocalPlayerAct,
    clearSelection,
    isSubmitAnimating,
    isSwapMode,
    passTurn,
    selectedCells.length,
    captureConflictDraft,
    openConflictModal,
  ]);

  const handleReplayConflictDraft = useCallback(async () => {
    if (!conflictDraft) {
      setConflictModalVisible(false);
      return;
    }
    await trackMultiplayerEvent("mp_conflict_replay_attempted", {
      sessionId: session.sessionId,
      intent: conflictDraft.intent,
    });

    if (session.status !== "active") {
      await trackMultiplayerEvent("mp_conflict_replay_failed", {
        sessionId: session.sessionId,
        reason: "session_not_active",
      });
      setConflictModalVisible(false);
      setMessage({
        title: "Draft Replay",
        text: "Replay unavailable because this session is no longer active.",
      });
      return;
    }

    if (!canLocalPlayerAct) {
      await trackMultiplayerEvent("mp_conflict_replay_failed", {
        sessionId: session.sessionId,
        reason: "not_active_player",
      });
      setConflictModalVisible(false);
      setMessage({
        title: "Draft Replay",
        text: "Replay unavailable because it is no longer your turn.",
      });
      return;
    }

    if (conflictDraft.intent === "swap") {
      setSelectedTiles(conflictDraft.selectedTiles ?? []);
      setIsSwapMode(true);
      setConflictModalVisible(false);
      await trackMultiplayerEvent("mp_conflict_replay_applied", {
        sessionId: session.sessionId,
        intent: "swap",
      });
      return;
    }

    if (conflictDraft.intent === "pass") {
      const result = await passTurn();
      setConflictModalVisible(false);
      if (!result?.ok) {
        await trackMultiplayerEvent("mp_conflict_replay_failed", {
          sessionId: session.sessionId,
          reason: result?.reason ?? "unknown",
        });
        setMessage({
          title: "Pass Turn",
          text: "Could not replay the pass action right now.",
        });
        return;
      }
      await trackMultiplayerEvent("mp_conflict_replay_applied", {
        sessionId: session.sessionId,
        intent: "pass",
      });
      return;
    }

    const replayCells = conflictDraft.selectedCells ?? [];
    const boardHasConflict = replayCells.some(({ row, col }) => {
      const liveCell = session.sharedBoard?.[row]?.[col] ?? null;
      return liveCell != null;
    });

    if (boardHasConflict) {
      await trackMultiplayerEvent("mp_conflict_replay_failed", {
        sessionId: session.sessionId,
        reason: "draft_invalidated",
      });
      setConflictModalVisible(false);
      setMessage({
        title: "Draft Replay",
        text: "Replay failed because one or more draft cells are now occupied.",
      });
      return;
    }

    setDraftBoard(cloneBoard(conflictDraft.draftBoard));
    setDraftRack(cloneRack(conflictDraft.draftRack));
    setSelectedCells([...replayCells]);
    setIsSwapMode(false);
    setSelectedTiles([]);
    setConflictModalVisible(false);
    await trackMultiplayerEvent("mp_conflict_replay_applied", {
      sessionId: session.sessionId,
      intent: "play",
    });
  }, [
    canLocalPlayerAct,
    cloneBoard,
    cloneRack,
    conflictDraft,
    passTurn,
    session.sessionId,
    session.sharedBoard,
    session.status,
  ]);

  const applySessionMute = useCallback(
    async (hours) => {
      const mutedUntil =
        hours == null
          ? null
          : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const result = await setSessionReminderMute({
        sessionId: session.sessionId,
        mutedUntil,
      });
      if (!result.ok) {
        setMessage({
          title: "Notification Mute",
          text: "Could not update reminder mute right now.",
        });
        return;
      }

      setMessage({
        title: "Notification Mute",
        text:
          hours == null
            ? "Reminders enabled for this session."
            : `Reminders muted for ${hours} hour${hours === 1 ? "" : "s"}.`,
      });
    },
    [session.sessionId]
  );

  const handleChooseBlankLetter = useCallback(
    (letter) => {
      if (!pendingBlankPlacement) return;
      placeTileOnBoard(
        pendingBlankPlacement.tileIndex,
        pendingBlankPlacement.row,
        pendingBlankPlacement.col,
        letter
      );
      setPendingBlankPlacement(null);
    },
    [pendingBlankPlacement, placeTileOnBoard]
  );

  const activeTurnName = activePlayer?.username
    ? `@${activePlayer.username}`
    : activePlayer?.displayName ?? "Player";
  const activeTurnLabel = activeTurnName.endsWith("s")
    ? `${activeTurnName}' Turn`
    : `${activeTurnName}'s Turn`;
  const turnStateLabel =
    session.status === "completed"
      ? "Completed"
      : canLocalPlayerAct
        ? "Your turn"
        : "Waiting";

  return (
    <SafeAreaView
      ref={containerRef}
      style={styles.safeArea}
      onLayout={refreshContainerWindowPosition}
    >
      <View style={styles.gameContainer}>
        <View style={styles.topPanel}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="Open menu"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {Platform.OS === "ios" ? (
              <SFSymbolIcon
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

          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{activeTurnLabel}</Text>
                <Text style={styles.infoValue}>{turnStateLabel}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Turn</Text>
                <Text style={styles.infoValue}>{session.turn.number}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tiles</Text>
                <Text style={styles.infoValue}>{session.bag.remainingCount}</Text>
              </View>
            </View>
          </View>
        </View>

        <AnimatedScoreDisplay
          totalScore={
            session.sharedScore.finalScore ?? session.sharedScore.total ?? 0
          }
          remoteUpdateEventId={remoteUpdateEvent?.id ?? null}
        />

        {session.status === "completed" ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerTitle}>Game complete</Text>
            <Text style={styles.completedBannerText}>
              Final score {session.sharedScore.finalScore ?? 0}
            </Text>
          </View>
        ) : null}
        {session.status === "active" ? (
          <View style={styles.sessionMuteRow}>
            <Text style={styles.sessionMuteLabel}>Reminders:</Text>
            <TouchableOpacity
              style={styles.sessionMuteChip}
              onPress={() => {
                void applySessionMute(12);
              }}
            >
              <Text style={styles.sessionMuteChipText}>12h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sessionMuteChip}
              onPress={() => {
                void applySessionMute(24);
              }}
            >
              <Text style={styles.sessionMuteChipText}>24h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sessionMuteChip}
              onPress={() => {
                void applySessionMute(72);
              }}
            >
              <Text style={styles.sessionMuteChipText}>3d</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sessionMuteChip}
              onPress={() => {
                void applySessionMute(null);
              }}
            >
              <Text style={styles.sessionMuteChipText}>Unmute</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.boardSection}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.remoteUpdateBannerOverlay,
              {
                opacity: remoteUpdateBannerOpacity,
                transform: [{ translateY: remoteUpdateBannerTranslateY }],
              },
            ]}
          >
            <View style={styles.remoteUpdateBanner}>
              <Text style={styles.remoteUpdateBannerText}>
                {remoteUpdateBannerText}
              </Text>
            </View>
          </Animated.View>
          {isSwapMode ? (
            <View pointerEvents="none" style={styles.swapModeBannerOverlay}>
              <View style={styles.remoteUpdateBanner}>
                <Text style={styles.remoteUpdateBannerText}>
                  {selectedTiles.length > 0
                    ? "Tap Swap again to confirm the selected tiles."
                    : "Tap the tiles you want to swap out."}
                </Text>
              </View>
            </View>
          ) : null}
          <GameBoard
            board={draftBoard}
            selectedCells={selectedCells}
            premiumSquares={session.sharedPremiumSquares}
            onCellClick={handleCellClick}
            BOARD_SIZE={BOARD_SIZE}
            boardLayoutRef={boardLayoutRef}
            optimisticPlacement={optimisticPlacement}
            dragSourceCell={
              draggingTile?.from === "board"
                ? { row: draggingTile.row, col: draggingTile.col }
                : null
            }
            settlingBoardTile={
              settlingTile?.destination === "board" ? settlingTile : null
            }
            onBoardTilePickup={handleBoardTilePickup}
            onBoardDragUpdate={handleBoardDragUpdate}
            onBoardTileDrop={handleBoardTileDrop}
            getDraggableTileCell={getDraggableTileCell}
            onBoardTap={handleBoardTap}
            disableOverlayInteractions={
              !canLocalPlayerAct ||
              isSubmitAnimating ||
              draggingTile?.from === "rack"
            }
          />
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.tilesSection}>
            <WaitingRackDisplay
              tiles={waitingRackTiles}
              tileAnimationStates={waitingRackTileAnimationStates}
            />

            <TileRack
              tiles={visibleRackTiles}
              interactionsDisabled={!canLocalPlayerAct || isSubmitAnimating}
              onMeasureLayout={updateRackLayout}
              onDragStart={handleRackDragStart}
              onDragUpdate={handleRackDragUpdate}
              onDrop={handleTileDrop}
              onTilePress={isSwapMode ? handleSwapTilePress : undefined}
              swapSelectedIndices={selectedTiles}
              draggingRackIndex={
                draggingTile?.from === "rack" ? draggingTile.index : null
              }
              draggingTileId={
                draggingTile?.from === "rack"
                  ? draggingTile.tile?.id ?? null
                  : null
              }
              draggingVisibleIndex={
                draggingTile?.from === "rack" ? draggingTile.visibleIndex : null
              }
              draggingVisibleIndexValue={rackDraggingVisibleIndexValue}
              predictedInsertionIndex={
                draggingTile?.from === "rack" &&
                draggingTile?.settlingDestination !== "rack"
                  ? dropTargetRackIndex
                  : null
              }
              hoverIndexValue={rackHoverIndexValue}
              rackPlaceholderIndex={
                draggingTile?.from === "board" &&
                draggingTile?.settlingDestination !== "rack"
                  ? boardHoverRackIndex
                  : null
              }
              rackPlaceholderIndexValue={boardRackPlaceholderIndexValue}
              showBoardPlaceholder={
                draggingTile?.from === "board" &&
                draggingTile?.settlingDestination !== "rack"
              }
              settlingRackPlaceholderIndex={
                settlingTile?.destination === "rack"
                  ? settlingTile.slotIndex
                  : null
              }
              settlingRackSlotCount={
                settlingTile?.destination === "rack"
                  ? settlingTile.slotCount
                  : null
              }
              settlingRackTileId={
                settlingTile?.destination === "rack"
                  ? settlingTile.id
                  : null
              }
              settlingRackOrder={
                settlingTile?.destination === "rack"
                  ? settlingTile.visibleRackOrder
                  : null
              }
              shuffleTrigger={0}
              clearedRackTileIds={clearedRackTileIds}
              onClearReturnAnimationComplete={() => setClearedRackTileIds([])}
              tileAnimationStates={rackTileAnimationStates}
              isSwapMode={isSwapMode}
              swapMultiplier={swapMultiplier}
            />

            <View style={styles.controls}>
              <TouchableOpacity
                style={[
                  styles.controlButtonNarrow,
                  (!canLocalPlayerAct || isSubmitAnimating) &&
                    styles.controlButtonDisabled,
                ]}
                disabled={!canLocalPlayerAct || isSubmitAnimating}
                onPress={handleSwapButtonPress}
                accessibilityLabel="Swap tiles"
              >
                {Platform.OS === "ios" ? (
                  <SFSymbolIcon
                    name="arrow.down.left.arrow.up.right.square"
                    size={CONTROL_ICON_SIZE}
                    color="#fff"
                    weight="medium"
                    scale="medium"
                    style={styles.controlIcon}
                  />
                ) : (
                  <Text style={styles.controlButtonTextLarge}>Swap</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlButtonNarrow,
                  (!canLocalPlayerAct || isSubmitAnimating) &&
                    styles.controlButtonDisabled,
                ]}
                disabled={!canLocalPlayerAct || isSubmitAnimating}
                onPress={handlePassButtonPress}
                accessibilityLabel="Pass turn"
              >
                <Text style={styles.controlButtonTextLarge}>Pass</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlButton,
                  session.status === "completed" && styles.controlButtonDisabled,
                  !canLocalPlayerAct && styles.controlButtonDisabled,
                  isSubmitAnimating && styles.controlButtonDisabled,
                  selectedCells.length === 0 && styles.controlButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={
                  session.status === "completed" ||
                  !canLocalPlayerAct ||
                  isSubmitAnimating ||
                  selectedCells.length === 0
                }
              >
                <Text style={styles.controlButtonText}>Submit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlButtonNarrow,
                  !canLocalPlayerAct && styles.controlButtonDisabled,
                  isSubmitAnimating && styles.controlButtonDisabled,
                ]}
                disabled={!canLocalPlayerAct || isSubmitAnimating}
                onPress={() => {
                  if (selectedCells.length > 0) {
                    const tileIds = selectedCells
                      .map(({ row, col }) => draftBoard[row]?.[col]?.id)
                      .filter((id) => id != null);
                    setClearedRackTileIds(tileIds);
                    clearSelection();
                  } else {
                    shuffleRack();
                  }
                }}
                accessibilityLabel={
                  selectedCells.length > 0 ? "Clear selection" : "Shuffle rack"
                }
              >
                {selectedCells.length > 0 ? (
                  Platform.OS === "ios" ? (
                    <SFSymbolIcon
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
                  <SFSymbolIcon
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

      <LetterPickerModal
        visible={pendingBlankPlacement != null}
        onChooseLetter={handleChooseBlankLetter}
        onCancel={() => setPendingBlankPlacement(null)}
      />
      <MessageOverlay message={message} onClose={() => setMessage(null)} />
      <Modal
        visible={conflictModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConflictModalVisible(false)}
      >
        <View style={styles.conflictOverlay}>
          <View style={styles.conflictCard}>
            <Text style={styles.conflictTitle}>Session Updated</Text>
            <Text style={styles.conflictText}>
              Session updated on another device. Your draft was not applied.
            </Text>
            <View style={styles.conflictActions}>
              <TouchableOpacity
                style={styles.conflictActionSecondary}
                onPress={() => setConflictModalVisible(false)}
              >
                <Text style={styles.conflictActionSecondaryText}>Discard Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.conflictActionPrimary}
                onPress={() => {
                  void handleReplayConflictDraft();
                }}
              >
                <Text style={styles.conflictActionPrimaryText}>Replay Draft</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <InGameMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onOpenPlayMenu={() => setMenuVisible(false)}
        onReturnToMainMenu={() => {
          setMenuVisible(false);
          onBack?.();
        }}
      />

      <View style={styles.dragOverlayContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.dragOverlay,
            {
              opacity: draggingTile ? 1 : 0,
              transform: [
                { translateX: dragPosition.x },
                { translateY: dragPosition.y },
                { scale: dragScale },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.dragTile,
              draggingTile?.settlingDestination === "rack"
                ? null
                : styles.dragTileLifted,
            ]}
          >
            <Text
              style={[
                styles.dragTileLetter,
                (draggingTile?.tile.letter === " " ||
                  draggingTile?.tile.letter === "") &&
                  styles.dragTileLetterBlank,
              ]}
            >
              {draggingTile?.tile.letter === " " ||
              draggingTile?.tile.letter === ""
                ? " "
                : draggingTile?.tile.letter ?? " "}
            </Text>
            {(draggingTile?.tile.value ?? 0) > 0 ? (
              <Text style={styles.dragTileValue}>{draggingTile?.tile.value}</Text>
            ) : null}
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.dragOverlay,
            {
              opacity: settlingTile && !draggingTile ? 1 : 0,
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
                (settlingTile?.letter === " " ||
                  settlingTile?.letter === "") &&
                  styles.dragTileLetterBlank,
              ]}
            >
              {settlingTile?.letter === " " || settlingTile?.letter === ""
                ? " "
                : settlingTile?.letter ?? " "}
            </Text>
            {(settlingTile?.value ?? 0) > 0 ? (
              <Text style={styles.dragTileValue}>{settlingTile?.value}</Text>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  gameContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
  },
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
  infoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7f8c8d",
  },
  infoValue: {
    color: "#2c3e50",
    fontSize: 14,
    fontWeight: "700",
  },
  completedBanner: {
    marginTop: 10,
    marginHorizontal: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#fff7e8",
    borderWidth: 1,
    borderColor: "#e8c98a",
  },
  completedBannerTitle: {
    color: "#9a6b2f",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  completedBannerText: {
    marginTop: 4,
    color: "#5a5248",
    fontSize: 16,
    fontWeight: "700",
  },
  sessionMuteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    flexWrap: "wrap",
  },
  sessionMuteLabel: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "700",
    marginRight: 4,
  },
  sessionMuteChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sessionMuteChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  scoreSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  scoreValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  remoteUpdateBanner: {
    minWidth: "70.4%",
    backgroundColor: "#d97706",
    borderColor: "#b45309",
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 29,
    shadowColor: "#7c2d12",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  remoteUpdateBannerText: {
    color: "#fffaf2",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
  },
  scoreDelta: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  scoreDeltaPositive: {
    color: "#15803d",
  },
  scoreDeltaNegative: {
    color: "#b91c1c",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7f8c8d",
    marginTop: -2,
    marginBottom: 8,
  },
  boardSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    minHeight: 0,
    position: "relative",
  },
  remoteUpdateBannerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 120,
    left: 12,
    right: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    elevation: 3,
  },
  swapModeBannerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 120,
    left: 12,
    right: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  bottomSection: {
    width: "100%",
  },
  tilesSection: {
    width: "100%",
    alignItems: "center",
  },
  waitingRackSection: {
    width: "100%",
    opacity: 0.42,
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
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  controlButtonTextLarge: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 18,
  },
  controlIcon: {
    width: CONTROL_ICON_SIZE,
    height: CONTROL_ICON_SIZE,
  },
  conflictOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  conflictCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 18,
    gap: 12,
  },
  conflictTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  conflictText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  conflictActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  conflictActionPrimary: {
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  conflictActionPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  conflictActionSecondary: {
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  conflictActionSecondaryText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
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

export default MultiplayerModeScreen;
