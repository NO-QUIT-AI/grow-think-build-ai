import { useEffect, useState } from "react";
import { Crown, Loader2, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import galaxy from "@/assets/nqai-galaxy-avatar.jpg.asset.json";

type Kind = "fal" | "runway";
const ROUTE: Record<Kind, string> = { fal: "/api/fal-video", runway: "/api/runway-video" };
const PROMPT: Record<Kind, string> = {
  fal: "Cosmic galaxy swirling slowly around the person, gentle head nod, soft blink, cinematic glow",
  runway: "Dynamic cinematic intro, neon green light sweep, camera push-in, energetic tech reveal, NO QUIT AI vibe",
};

/** Pro-only video tools: fal (cheap galaxy video) + Runway (viral intro). */
export function ProVideoButtons({ title }: { title: string }) {
  const [pro, setPro] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [video, setVideo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data } = await supabase.from("user_plans").select("plan").eq("user_id", s.session.user.id).maybeSingle();
      setPro(data?.plan === "pro");
    })();
  }, []);

  async function run(kind: Kind) {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { toast.error("Pehle login karo"); return; }
    setBusy(kind);
    setVideo(null);
    try {
      const auth = { Authorization: `Bearer ${token}` };
      const res = await fetch(ROUTE[kind], {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          image_url: new URL(galaxy.url, window.location.origin).href,
          prompt: kind === "runway" ? `${PROMPT.runway}. Build: ${title}` : PROMPT.fal,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !j.id) throw new Error(j.error || "Video start nahi hui");
      toast.success("Video ban rahi hai… 1-3 minute");
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const p = await fetch(`${ROUTE[kind]}?id=${encodeURIComponent(j.id)}`, { headers: auth });
        const st = (await p.json().catch(() => ({}))) as { status?: string; video_url?: string };
        if (st.status === "COMPLETED" && st.video_url) {
          setVideo(st.video_url);
          toast.success("Video ready!");
          return;
        }
        if (st.status === "FAILED") throw new Error("Video fail ho gayi");
      }
      throw new Error("Time out — dobara try karo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  if (!pro) return null;

  return (
    <div className="panel flex w-full flex-col gap-2 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Crown className="h-3.5 w-3.5" /> Pro Video Tools
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs" disabled={!!busy} onClick={() => void run("fal")}>
          {busy === "fal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate Galaxy Resume Video (fal - cheap)
        </Button>
        <Button size="sm" className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs" disabled={!!busy} onClick={() => void run("runway")}>
          {busy === "runway" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          Generate Viral Intro (Runway - using my credits)
        </Button>
      </div>
      {video && (
        <div className="flex flex-col gap-2">
          <video src={video} controls playsInline className="max-h-96 w-full rounded-xl bg-background" />
          <a href={video} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
            Video download / open
          </a>
        </div>
      )}
    </div>
  );
}
