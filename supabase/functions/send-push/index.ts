import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PushPayload = {
  user_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushResult = {
  id: string;
  provider: string;
  ok: boolean;
  error?: string;
  note?: string;
};

const base64UrlEncode = (value: ArrayBuffer | string): string => {
  let base64: string;
  if (typeof value === "string") {
    base64 = btoa(value);
  } else {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const normalizePem = (value: string): string =>
  value.includes("-----BEGIN PRIVATE KEY-----")
    ? value.replace(/\\n/g, "\n")
    : atob(value).replace(/\\n/g, "\n");

const pemToPkcs8Bytes = (pem: string): ArrayBuffer => {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
};

let cachedApnsToken: { token: string; generatedAtEpochSec: number } | null = null;

const buildApnsJwt = async ({
  teamId,
  keyId,
  privateKey,
}: {
  teamId: string;
  keyId: string;
  privateKey: string;
}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsToken && now - cachedApnsToken.generatedAtEpochSec < 50 * 60) {
    return cachedApnsToken.token;
  }

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8Bytes(normalizePem(privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedApnsToken = { token: jwt, generatedAtEpochSec: now };
  return jwt;
};

/** Legacy FCM API (deprecated). Prefer FCM v1 via FIREBASE_* env vars. */
const sendFcmLegacyPush = async ({
  token,
  title,
  body,
  data,
  serverKey,
}: {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  serverKey: string;
}) => {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data,
      priority: "high",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM push failed: ${response.status} ${text}`);
  }
};

let cachedGoogleAccessToken: {
  token: string;
  expiresAtEpochSec: number;
} | null = null;

/** Get OAuth2 access token for FCM v1 using service account credentials. */
const getGoogleAccessToken = async ({
  clientEmail,
  privateKeyPem,
}: {
  clientEmail: string;
  privateKeyPem: string;
}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (
    cachedGoogleAccessToken &&
    cachedGoogleAccessToken.expiresAtEpochSec > now + 60
  ) {
    return cachedGoogleAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 3600,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pem = normalizePem(privateKeyPem);
  const keyBytes = pemToPkcs8Bytes(pem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google OAuth2 token failed: ${tokenRes.status} ${text}`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error("Google OAuth2 response missing access_token");
  }
  cachedGoogleAccessToken = {
    token: accessToken,
    expiresAtEpochSec: now + (tokenData.expires_in ?? 3600) - 60,
  };
  return accessToken;
};

/** FCM HTTP v1 API (recommended). Uses service account OAuth2. */
const sendFcmV1Push = async ({
  token,
  title,
  body,
  data,
  projectId,
  accessToken,
}: {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  projectId: string;
  accessToken: string;
}) => {
  const dataStrings: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    dataStrings[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.keys(dataStrings).length ? dataStrings : undefined,
          android: { priority: "high" },
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM v1 push failed: ${response.status} ${text}`);
  }
};

const sendApnsPush = async ({
  token,
  title,
  body,
  data,
  bundleId,
  teamId,
  keyId,
  privateKey,
  useSandbox,
}: {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  bundleId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  useSandbox: boolean;
}) => {
  const jwt = await buildApnsJwt({ teamId, keyId, privateKey });
  const host = useSandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const response = await fetch(`${host}/3/device/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
      },
      ...data,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`APNs push failed: ${response.status} ${text}`);
  }
};

const looksLikeApnsDeviceToken = (token: string): boolean =>
  /^[a-f0-9]{64,}$/i.test(token);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const firebaseClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const firebasePrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
    const useFcmV1 =
      !!(firebaseProjectId && firebaseClientEmail && firebasePrivateKey);
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY");
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID");
    const apnsUseSandbox =
      (Deno.env.get("APNS_USE_SANDBOX") ?? "").toLowerCase() === "true";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json()) as PushPayload;
    const userId = payload.user_id;
    const title = payload.title ?? "Words With Real Friends";
    const body = payload.body ?? "You have a multiplayer update.";
    const data = payload.data ?? {};

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, provider, token")
      .eq("user_id", userId);

    if (tokenError) {
      throw tokenError;
    }

    const results: PushResult[] = [];

    for (const tokenRow of tokens ?? []) {
      try {
        if (tokenRow.provider === "fcm") {
          if (useFcmV1) {
            const accessToken = await getGoogleAccessToken({
              clientEmail: firebaseClientEmail!,
              privateKeyPem: firebasePrivateKey!,
            });
            await sendFcmV1Push({
              token: tokenRow.token,
              title,
              body,
              data,
              projectId: firebaseProjectId!,
              accessToken,
            });
          } else if (fcmServerKey) {
            await sendFcmLegacyPush({
              token: tokenRow.token,
              title,
              body,
              data,
              serverKey: fcmServerKey,
            });
          } else {
            throw new Error(
              "Configure FCM: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (v1) or FCM_SERVER_KEY (legacy)"
            );
          }
        } else if (tokenRow.provider === "apns") {
          if (!looksLikeApnsDeviceToken(tokenRow.token)) {
            if (useFcmV1) {
              const accessToken = await getGoogleAccessToken({
                clientEmail: firebaseClientEmail!,
                privateKeyPem: firebasePrivateKey!,
              });
              await sendFcmV1Push({
                token: tokenRow.token,
                title,
                body,
                data,
                projectId: firebaseProjectId!,
                accessToken,
              });
            } else if (fcmServerKey) {
              await sendFcmLegacyPush({
                token: tokenRow.token,
                title,
                body,
                data,
                serverKey: fcmServerKey,
              });
            } else {
              throw new Error(
                "Token is not APNs-shaped; configure FCM v1 (FIREBASE_*) or FCM_SERVER_KEY for fallback"
              );
            }
            results.push({
              id: tokenRow.id,
              provider: tokenRow.provider,
              ok: true,
              note: "sent_via_fcm_fallback",
            });
            continue;
          }
          if (!apnsTeamId || !apnsKeyId || !apnsPrivateKey || !apnsBundleId) {
            throw new Error(
              "APNS_TEAM_ID/APNS_KEY_ID/APNS_PRIVATE_KEY/APNS_BUNDLE_ID must be configured"
            );
          }
          await sendApnsPush({
            token: tokenRow.token,
            title,
            body,
            data,
            bundleId: apnsBundleId,
            teamId: apnsTeamId,
            keyId: apnsKeyId,
            privateKey: apnsPrivateKey,
            useSandbox: apnsUseSandbox,
          });
        } else {
          throw new Error(`Unsupported provider: ${tokenRow.provider}`);
        }

        results.push({ id: tokenRow.id, provider: tokenRow.provider, ok: true });
      } catch (error) {
        results.push({
          id: tokenRow.id,
          provider: tokenRow.provider,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, attempted: results.length, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected send-push failure.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
