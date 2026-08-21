import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type BroadcastPayload = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  user_ids?: string[];
  limit?: number;
  offset?: number;
  dry_run?: boolean;
};

type BroadcastResult = {
  user_id: string;
  ok: boolean;
  attempted?: number;
  successful?: number;
  error?: string;
};

const parseInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const readBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bearerToken = readBearerToken(request);
    const apikey = request.headers.get("apikey");
    if (bearerToken !== serviceRoleKey || apikey !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await request.json()) as BroadcastPayload;
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const data =
      payload.data &&
      typeof payload.data === "object" &&
      !Array.isArray(payload.data)
        ? payload.data
        : {};
    const dryRun = payload.dry_run !== false;
    const requestedUserIds = asStringArray(payload.user_ids);
    const limit = parseInteger(payload.limit, 100, 1, 500);
    const offset = parseInteger(payload.offset, 0, 0, 1_000_000);

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Missing title or body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rpcParams = {
      p_limit: limit,
      p_offset: offset,
      p_user_ids: requestedUserIds.length > 0 ? requestedUserIds : null,
    };
    const { data: recipientRows, error: recipientError } = await supabase.rpc(
      "list_broadcast_push_recipients",
      rpcParams
    );

    if (recipientError) {
      throw recipientError;
    }

    const userIds = Array.from(
      new Set(
        (recipientRows ?? []).map((row) => String(row.user_id)).filter(Boolean)
      )
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          targeted_users: userIds.length,
          limit,
          offset,
          next_offset: userIds.length === limit ? offset + limit : null,
          user_ids: userIds,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: BroadcastResult[] = [];
    for (const userId of userIds) {
      const sendPushResponse = await fetch(
        `${supabaseUrl}/functions/v1/send-push`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title,
            body,
            data: {
              ...data,
              type: typeof data.type === "string" ? data.type : "broadcast",
            },
          }),
        }
      );

      if (!sendPushResponse.ok) {
        const text = await sendPushResponse.text();
        results.push({
          user_id: userId,
          ok: false,
          error: `send-push returned ${sendPushResponse.status}: ${text.slice(
            0,
            200
          )}`,
        });
        continue;
      }

      const sendPushBody = (await sendPushResponse.json()) as {
        attempted?: number;
        results?: Array<{ ok?: boolean }>;
      };
      const successfulCount = (sendPushBody.results ?? []).filter(
        (item) => item?.ok
      ).length;
      results.push({
        user_id: userId,
        ok: successfulCount > 0,
        attempted: sendPushBody.attempted ?? 0,
        successful: successfulCount,
        error:
          successfulCount > 0 ? undefined : "send_push_no_successful_tokens",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: false,
        targeted_users: userIds.length,
        sent_users: results.filter((result) => result.ok).length,
        failed_users: results.filter((result) => !result.ok).length,
        limit,
        offset,
        next_offset: userIds.length === limit ? offset + limit : null,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected broadcast-push failure.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
