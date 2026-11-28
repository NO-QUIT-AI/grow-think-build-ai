import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { backupToWorker } from "@/lib/worker-backup";
import { clearPrivateCaches } from "@/lib/local-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" && nextSession?.user) {
        const key = `nqai_login_backup_${nextSession.user.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          backupToWorker("login", { id: nextSession.user.id, email: nextSession.user.email ?? null });
        }
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearPrivateCaches();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
  return { session, user, loading, signOut };
}
