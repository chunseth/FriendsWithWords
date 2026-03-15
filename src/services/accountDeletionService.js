import { ensureSupabaseSession, getSupabaseClient } from "../lib/supabase";
import { backendConfig, isBackendConfigured } from "../config/backend";

const DELETE_ACCOUNT_DEBUG = __DEV__ === true;

const logDeleteAccountDebug = (message, payload = null) => {
  if (!DELETE_ACCOUNT_DEBUG) {
    return;
  }
  if (payload == null) {
    console.log(`[delete-account] ${message}`);
    return;
  }
  console.log(`[delete-account] ${message}`, payload);
};

const describeToken = (token) => ({
  exists: typeof token === "string" && token.length > 0,
  length: typeof token === "string" ? token.length : 0,
  dotSegments: typeof token === "string" ? token.split(".").length : 0,
  prefix: typeof token === "string" ? token.slice(0, 8) : null,
});

const buildFunctionsBaseUrl = (supabaseUrl = "") => {
  const trimmed = String(supabaseUrl).trim().replace(/\/+$/, "");
  // Accept either project root URL or accidental API subpaths in env.
  return trimmed.replace(/\/(rest|auth)\/v1$/i, "");
};

const isLikelyJwt = (value) =>
  typeof value === "string" && value.split(".").length === 3;

const resolveVerifiedAccessToken = async (
  supabase,
  initialSession = null,
  source = "initial"
) => {
  const initialToken = initialSession?.access_token ?? null;
  logDeleteAccountDebug("verifying session token", {
    source,
    token: describeToken(initialToken),
  });
  if (isLikelyJwt(initialToken)) {
    const { data, error } = await supabase.auth.getUser(initialToken);
    if (!error && data?.user?.id) {
      logDeleteAccountDebug("token verification succeeded", {
        source,
        userId: data.user.id,
      });
      return { ok: true, accessToken: initialToken };
    }
    logDeleteAccountDebug("token verification failed", {
      source,
      error: error?.message ?? null,
    });
  }

  await supabase.auth.signOut({ scope: "local" });
  const reauthResult = await supabase.auth.signInAnonymously();
  const refreshedToken = reauthResult.data?.session?.access_token ?? null;
  logDeleteAccountDebug("reauth attempted", {
    source,
    reauthError: reauthResult.error?.message ?? null,
    token: describeToken(refreshedToken),
  });
  if (!isLikelyJwt(refreshedToken)) {
    return {
      ok: false,
      errorMessage:
        typeof reauthResult.error?.message === "string"
          ? `Could not refresh session: ${reauthResult.error.message}`
          : "Could not refresh a valid session token.",
    };
  }

  const { data, error } = await supabase.auth.getUser(refreshedToken);
  if (error || !data?.user?.id) {
    logDeleteAccountDebug("reauth token verification failed", {
      source,
      error: error?.message ?? null,
    });
    return {
      ok: false,
      errorMessage:
        typeof error?.message === "string"
          ? `Session verification failed: ${error.message}`
          : "Session verification failed after re-authentication.",
    };
  }

  logDeleteAccountDebug("reauth token verification succeeded", {
    source,
    userId: data.user.id,
  });
  return { ok: true, accessToken: refreshedToken };
};

