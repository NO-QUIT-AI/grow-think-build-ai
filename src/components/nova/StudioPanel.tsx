import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Monitor, Smartphone, Globe2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Site = {
  id: string;
  title: string;
  created_at: string;
  content: { name?: string; summary?: string; html?: string };
};

export function StudioPanel({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from("artifacts")
      .select("id, title, content, created_at")
      .eq("user_id", userId)
      .eq("kind", "website")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as unknown as Site[]) ?? [];
        setSites(rows);
        setActiveId((current) => current ?? rows[0]?.id ?? null);
      });
  }, [userId, refreshKey]);

  const active = useMemo(
    () => sites.find((site) => site.id === activeId) ?? sites[0] ?? null,
    [sites, activeId],
  );

  const html = active?.content?.html ?? "";

  function openInTab() {
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  function download() {
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(active?.title ?? "site").replace(/\s+/g, "-").toLowerCase()}.html`;
    link.click();
  }

  if (sites.length === 0) {
    return (
      <div className="panel mt-2 flex flex-col items-center gap-2 p-8 text-center">
        <Globe2 className="h-6 w-6 text-primary node-pulse" />
        <p className="text-sm font-medium">Studio cabin khali hai</p>
        <p className="text-xs text-muted-foreground">
          Chat me kaho: “mere coffee brand ki landing page bana do” — NO QUIT AI yahin live bana kar dikhayegi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sites.map((site) => (
          <button
            key={site.id}
            onClick={() => setActiveId(site.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
              site.id === active?.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            {site.title}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-secondary p-0.5">
          <Button
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Mobile preview"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Desktop preview"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Reload preview"
          onClick={() => setReloadKey((key) => key + 1)}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={openInTab}>
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={download}>
          <Download className="h-3.5 w-3.5" /> HTML
        </Button>
      </div>

      {active?.content?.summary ? (
        <p className="px-1 text-xs text-muted-foreground">{active.content.summary}</p>
      ) : null}

      <div className="panel overflow-hidden p-2">
        <div className={device === "mobile" ? "mx-auto w-full max-w-[390px]" : "w-full overflow-x-auto"}>
          <iframe
            key={`${active?.id}-${device}-${reloadKey}`}
            title={active?.title ?? "Live preview"}
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-popups"
            className="h-[70vh] rounded-xl border border-border bg-white"
            style={{ width: device === "mobile" ? "100%" : 1280, minHeight: 480 }}
          />
        </div>
      </div>
    </div>
  );
}
