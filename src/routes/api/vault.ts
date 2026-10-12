import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { userFromRequest } from "@/lib/auth-user.server";

/** Owner-only: secret vault me key save karo. Value kabhi response me wapas nahi aati. */
export const Route = createFileRoute("/api/vault")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false },
          global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
        });
        const { data: owner } = await sb.rpc("is_owner", { _uid: user.id });
        if (!owner) return new Response("Owner only", { status: 403 });
        const body = (await request.json().catch(() => ({}))) as { name?: string; value?: string };
        if (!body.name || !body.value || body.value.length > 8000) return new Response("name + value required", { status: 400 });
        const { vaultSet, vaultList, safeSecretName } = await import("@/lib/vault.server");
        const name = safeSecretName(body.name);
        await vaultSet(name, body.value.trim());
        return Response.json({ saved: true, name, masked: "••••••••", names: await vaultList() });
      },
    },
  },
});
