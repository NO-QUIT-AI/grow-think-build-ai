import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  Save,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Memory = {
  id: string;
  prompt: string;
  project_type: string;
  code: string;
  summary: string;
  blueprint: Record<string, unknown>;
  version: number;
  created_at: string;
};

export function StudioPanel({
  userId,
  refreshKey,
  activeMemoryId,
  onMemorySaved,
}: {
  userId: string;
  refreshKey: number;
  activeMemoryId: string | null;
  onMemorySaved: () => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeId, setActiveId] = useState<string | null>(activeMemoryId);
  const [code, setCode] = useState("");
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from("memories")
      .select("id, prompt, project_type, code, summary, blueprint, version, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as unknown as Memory[]) ?? [];
        setMemories(rows);
      });
  }, [userId, refreshKey]);

  useEffect(() => {
    if (activeMemoryId) setActiveId(activeMemoryId);
  }, [activeMemoryId]);

  const active = useMemo(
    () => memories.find((m) => m.id === activeId) ?? memories[0] ?? null,
    [memories, activeId],
  );

  useEffect(() => {
    if (active) setCode(active.code);
  }, [active?.id]);

  const html = active?.project_type === "website" ? code : "";

  async function save() {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase.from("memories").update({ code }).eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error("Save nahi ho saka");
      return;
    }
    setMemories((prev) => prev.map((m) => (m.id === active.id ? { ...m, code } : m)));
    onMemorySaved();
    toast.success("Code save ho gaya");
  }

  function openInTab() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  function download() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(active?.prompt ?? "site").replace(/\s+/g, "-").toLowerCase()}.html`;
    link.click();
  }

  if (memories.length === 0) {
    return (
      <div className="panel mt-2 flex flex-col items-center gap-2 p-8 text-center">
        <Sparkles className="h-6 w-6 text-primary node-pulse" />
        <p className="text-sm font-medium">Studio cabin khali hai</p>
        <p className="text-xs text-muted-foreground">
          Chat me kaho: “mere coffee brand ki landing page bana do” — NO QUIT AI yahin live bana kar dikhayegi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          {memories.map((memory) => (
            <button
              key={memory.id}
              onClick={() => setActiveId(memory.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                memory.id === active?.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {memory.project_type} · {memory.prompt.slice(0, 22)}
              {memory.prompt.length > 22 ? "…" : ""}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
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
          {active?.project_type === "website" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Open preview" onClick={openInTab}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download HTML" onClick={download}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {active?.project_type !== "website" ? (
        <div className="panel flex-1 overflow-auto p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Code2 className="h-4 w-4 text-primary" /> Blueprint / Data
          </h3>
          <pre className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            {JSON.stringify(active?.blueprint ?? JSON.parse(active?.code || "{}"), null, 2)}
          </pre>
        </div>
      ) : (
        <Group orientation="horizontal" className="panel min-h-0 flex-1 overflow-hidden p-1">
          <Panel defaultSize="50" minSize="20" className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Code Editor</span>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
            <Textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="min-h-0 flex-1 resize-none rounded-xl border-border bg-secondary/50 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </Panel>
          <Separator className="mx-1 w-1 rounded-full bg-border transition hover:bg-primary" />
          <Panel defaultSize="50" minSize="20" className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${html ? "bg-green-500" : "bg-muted-foreground"}`} />
                <span className="text-[10px] text-muted-foreground">{html ? "Live" : "Empty"}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
              <div className={device === "mobile" ? "h-full w-full max-w-[390px]" : "h-full w-full"}>
                <iframe
                  key={`${active?.id}-${device}-${reloadKey}`}
                  title={active?.prompt ?? "Live preview"}
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms allow-popups"
                  className="h-full w-full bg-white"
                />
              </div>
            </div>
          </Panel>
        </Group>
      )}

      <div className="flex items-center gap-2 px-1 pb-1 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" />
        <span>
          Studio me changes save karne se memory update hoti hai. New version banane ke liye Builds tab se Improve use karein.
        </span>
      </div>
    </div>
  );
}
