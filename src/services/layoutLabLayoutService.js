import { isBackendConfigured } from "../config/backend";
import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";

const LAYOUTS_TABLE = "layout_lab_saved_layouts";
const SUPPORTED_MODES = new Set(["classic", "mini"]);
const SUPPORTED_PREMIUM_TYPES = new Set(["center", "tw", "dw", "tl", "dl"]);

const normalizeMode = (mode) => (mode === "mini" ? "mini" : "classic");

const sanitizePremiumSquares = (premiumSquares = {}) => {
  if (!premiumSquares || typeof premiumSquares !== "object") {
    return {};
  }

  const entries = Object.entries(premiumSquares)
    .filter(([key, value]) => {
      if (!SUPPORTED_PREMIUM_TYPES.has(value)) return false;
      return typeof key === "string" && /^[0-9]+,[0-9]+$/.test(key);
    })
    .sort(([a], [b]) => {
      const [aRow, aCol] = a.split(",").map(Number);
      const [bRow, bCol] = b.split(",").map(Number);
      if (aRow !== bRow) return aRow - bRow;
      return aCol - bCol;
    });

  return Object.fromEntries(entries);
};

const countPremiumTypes = (premiumSquares = {}) => {
  const counts = { center: 0, tw: 0, dw: 0, tl: 0, dl: 0 };
  for (const value of Object.values(premiumSquares)) {
    if (counts[value] != null) {
      counts[value] += 1;
    }
  }
  return counts;
};

const inferBoardSize = (premiumSquares = {}, mode = "classic") => {
  const fallback = mode === "mini" ? 11 : 15;
  const keys = Object.keys(premiumSquares);
  if (!keys.length) return fallback;

  const maxIndex = keys.reduce((max, key) => {
    const [row, col] = key.split(",").map(Number);
    return Math.max(max, row, col);
  }, 0);

  return Math.max(fallback, maxIndex + 1);
};

export const saveLayoutLabLayout = async ({
  mode = "classic",
  premiumSquares = {},
  layoutName = null,
  seed = null,
  metadata = {},
} = {}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured" };
  }

  const normalizedMode = normalizeMode(mode);
  if (!SUPPORTED_MODES.has(normalizedMode)) {
    return { ok: false, reason: "invalid_mode" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured" };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
    };
  }

  const playerId = sessionResult.session?.user?.id;
  if (!playerId) {
    return { ok: false, reason: "auth_failed" };
  }

  const sanitizedSquares = sanitizePremiumSquares(premiumSquares);
  const boardSize = inferBoardSize(sanitizedSquares, normalizedMode);
  const nowIso = new Date().toISOString();
  const generatedName = `layout-${normalizedMode}-${nowIso.replace(/[:.]/g, "-")}`;
  const resolvedLayoutName =
    typeof layoutName === "string" && layoutName.trim().length > 0
      ? layoutName.trim()
      : generatedName;

  const payload = {
    player_id: playerId,
    mode_id: normalizedMode,
    layout_name: resolvedLayoutName,
    seed: typeof seed === "string" && seed.trim().length > 0 ? seed.trim() : null,
    board_size: boardSize,
    premium_squares: sanitizedSquares,
    tile_counts: countPremiumTypes(sanitizedSquares),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    saved_at: nowIso,
  };

  const { data, error } = await supabase
    .from(LAYOUTS_TABLE)
    .insert(payload)
    .select("id, layout_name, saved_at")
    .single();

  if (error) {
    return { ok: false, reason: "write_failed", error };
  }

  return {
    ok: true,
    id: data?.id ?? null,
    layoutName: data?.layout_name ?? resolvedLayoutName,
    savedAt: data?.saved_at ?? nowIso,
  };
};

export const fetchSavedLayoutLabLayouts = async ({
  mode = "classic",
  limit = 50,
} = {}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", layouts: [] };
  }

  const normalizedMode = normalizeMode(mode);
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", layouts: [] };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      layouts: [],
    };
  }

  const playerId = sessionResult.session?.user?.id;
  if (!playerId) {
    return { ok: false, reason: "auth_failed", layouts: [] };
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const { data, error } = await supabase
    .from(LAYOUTS_TABLE)
    .select("id, layout_name, mode_id, saved_at, premium_squares")
    .eq("player_id", playerId)
    .eq("mode_id", normalizedMode)
    .order("saved_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, layouts: [] };
  }

  const layouts = (data || []).map((entry) => ({
    id: entry.id,
    layoutName: entry.layout_name || "",
    mode: entry.mode_id || normalizedMode,
    savedAt: entry.saved_at || null,
    premiumSquares: sanitizePremiumSquares(entry.premium_squares || {}),
  }));

  return { ok: true, layouts };
};

export const fetchPlayableBoardVariants = async ({
  mode = "classic",
  limit = 100,
  excludedIds = [],
} = {}) => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured", variants: [] };
  }

  const normalizedMode = normalizeMode(mode);
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "backend_not_configured", variants: [] };
  }

  const sessionResult = await ensureSupabaseSession();
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      variants: [],
    };
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const excludedIdSet = new Set(
    Array.isArray(excludedIds)
      ? excludedIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : []
  );

  const { data, error } = await supabase
    .from(LAYOUTS_TABLE)
    .select("id, layout_name, mode_id, board_size, saved_at, premium_squares")
    .eq("mode_id", normalizedMode)
    .order("saved_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, reason: "fetch_failed", error, variants: [] };
  }

  const variants = (data || [])
    .filter((entry) => !excludedIdSet.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      layoutName: entry.layout_name || "",
      mode: entry.mode_id || normalizedMode,
      boardSize:
        typeof entry.board_size === "number" && entry.board_size > 0
          ? entry.board_size
          : inferBoardSize(entry.premium_squares || {}, normalizedMode),
      savedAt: entry.saved_at || null,
      premiumSquares: sanitizePremiumSquares(entry.premium_squares || {}),
    }));

  return { ok: true, variants };
};
