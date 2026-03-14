import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSeededRandom,
  createShuffledTileBag,
  drawTilesFromBag,
  shuffleArray,
} from "../game/shared/bag";
import {
  createClassicPremiumSquares,
  createEmptyBoard,
} from "../game/shared/premiumSquares";
import { calculateConsistencyBonusTotal } from "../game/shared/scoring";
import {
  loadMultiplayerSession,
  saveMultiplayerSession,
} from "../utils/multiplayerSessionStorage";
import {
  loadRemoteMultiplayerSession,
  commitRemoteMultiplayerTurn,
  subscribeToRemoteMultiplayerSession,
} from "../services/multiplayerSessionService";
import { isBackendConfigured } from "../config/backend";
import { ensureSupabaseSession } from "../lib/supabase";

const SESSION_SCHEMA_VERSION = 1;
const MULTIPLAYER_MODE_ID = "async_coop_shared_score";

const createTurnLogEntry = ({
  turnNumber,
  actorId,
  actorName,
  action,
  scoreDelta,
  words = [],
  tilesDrawn = 0,
}) => ({
  id: `turn-${turnNumber}`,
  turnNumber,
  actorId,
  actorName,
  action,
  scoreDelta,
  words,
  tilesDrawn,
  createdAt: Date.now(),
});

const getRackPenaltyTotal = (players = []) =>
  players.reduce(
    (total, player) =>
      total +
      (player?.rack ?? []).reduce(
        (playerTotal, tile) => playerTotal + (tile?.value ?? 0),
        0
      ),
    0
  );

const buildWordHistoryFromTurns = (turnHistory = []) =>
  (turnHistory ?? []).flatMap((entry) =>
    (entry?.words ?? []).map((wordEntry) => ({
      turn: entry?.turnNumber,
      score: wordEntry?.score ?? 0,
    }))
  );

const createInitialSession = ({
  seed = "async-coop-prototype",
  sessionId = "local-multiplayer-prototype",
  gameType = "seeded",
  players = null,
} = {}) => {
  const { random, tileBag } = createShuffledTileBag(seed);
  const playerOneDraw = drawTilesFromBag(tileBag, 7, 0, "player-1");
  const playerTwoDraw = drawTilesFromBag(
    playerOneDraw.nextBag,
    7,
    playerOneDraw.nextTileId,
    "player-2"
  );
  const firstPlayerId = players?.[0]?.id ?? "player-1";

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    modeId: MULTIPLAYER_MODE_ID,
    sessionId,
    seed,
    gameType,
    isDailySeed: gameType === "daily",
    status: "active",
    sharedBoard: createEmptyBoard(),
    sharedPremiumSquares: createClassicPremiumSquares(),
    sharedScore: {
      total: 0,
      wordPointsTotal: 0,
      swapPenaltyTotal: 0,
      scrabbleBonusTotal: 0,
      consistencyBonusTotal: 0,
      turnPenaltyTotal: 0,
      rackPenaltyTotal: 0,
      finalScore: null,
    },
    players: [
      {
        id: players?.[0]?.id ?? "player-1",
        username: players?.[0]?.username ?? null,
        displayName: players?.[0]?.displayName ?? "Player 1",
        rack: playerOneDraw.drawnTiles.map((tile, rackIndex) => ({
          ...tile,
          rackIndex,
        })),
        contribution: {
          pointsScored: 0,
          wordsPlayed: 0,
          turnsTaken: 0,
          swapsUsed: 0,
        },
        readiness: "active",
      },
      {
        id: players?.[1]?.id ?? "player-2",
        username: players?.[1]?.username ?? null,
        displayName: players?.[1]?.displayName ?? "Player 2",
        rack: playerTwoDraw.drawnTiles.map((tile, rackIndex) => ({
          ...tile,
          rackIndex,
        })),
        contribution: {
          pointsScored: 0,
          wordsPlayed: 0,
          turnsTaken: 0,
          swapsUsed: 0,
        },
        readiness: "waiting",
      },
    ],
    turn: {
      number: 1,
      activePlayerId: firstPlayerId,
      passStreak: 0,
      pendingAction: null,
      lockedAt: null,
      lastCompletedTurnId: null,
    },
    bag: {
      tiles: playerTwoDraw.nextBag,
      remainingCount: playerTwoDraw.nextBag.length,
      randomState: random.getState(),
      nextTileId: playerTwoDraw.nextTileId,
    },
    history: [
      createTurnLogEntry({
        turnNumber: 0,
        actorId: "system",
        actorName: "System",
        action: "session_started",
        scoreDelta: 0,
      }),
    ],
    boardRevision: 0,
    savedAt: Date.now(),
    lastMoveSummary: null,
  };
};

