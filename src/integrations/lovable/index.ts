// Rebranded auth wrapper. No hosted editor auth SDK is used here.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const appAuth = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            ...(opts?.redirect_uri ? { redirectTo: opts.redirect_uri } : {}),
            ...(opts?.extraParams ? { queryParams: opts.extraParams } : {}),
          },
        });
        if (error) return { error: error instanceof Error ? error : new Error(String(error)) };
        return { redirected: true, data };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
