import { useEffect, useState } from "react";
import {
  Code2,
  ExternalLink,
  Globe,
  Heart,
  Layers,
  Loader2,
  MessageSquareQuote,
  Smartphone,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ShortcutAppDialog, type ShortcutTarget } from "@/components/nova/ShortcutAppDialog";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";

type Memory = {
  id: string;
  prompt: string;
  project_type: string;
  code: string;
  summary: string;
  blueprint: Record<string, unknown>;
  liked: boolean;
  version: number;
  created_at: string;
};

export function BuildsPanel({
  userId,
  refreshKey,
  onOpenStudio,
}: {
  userId: string;
  refreshKey: number;
  onOpenStudio: (memoryId: string) => void;
}) {
  const t = useT();
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState<ShortcutTarget | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("memories")
      .select("id, prompt, project_type, code, summary, blueprint, liked, version, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as unknown as Memory[]) ?? []);
        setLoading(false);
      });
  }, [userId, refreshKey]);

  async function toggleLike(id: string, liked: boolean) {
    const { error } = await supabase.from("memories").update({ liked: !liked }).eq("id", id);
    if (error) {
       toast.error(t("requestFailed"));
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, liked: !liked } : item)));
  }

  async function remove(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("memories").delete().eq("id", id);
    setDeleting(null);
    if (error) {
       toast.error(t("requestFailed"));
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function previewUrl(item: Memory) {
    if (item.project_type === "website") {
      const html = item.code || (item.blueprint?.['html'] as string) || "";
      return html ? URL.createObjectURL(new Blob([html], { type: "text/html" })) : null;
    }
    return null;
  }

  function openPreview(item: Memory) {
    const url = previewUrl(item);
    if (url) window.open(url, "_blank", "noopener");
  }

  function makeShortcut(item: Memory) {
    const html = item.code || (item.blueprint?.['html'] as string) || "";
    if (!html) {
       toast.error(t("noBuilds"));
      return;
    }
    setShortcut({ name: item.summary?.slice(0, 30) || item.prompt.slice(0, 30), html });
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="panel mt-2 flex flex-col items-center gap-2 p-8 text-center">
        <Layers className="h-6 w-6 text-primary node-pulse" />
         <p className="text-sm font-medium">{t("noBuilds")}</p>
        <p className="text-xs text-muted-foreground">
           {t("buildsHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      {items.map((item) => (
        <article key={item.id} className="panel p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {item.project_type === "domains" ? (
                <Globe className="h-4 w-4 text-primary" />
              ) : item.project_type === "blueprint" ? (
                <Layers className="h-4 w-4 text-accent" />
              ) : (
                <Code2 className="h-4 w-4 text-primary" />
              )}
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.project_type}
              </span>
              {item.version > 1 && (
                <span className="text-[10px] text-muted-foreground">v{item.version}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void toggleLike(item.id, item.liked)}
              >
                <Heart
                  className={`h-3.5 w-3.5 ${item.liked ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={deleting === item.id}
                onClick={() => void remove(item.id)}
              >
                {deleting === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <h3 className="mb-1 text-sm font-semibold leading-snug">{item.prompt}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{item.summary}</p>

          {item.project_type === "domains" && item.code && (
            <ul className="mb-3 space-y-2">
              {(JSON.parse(item.code) as { name: string; extension: string; reason: string }[]).map((entry) => (
                <li key={entry.name} className="rounded-xl bg-secondary/60 px-3 py-2">
                  <p className="text-sm font-medium">
                    {entry.name}
                    <span className="text-primary">{entry.extension}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.reason}</p>
                </li>
              ))}
            </ul>
          )}

          {item.project_type === "blueprint" && (
            <div className="mb-3 space-y-2 text-sm">
              <BuildSection title="Screens">
                {((item.blueprint?.['screens'] ?? []) as { title: string; purpose: string }[]).map((screen) => (
                  <li key={screen.title}>
                    <span className="font-medium">{screen.title}</span> — {screen.purpose}
                  </li>
                ))}
              </BuildSection>
              <BuildSection title="Features">
                {((item.blueprint?.['features'] ?? []) as string[]).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </BuildSection>
              <div className="flex flex-wrap gap-1.5">
                {((item.blueprint?.['tech_stack'] ?? []) as string[]).map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {item.project_type === "website" && (
              <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => openPreview(item)}>
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </Button>
            )}
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onOpenStudio(item.id)}>
              <Code2 className="h-3.5 w-3.5" /> Code
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled>
              <Wand2 className="h-3.5 w-3.5" /> Improve
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled>
              <MessageSquareQuote className="h-3.5 w-3.5" /> Deploy
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function BuildSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="ml-4 list-disc space-y-1 text-muted-foreground">{children}</ul>
    </div>
  );
}