export const getActivePlayer = (session) =>
  session.players.find((player) => player.id === session.turn.activePlayerId) ??
  null;

export const getWaitingPlayer = (session) =>
  session.players.find((player) => player.id !== session.turn.activePlayerId) ??
  null;

const getTotalSwapsUsed = (session) =>
  Array.isArray(session?.players)
    ? session.players.reduce(
        (total, player) => total + (player?.contribution?.swapsUsed ?? 0),
        0
      )
    : 0;

export const resolveLocalPlayerId = ({
  session,
  authenticatedUserId = null,
  fallbackPlayerId = "player-1",
}) => {
  if (!session || !Array.isArray(session.players) || session.players.length === 0) {
    return fallbackPlayerId;
  }

  if (
    authenticatedUserId &&
    session.players.some((player) => player.id === authenticatedUserId)
  ) {
    return authenticatedUserId;
  }

  if (session.players.some((player) => player.id === fallbackPlayerId)) {
    return fallbackPlayerId;
  }

  return session.players[0]?.id ?? fallbackPlayerId;
};

export const useAsyncCoopSession = ({
  sessionId = "local-multiplayer-prototype",
} = {}) => {
  const [session, setSession] = useState(() => createInitialSession({ sessionId }));
  const [localPlayerId, setLocalPlayerId] = useState("player-1");
  const [remoteUpdateEvent, setRemoteUpdateEvent] = useState(null);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const hasHydratedRef = useRef(false);
  const lastRemoteSessionSignatureRef = useRef(null);
  const sessionRef = useRef(session);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const hookInstanceIdRef = useRef(
    `coop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    console.log("[multiplayer-lifecycle] useAsyncCoopSession mounted", {
      hookInstanceId: hookInstanceIdRef.current,
      sessionId,
    });

    return () => {
      console.log("[multiplayer-lifecycle] useAsyncCoopSession unmounted", {
        hookInstanceId: hookInstanceIdRef.current,
        sessionId,
      });
    };
  }, [sessionId]);

  const activePlayer = useMemo(() => getActivePlayer(session), [session]);
  const waitingPlayer = useMemo(() => getWaitingPlayer(session), [session]);
  const localPlayer = useMemo(
    () => session.players.find((player) => player.id === localPlayerId) ?? null,
    [localPlayerId, session.players]
  );

  const canLocalPlayerAct =
    session.status === "active" && session.turn.activePlayerId === localPlayerId;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    console.log("[multiplayer-lifecycle] hydrate effect start", {
      hookInstanceId: hookInstanceIdRef.current,
      sessionId,
    });

    const hydrate = async () => {
      hasHydratedRef.current = false;
      let authenticatedUserId = null;
      if (isBackendConfigured()) {
        const sessionResult = await ensureSupabaseSession();
        if (sessionResult.ok) {
          authenticatedUserId = sessionResult.session?.user?.id ?? null;
        }
      }

      const savedSession = isBackendConfigured()
        ? (await loadRemoteMultiplayerSession(sessionId)).session
        : await loadMultiplayerSession();
      if (cancelled) {
        return;
      }

      const hydratedSession = savedSession ?? createInitialSession({ sessionId });
      if (!savedSession && !isBackendConfigured()) {
        await saveMultiplayerSession(hydratedSession);
      }

      if (!hydratedSession) {
        hasHydratedRef.current = true;
        return;
      }

      setSession(hydratedSession);
      lastRemoteSessionSignatureRef.current = `${hydratedSession.boardRevision ?? 0}:${hydratedSession.savedAt ?? 0}`;
      setLocalPlayerId(
        resolveLocalPlayerId({
          session: hydratedSession,
          authenticatedUserId,
          fallbackPlayerId: "player-1",
        })
      );
      hasHydratedRef.current = true;
    };

    hydrate();

    return () => {
      console.log("[multiplayer-lifecycle] hydrate effect cleanup", {
        hookInstanceId: hookInstanceIdRef.current,
        sessionId,
      });
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!isBackendConfigured() || !sessionId) {
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    let statusResolved = false;
    console.log("[multiplayer-lifecycle] subscription effect start", {
      hookInstanceId: hookInstanceIdRef.current,
      sessionId,
      subscriptionAttempt,
    });

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimeoutRef.current != null) {
        return;
      }

      const delay = Math.min(10000, 1000 * 2 ** reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setSubscriptionAttempt((current) => current + 1);
      }, delay);
    };

    const startSubscription = async () => {
      const result = await subscribeToRemoteMultiplayerSession(
        sessionId,
        (remoteSession) => {
          if (cancelled || !remoteSession) {
            return;
          }

          setSession((currentSession) => {
            const currentRevision = currentSession?.boardRevision ?? 0;
            const remoteRevision = remoteSession?.boardRevision ?? 0;
            if (remoteRevision <= currentRevision) {
              return currentSession;
            }

            const actor =
              remoteSession.players?.find(
                (player) =>
                  player.id === remoteSession.lastMoveSummary?.actorId
              ) ?? null;
            const actorLabel = actor?.username
              ? `@${actor.username}`
              : actor?.displayName ??
                remoteSession.lastMoveSummary?.actorName ??
                "Your teammate";

            lastRemoteSessionSignatureRef.current = `${remoteRevision}:${remoteSession.savedAt ?? 0}`;
            setRemoteUpdateEvent({
              id: `${remoteRevision}:${remoteSession.savedAt ?? 0}`,
              actorLabel,
              action: remoteSession.lastMoveSummary?.action ?? null,
              words: remoteSession.lastMoveSummary?.words ?? [],
            });
            return remoteSession;
          });
        },
        (status) => {
          if (cancelled) {
            return;
          }

          if (status === "SUBSCRIBED") {
            statusResolved = true;
            reconnectAttemptRef.current = 0;
            clearReconnectTimeout();
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            if (!statusResolved || status !== "CLOSED") {
              scheduleReconnect();
            }
          }
        }
      );

      if (result.ok) {
        unsubscribe = result.unsubscribe;
        return;
      }

      scheduleReconnect();
    };

    startSubscription();

    return () => {
      console.log("[multiplayer-lifecycle] subscription effect cleanup", {
        hookInstanceId: hookInstanceIdRef.current,
        sessionId,
        subscriptionAttempt,
      });
      cancelled = true;
      clearReconnectTimeout();
      unsubscribe();
    };
  }, [sessionId, subscriptionAttempt]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    saveMultiplayerSession(session);
  }, [session]);

  const rotateActivePlayer = useCallback((currentSession) => {
    const currentIndex = currentSession.players.findIndex(
      (player) => player.id === currentSession.turn.activePlayerId
    );
    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + 1) % currentSession.players.length
        : 0;
    return currentSession.players[nextIndex]?.id ?? currentSession.turn.activePlayerId;
  }, []);

  const resolveCanAct = useCallback(
    (currentSession) => {
      if (currentSession.status !== "active") {
        return { ok: false, reason: "session_not_active" };
      }

      if (currentSession.turn.activePlayerId !== localPlayerId) {
        return { ok: false, reason: "not_active_player" };
      }

      return { ok: true };
    },
    [localPlayerId]
  );

  const commitNextSession = useCallback(
    async ({ action, currentSession, nextSession }) => {
      if (!nextSession) {
        return { ok: false, reason: "commit_failed", session: null };
      }

      if (!isBackendConfigured()) {
        setSession(nextSession);
        return { ok: true, session: nextSession };
      }

      const result = await commitRemoteMultiplayerTurn({
        sessionId,
        expectedRevision: currentSession.boardRevision ?? 0,
        action,
        nextSession,
      });

      if (!result.ok) {
        if (result.reason === "revision_conflict" && result.session) {
          const remoteRevision = result.session.boardRevision ?? 0;
          setSession(result.session);
          lastRemoteSessionSignatureRef.current = `${remoteRevision}:${result.session.savedAt ?? 0}`;
          setRemoteUpdateEvent({
            id: `conflict-${Date.now()}-${remoteRevision}`,
            actorLabel: "Session updated on another device.",
            action: "conflict",
            words: [],
          });
        }
        return result;
      }

      const committedSession = result.session ?? nextSession;
      setSession(committedSession);
      lastRemoteSessionSignatureRef.current = `${committedSession.boardRevision ?? 0}:${committedSession.savedAt ?? 0}`;
      return { ok: true, session: committedSession };
    },
    [sessionId]
  );

  const buildHandOffSession = useCallback(
    (currentSession, { action, scoreDelta = 0, words = [], tilesDrawn = 0 }) => {
      const actor = getActivePlayer(currentSession);
      if (!actor) {
        return null;
      }

      const nextActivePlayerId = rotateActivePlayer(currentSession);
      const nextTurnNumber = currentSession.turn.number + 1;
      const nextPassStreak =
        action === "pass" ? currentSession.turn.passStreak + 1 : 0;
      const nextHistoryEntry = createTurnLogEntry({
        turnNumber: currentSession.turn.number,
        actorId: actor.id,
        actorName: actor.displayName,
        action,
        scoreDelta,
        words,
        tilesDrawn,
      });
      const drawCount =
        action === "play" || action === "swap" ? Math.max(0, tilesDrawn) : 0;
      const refillResult = drawTilesFromBag(
        currentSession.bag.tiles ?? [],
        drawCount,
        currentSession.bag.nextTileId ?? 0,
        actor.id
      );

      const nextPlayers = currentSession.players.map((player) => {
        if (player.id === actor.id) {
          const trimmedRack =
            drawCount > 0 ? player.rack.slice(drawCount) : player.rack;
          return {
            ...player,
            rack: [...trimmedRack, ...refillResult.drawnTiles].map(
              (tile, rackIndex) => ({
                ...tile,
                rackIndex,
              })
            ),
            contribution: {
              ...player.contribution,
              pointsScored: player.contribution.pointsScored + scoreDelta,
              wordsPlayed: player.contribution.wordsPlayed + words.length,
              turnsTaken: player.contribution.turnsTaken + 1,
              swapsUsed:
                player.contribution.swapsUsed + (action === "swap" ? 1 : 0),
            },
            readiness: "waiting",
          };
        }

        if (player.id === nextActivePlayerId) {
          return {
            ...player,
            readiness: "active",
          };
        }

        return player;
      });

      const completesSession = nextPassStreak >= 2;
      if (completesSession) {
        const rackPenaltyTotal = getRackPenaltyTotal(nextPlayers);
        const nextHistory = [...currentSession.history, nextHistoryEntry];
        const consistencyBonusTotal = calculateConsistencyBonusTotal({
          turnCount: currentSession.turn.number,
          wordHistory: buildWordHistoryFromTurns(nextHistory),
        });
        const finalScore =
          currentSession.sharedScore.total +
          scoreDelta -
          rackPenaltyTotal +
          consistencyBonusTotal;

        return {
          ...currentSession,
          status: "completed",
          players: nextPlayers.map((player) => ({
            ...player,
            readiness: "waiting",
          })),
          sharedScore: {
            ...currentSession.sharedScore,
            total: finalScore,
            consistencyBonusTotal,
            rackPenaltyTotal,
            finalScore,
          },
          turn: {
            number: nextTurnNumber,
            activePlayerId: nextActivePlayerId,
            passStreak: nextPassStreak,
            pendingAction: null,
            lockedAt: null,
            lastCompletedTurnId: nextHistoryEntry.id,
          },
          bag: {
            ...currentSession.bag,
            tiles: refillResult.nextBag,
            remainingCount: refillResult.nextBag.length,
            nextTileId: refillResult.nextTileId,
          },
          history: nextHistory,
          lastMoveSummary: nextHistoryEntry,
          boardRevision: currentSession.boardRevision + 1,
          savedAt: Date.now(),
        };
      }

      return {
        ...currentSession,
        players: nextPlayers,
        sharedScore: {
          ...currentSession.sharedScore,
          total: currentSession.sharedScore.total + scoreDelta,
        },
        turn: {
          number: nextTurnNumber,
          activePlayerId: nextActivePlayerId,
          passStreak: nextPassStreak,
          pendingAction: null,
          lockedAt: null,
          lastCompletedTurnId: nextHistoryEntry.id,
        },
        bag: {
          ...currentSession.bag,
          tiles: refillResult.nextBag,
          remainingCount: refillResult.nextBag.length,
          nextTileId: refillResult.nextTileId,
        },
        history: [...currentSession.history, nextHistoryEntry],
        lastMoveSummary: nextHistoryEntry,
        boardRevision: currentSession.boardRevision + 1,
        savedAt: Date.now(),
      };
    },
    [rotateActivePlayer]
  );

  const buildResolvedPlaySession = useCallback(
    (currentSession, payload) => {
      const actor = getActivePlayer(currentSession);
      if (!actor) {
        return null;
      }

      const nextActivePlayerId = rotateActivePlayer(currentSession);
      const nextHistoryEntry = createTurnLogEntry({
        turnNumber: currentSession.turn.number,
        actorId: actor.id,
        actorName: actor.displayName,
        action: "play",
        scoreDelta: payload.turnScore,
        words: payload.newWords.map((wordData) => ({
          word: wordData.word.toUpperCase(),
          score:
            payload.newHistory.find(
              (entry) => entry.word === wordData.word.toUpperCase()
            )?.score ?? 0,
        })),
        tilesDrawn: payload.drawnTiles.length,
      });

      const nextPlayers = currentSession.players.map((player) => {
        if (player.id === actor.id) {
          return {
            ...player,
            rack: payload.resultingRack,
            contribution: {
              ...player.contribution,
              pointsScored: player.contribution.pointsScored + payload.turnScore,
              wordsPlayed: player.contribution.wordsPlayed + payload.newWords.length,
              turnsTaken: player.contribution.turnsTaken + 1,
            },
            readiness: "waiting",
          };
        }

        if (player.id === nextActivePlayerId) {
          return {
            ...player,
            readiness: "active",
          };
        }

        return player;
      });

      const completesSession =
        payload.nextBag.length === 0 && payload.resultingRack.length === 0;

      if (completesSession) {
        const rackPenaltyTotal = getRackPenaltyTotal(nextPlayers);
        const nextHistory = [...currentSession.history, nextHistoryEntry];
        const consistencyBonusTotal = calculateConsistencyBonusTotal({
          turnCount: currentSession.turn.number,
          wordHistory: buildWordHistoryFromTurns(nextHistory),
        });
        const finalScore =
          currentSession.sharedScore.total +
          payload.turnScore -
          rackPenaltyTotal +
          consistencyBonusTotal;

        return {
          ...currentSession,
          status: "completed",
          sharedBoard: payload.resolvedBoard,
          sharedPremiumSquares: payload.newPremiumSquares,
          sharedScore: {
            ...currentSession.sharedScore,
            total: finalScore,
            wordPointsTotal:
              currentSession.sharedScore.wordPointsTotal + payload.baseWordScore,
            scrabbleBonusTotal:
              currentSession.sharedScore.scrabbleBonusTotal + payload.scrabbleBonus,
            consistencyBonusTotal,
            rackPenaltyTotal,
            finalScore,
          },
          players: nextPlayers.map((player) => ({
            ...player,
            readiness: "waiting",
          })),
          turn: {
            number: currentSession.turn.number + 1,
            activePlayerId: nextActivePlayerId,
            passStreak: 0,
            pendingAction: null,
            lockedAt: null,
            lastCompletedTurnId: nextHistoryEntry.id,
          },
          bag: {
            ...currentSession.bag,
            tiles: payload.nextBag,
            remainingCount: payload.nextBag.length,
            nextTileId: payload.nextTileId,
          },
          history: nextHistory,
          lastMoveSummary: nextHistoryEntry,
          boardRevision: currentSession.boardRevision + 1,
          savedAt: Date.now(),
        };
      }

      return {
        ...currentSession,
        sharedBoard: payload.resolvedBoard,
        sharedPremiumSquares: payload.newPremiumSquares,
        sharedScore: {
          ...currentSession.sharedScore,
          total: currentSession.sharedScore.total + payload.turnScore,
          wordPointsTotal:
            currentSession.sharedScore.wordPointsTotal + payload.baseWordScore,
          scrabbleBonusTotal:
            currentSession.sharedScore.scrabbleBonusTotal + payload.scrabbleBonus,
        },
        players: nextPlayers,
        turn: {
          number: currentSession.turn.number + 1,
          activePlayerId: nextActivePlayerId,
          passStreak: 0,
          pendingAction: null,
          lockedAt: null,
          lastCompletedTurnId: nextHistoryEntry.id,
        },
        bag: {
          ...currentSession.bag,
          tiles: payload.nextBag,
          remainingCount: payload.nextBag.length,
          nextTileId: payload.nextTileId,
        },
        history: [...currentSession.history, nextHistoryEntry],
        lastMoveSummary: nextHistoryEntry,
        boardRevision: currentSession.boardRevision + 1,
        savedAt: Date.now(),
      };
    },
    [rotateActivePlayer]
  );

  const completeMockPlay = useCallback(async () => {
    const currentSession = sessionRef.current;
    const canAct = resolveCanAct(currentSession);
    if (!canAct.ok) {
      return canAct;
    }

    const nextSession = buildHandOffSession(currentSession, {
      action: "play",
      scoreDelta: 24,
      words: [{ word: "VIBE", score: 24 }],
      tilesDrawn: 4,
    });

    return commitNextSession({
      action: "play",
      currentSession,
      nextSession,
    });
  }, [buildHandOffSession, commitNextSession, resolveCanAct]);

  const completeMockSwap = useCallback(async () => {
    const currentSession = sessionRef.current;
    const canAct = resolveCanAct(currentSession);
    if (!canAct.ok) {
      return canAct;
    }

    const nextSession = buildHandOffSession(currentSession, {
      action: "swap",
      scoreDelta: -3,
      words: [],
      tilesDrawn: 3,
    });

    return commitNextSession({
      action: "swap",
      currentSession,
      nextSession,
    });
  }, [buildHandOffSession, commitNextSession, resolveCanAct]);

  const completeMockPass = useCallback(async () => {
    const currentSession = sessionRef.current;
    const canAct = resolveCanAct(currentSession);
    if (!canAct.ok) {
      return canAct;
    }

    const nextSession = buildHandOffSession(currentSession, {
      action: "pass",
      scoreDelta: 0,
      words: [],
      tilesDrawn: 0,
    });

    return commitNextSession({
      action: "pass",
      currentSession,
      nextSession,
    });
  }, [buildHandOffSession, commitNextSession, resolveCanAct]);

  const submitResolvedPlay = useCallback(
    async (payload) => {
      if (!payload) {
        return { ok: false, reason: "invalid_payload" };
      }

      const currentSession = sessionRef.current;
      const canAct = resolveCanAct(currentSession);
      if (!canAct.ok) {
        return canAct;
      }

      const nextSession = buildResolvedPlaySession(currentSession, payload);
      if (!nextSession) {
        return { ok: false, reason: "play_failed" };
      }

      return commitNextSession({
        action: "play",
        currentSession,
        nextSession,
      });
    },
    [buildResolvedPlaySession, commitNextSession, resolveCanAct]
  );

  const passTurn = useCallback(async () => {
    const currentSession = sessionRef.current;
    const canAct = resolveCanAct(currentSession);
    if (!canAct.ok) {
      return canAct;
    }

    const nextSession = buildHandOffSession(currentSession, {
      action: "pass",
      scoreDelta: 0,
      words: [],
      tilesDrawn: 0,
    });

    return commitNextSession({
      action: "pass",
      currentSession,
      nextSession,
    });
  }, [buildHandOffSession, commitNextSession, resolveCanAct]);

  const submitSwapTurn = useCallback(
    async ({ selectedRackIndices = [] } = {}) => {
      if (!Array.isArray(selectedRackIndices) || selectedRackIndices.length === 0) {
        return { ok: false, reason: "no_tiles_selected" };
      }

      const currentSession = sessionRef.current;
      const canAct = resolveCanAct(currentSession);
      if (!canAct.ok) {
        return canAct;
      }

      const actor = getActivePlayer(currentSession);
      if (!actor) {
        return { ok: false, reason: "swap_failed" };
      }

      const bagTiles = currentSession.bag.tiles ?? [];
      if (bagTiles.length === 0) {
        return { ok: false, reason: "bag_empty" };
      }

      const swapTileCount = Math.min(selectedRackIndices.length, bagTiles.length);
      const indicesToRemove = [...selectedRackIndices]
        .filter((index) => Number.isInteger(index) && index >= 0)
        .sort((a, b) => a - b)
        .slice(0, swapTileCount);

      if (indicesToRemove.length === 0) {
        return { ok: false, reason: "no_tiles_selected" };
      }

      const removedTiles = indicesToRemove
        .map((rackIndex) => actor.rack[rackIndex])
        .filter(Boolean)
        .map((tile, idx) => ({ ...tile, rackIndex: indicesToRemove[idx] }));

      if (removedTiles.length === 0) {
        return { ok: false, reason: "swap_failed" };
      }

      const returnedTiles = removedTiles.map((tile) => ({
        letter: tile.letter,
        value: tile.value,
      }));
      const random = createSeededRandom(
        currentSession.seed,
        currentSession.bag.randomState ?? 0
      );
      const nextBag = shuffleArray([...bagTiles, ...returnedTiles], random.next);
      const drawnTiles = [];
      let nextTileId = currentSession.bag.nextTileId ?? 0;

      for (let i = 0; i < removedTiles.length; i += 1) {
        const tile = nextBag.pop();
        if (!tile) break;
        drawnTiles.push({
          ...tile,
          id: actor.id ? `${actor.id}-${nextTileId}` : nextTileId,
        });
        nextTileId += 1;
      }

      const remainingRack = actor.rack.filter(
        (_, index) => !indicesToRemove.includes(index)
      );
      const multiplier = getTotalSwapsUsed(currentSession) + 1;
      const baseScorePenalty = removedTiles.reduce(
        (sum, tile) => sum + (tile?.value ?? 0),
        0
      );
      const scorePenalty = baseScorePenalty * multiplier;
      const scoreDelta = -scorePenalty;
      const nextActivePlayerId = rotateActivePlayer(currentSession);
      const nextHistoryEntry = createTurnLogEntry({
        turnNumber: currentSession.turn.number,
        actorId: actor.id,
        actorName: actor.displayName,
        action: "swap",
        scoreDelta,
        words: [],
        tilesDrawn: drawnTiles.length,
      });

      const nextPlayers = currentSession.players.map((player) => {
        if (player.id === actor.id) {
          return {
            ...player,
            rack: [...remainingRack, ...drawnTiles].map((tile, rackIndex) => ({
              ...tile,
              rackIndex,
            })),
            contribution: {
              ...player.contribution,
              pointsScored: player.contribution.pointsScored + scoreDelta,
              turnsTaken: player.contribution.turnsTaken + 1,
              swapsUsed: player.contribution.swapsUsed + 1,
            },
            readiness: "waiting",
          };
        }

        if (player.id === nextActivePlayerId) {
          return {
            ...player,
            readiness: "active",
          };
        }

        return player;
      });

      const nextSession = {
        ...currentSession,
        players: nextPlayers,
        sharedScore: {
          ...currentSession.sharedScore,
          total: currentSession.sharedScore.total + scoreDelta,
          swapPenaltyTotal:
            (currentSession.sharedScore.swapPenaltyTotal ?? 0) + scorePenalty,
        },
        turn: {
          number: currentSession.turn.number + 1,
          activePlayerId: nextActivePlayerId,
          passStreak: 0,
          pendingAction: null,
          lockedAt: null,
          lastCompletedTurnId: nextHistoryEntry.id,
        },
        bag: {
          ...currentSession.bag,
          tiles: nextBag,
          remainingCount: nextBag.length,
          nextTileId,
          randomState: random.getState(),
        },
        history: [...currentSession.history, nextHistoryEntry],
        lastMoveSummary: nextHistoryEntry,
        boardRevision: currentSession.boardRevision + 1,
        savedAt: Date.now(),
      };

      return commitNextSession({
        action: "swap",
        currentSession,
        nextSession,
      });
    },
    [commitNextSession, resolveCanAct, rotateActivePlayer]
  );

  return {
    session,
    localPlayerId,
    setLocalPlayerId,
    localPlayer,
    activePlayer,
    waitingPlayer,
    canLocalPlayerAct,
    remoteUpdateEvent,
    submitResolvedPlay,
    submitSwapTurn,
    passTurn,
    completeMockPlay,
    completeMockSwap,
    completeMockPass,
  };
};

export { MULTIPLAYER_MODE_ID, SESSION_SCHEMA_VERSION, createInitialSession };