const invokeDeleteAccountEndpoint = async ({ url, accessToken, anonKey }) => {
  logDeleteAccountDebug("calling delete-account endpoint", {
    url,
    token: describeToken(accessToken),
    anonKeyPrefix:
      typeof anonKey === "string" && anonKey.length > 0
        ? anonKey.slice(0, 8)
        : null,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const contentType = String(response.headers.get("content-type") ?? "");
  const gatewayProjectRef = response.headers.get("sb-project-ref") ?? null;
  const requestId = response.headers.get("sb-request-id") ?? null;
  const isJson = contentType.toLowerCase().includes("application/json");
  const parsedPayload = isJson ? await response.json() : await response.text();
  logDeleteAccountDebug("delete-account endpoint response", {
    status: response.status,
    contentType,
    gatewayProjectRef,
    requestId,
    payload:
      typeof parsedPayload === "string"
        ? parsedPayload
        : {
            code: parsedPayload?.code ?? null,
            error: parsedPayload?.error ?? null,
            message: parsedPayload?.message ?? null,
            details: parsedPayload?.details ?? null,
          },
  });

  if (!response.ok) {
    const payloadError =
      parsedPayload && typeof parsedPayload === "object"
        ? typeof parsedPayload.error === "string"
          ? parsedPayload.error.trim()
          : ""
        : "";
    const payloadDetails =
      parsedPayload && typeof parsedPayload === "object"
        ? typeof parsedPayload.details === "string"
          ? parsedPayload.details.trim()
          : ""
        : "";
    const payloadMessage =
      parsedPayload && typeof parsedPayload === "object"
        ? typeof parsedPayload.message === "string"
          ? parsedPayload.message.trim()
          : ""
        : "";
    const payloadCode =
      parsedPayload && typeof parsedPayload === "object"
        ? parsedPayload.code
        : null;
    const textFallback =
      typeof parsedPayload === "string" ? parsedPayload.trim() : "";
    const statusMessage =
      response.status === 404
        ? "Delete account function not found (404). Deploy the `delete-account` Edge Function to this Supabase project."
        : `Delete account request failed (${response.status}).`;
      return {
        ok: false,
        status: response.status,
        code: payloadCode,
        errorMessage:
          payloadError ||
          payloadDetails ||
          payloadMessage ||
          textFallback ||
          statusMessage,
      };
  }

  return {
    ok: true,
    data: parsedPayload && typeof parsedPayload === "object" ? parsedPayload : null,
  };
};

export const deleteRemoteAccount = async () => {
  if (!isBackendConfigured()) {
    return {
      ok: false,
      reason: "backend_not_configured",
      errorMessage: "Supabase is not configured for this app build.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      reason: "backend_not_configured",
      errorMessage: "Supabase is not configured for this app build.",
    };
  }

  const sessionResult = await ensureSupabaseSession();
  logDeleteAccountDebug("ensureSupabaseSession result", {
    ok: sessionResult.ok,
    reason: sessionResult.reason ?? null,
    hasSession: Boolean(sessionResult.session),
  });
  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: sessionResult.reason ?? "auth_failed",
      error: sessionResult.error ?? null,
      errorMessage:
        typeof sessionResult.error?.message === "string"
          ? sessionResult.error.message
          : "Could not authenticate your account for deletion.",
    };
  }

  const verifiedTokenResult = await resolveVerifiedAccessToken(
    supabase,
    sessionResult.session,
    "initial"
  );
  if (!verifiedTokenResult.ok) {
    return {
      ok: false,
      reason: "missing_access_token",
      errorMessage: verifiedTokenResult.errorMessage,
    };
  }
  const accessToken = verifiedTokenResult.accessToken;

  const endpointBase = buildFunctionsBaseUrl(backendConfig.supabaseUrl);
  const deleteAccountUrl = `${endpointBase}/functions/v1/delete-account`;
  logDeleteAccountDebug("resolved delete-account URL", { deleteAccountUrl });
  let data = null;
  try {
    let invokeResult = await invokeDeleteAccountEndpoint({
      url: deleteAccountUrl,
      accessToken,
      anonKey: backendConfig.supabaseAnonKey,
    });

    if (
      !invokeResult.ok &&
      invokeResult.status === 401 &&
      String(invokeResult.errorMessage ?? "").toLowerCase().includes("invalid jwt")
    ) {
      logDeleteAccountDebug("retrying after invalid JWT response");
      const retryTokenResult = await resolveVerifiedAccessToken(
        supabase,
        null,
        "retry"
      );
      if (!retryTokenResult.ok) {
        return {
          ok: false,
          reason: "reauth_failed",
          errorMessage: retryTokenResult.errorMessage,
        };
      }
      invokeResult = await invokeDeleteAccountEndpoint({
        url: deleteAccountUrl,
        accessToken: retryTokenResult.accessToken,
        anonKey: backendConfig.supabaseAnonKey,
      });
    }

    if (!invokeResult.ok) {
      return {
        ok: false,
        reason: "invoke_failed",
        errorMessage: invokeResult.errorMessage,
      };
    }

    data = invokeResult.data ?? null;
  } catch (error) {
    return {
      ok: false,
      reason: "invoke_failed",
      error,
      errorMessage:
        typeof error?.message === "string"
          ? error.message
          : "Could not reach the delete-account function.",
    };
  }

  const signOutResult = await supabase.auth.signOut();
  if (signOutResult.error) {
    const localSignOutResult = await supabase.auth.signOut({ scope: "local" });
    if (localSignOutResult.error) {
      return {
        ok: false,
        reason: "sign_out_failed",
        error: localSignOutResult.error,
        errorMessage:
          typeof localSignOutResult.error.message === "string"
            ? localSignOutResult.error.message
            : "Account deleted, but sign out failed.",
        data: data ?? null,
      };
    }
  }

  return { ok: true, data: data ?? null };
};
