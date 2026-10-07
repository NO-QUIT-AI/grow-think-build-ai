import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileDown,
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
import { downloadHtmlAsPdf } from "@/lib/html-pdf";
import { downloadHtmlAsPng } from "@/lib/html-png";
import { ImageDown } from "lucide-react";
import { ViralVideoButton } from "@/components/nova/ViralVideoButton";
import { ProVideoButtons } from "@/components/nova/ProVideoButtons";

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
  const [pdfBusy, setPdfBusy] = useState(false);

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
    link.download = `${fileBase()}.html`;
    link.click();
  }

  /** Detects a CV/resume build so we can offer a PDF export. */
  const isCv = /\b(cv|resume|curriculum\s*vitae)\b/i.test(
    `${active?.prompt ?? ""} ${html.slice(0, 3000)}`,
  );

  /** Builds a clean file name — person ka naam CV me, warna prompt se. */
  function fileBase() {
    const heading = html.match(/<h1[^>]*>([^<]{2,60})<\/h1>/i)?.[1];
    const raw = (heading || active?.prompt || "build").replace(/&[a-z]+;/gi, " ");
    const slug =
      raw
        .replace(/[^a-zA-Z0-9\s-]/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join("-") || "build";
    return isCv ? `${slug}-CV` : slug;
  }

  /** Seedha PDF download — preview jaisa hi design, koi printer dialog nahi. */
  async function downloadPdf() {
    if (!html) return;
    setPdfBusy(true);
    try {
      await downloadHtmlAsPdf(html, `${fileBase()}.pdf`);
      toast.success("PDF download ho gaya");
    } catch {
      toast.error("PDF nahi ban saka");
    } finally {
      setPdfBusy(false);
    }
  }

  const [pngBusy, setPngBusy] = useState(false);
  /** App ya logo build ko PNG image me download karta hai. */
  async function downloadPng() {
    if (!html) return;
    setPngBusy(true);
    try {
      await downloadHtmlAsPng(html, `${fileBase()}.png`, device === "mobile" ? 420 : 1280);
      toast.success("PNG download ho gaya");
    } catch {
      toast.error("PNG nahi ban saka");
    } finally {
      setPngBusy(false);
    }
  }

  /** Puri build ko index.html + style.css + script.js ke ZIP me export karta hai. */
  async function downloadZip() {
    if (!html) return;
    const { default: JSZip } = await import("jszip");
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      .map((m) => m[1])
      .join("\n\n");
    const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1])
      .join("\n\n");

    let page = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi, "");
    if (styles.trim() && /<\/head>/i.test(page)) {
      page = page.replace(/<\/head>/i, '  <link rel="stylesheet" href="style.css" />\n</head>');
    }
    if (scripts.trim() && /<\/body>/i.test(page)) {
      page = page.replace(/<\/body>/i, '  <script src="script.js"></script>\n</body>');
    }

    const zip = new JSZip();
    zip.file("index.html", page);
    if (styles.trim()) zip.file("style.css", styles);
    if (scripts.trim()) zip.file("script.js", scripts);
    zip.file(
      "README.txt",
      `${active?.prompt ?? "NO QUIT AI build"}\n\nNO QUIT AI se banaya gaya. index.html ko browser me kholein.\n`,
    );

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileBase()}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
    toast.success("ZIP download ho gaya");
  }

  async function copyLink() {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copy ho gaya — isi browser me khulega");
    } catch {
      toast.error("Copy nahi ho saka");
    }
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

      {active?.project_type === "website" && html && (
        <div className="flex flex-wrap gap-2">
          {isCv && (
            <Button
              size="sm"
              className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
              disabled={pdfBusy}
              onClick={() => void downloadPdf()}
            >
              <FileDown className="h-4 w-4" /> Download PDF
            </Button>
          )}
          <Button
            size="sm"
            className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
            onClick={() => void downloadZip()}
          >
            <FileArchive className="h-4 w-4" /> Download ZIP
          </Button>
          <Button
            size="sm"
            className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
            disabled={pngBusy}
            onClick={() => void downloadPng()}
          >
            <ImageDown className="h-4 w-4" /> {pngBusy ? "..." : "Download PNG"}
          </Button>
          <ViralVideoButton html={html} title={(active?.summary || active?.prompt || "my app").slice(0, 60)} memoryId={active?.id} />
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 gap-1.5 rounded-xl border-primary/40 text-xs sm:flex-none"
            onClick={() => void copyLink()}
          >
            <Copy className="h-4 w-4" /> Copy Link
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 gap-1.5 rounded-xl border-primary/40 text-xs sm:flex-none"
            onClick={openInTab}
          >
            <ExternalLink className="h-4 w-4" /> Preview
          </Button>
          <ProVideoButtons title={(active?.summary || active?.prompt || "my app").slice(0, 80)} />
        </div>
      )}


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
