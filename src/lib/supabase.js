import { createClient } from "@supabase/supabase-js";
import { backendConfig, isBackendConfigured } from "../config/backend";

let supabaseClient = null;

export const getSupabaseClient = () => {
  if (!isBackendConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return supabaseClient;
};
