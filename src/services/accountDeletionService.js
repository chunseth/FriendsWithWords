import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { isBackendConfigured } from "../config/backend";

export const deleteRemoteAccount = async () => {
  if (!isBackendConfigured()) {
    return { ok: false, reason: "backend_not_configured" };
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

  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: {},
  });

  if (error) {
    return { ok: false, reason: "invoke_failed", error };
  }

  const signOutResult = await supabase.auth.signOut();
  if (signOutResult.error) {
    const localSignOutResult = await supabase.auth.signOut({ scope: "local" });
    if (localSignOutResult.error) {
      return {
        ok: false,
        reason: "sign_out_failed",
        error: localSignOutResult.error,
        data: data ?? null,
      };
    }
  }

  return { ok: true, data: data ?? null };
};
