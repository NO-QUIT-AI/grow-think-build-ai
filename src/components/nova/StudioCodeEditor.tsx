import { useEffect, useRef, useState } from "react";
import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker.js?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker.js?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker.js?worker";
import { Sparkles, Undo2, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { claudeFrames, editedCode } from "@/lib/studio-edit";

(globalThis as typeof globalThis & { MonacoEnvironment?: { getWorker: (module: string, label: string) => Worker } }).MonacoEnvironment = { getWorker: (_module: string, label: string) => {
  if (["html", "handlebars", "razor"].includes(label)) return new HtmlWorker();
  if (["css", "scss", "less"].includes(label)) return new CssWorker();
  if (["typescript", "javascript"].includes(label)) return new TsWorker();
  if (label === "json") return new JsonWorker();
  return new EditorWorker();
} };
loader.config({ monaco });

export default function StudioCodeEditor({ memoryId, code, baseCode, canUndo, onChange, onSaved }: {
  memoryId: string; code: string; baseCode: string; canUndo: boolean; onChange: (code: string) => void;
  onSaved: (code: string, canUndo: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [originalBase, setOriginalBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => () => abort.current?.abort(), []);
  async function call(body: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Sign in first.");
    const response = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ memoryId, ...body }), ...(signal ? { signal } : {}) });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error || `Studio error ${response.status}`); }
    return response;
  }
  async function generate() {
    if (!instruction.trim() || busy) return;
    setBusy(true); setError(""); setDraft(null); setOriginal(code); setOriginalBase(baseCode);
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await call({ action: "generate", code, instruction }, controller.signal);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Claude stream missing.");
      let buffer = "", text = "", completed = false;
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = claudeFrames(buffer); buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.type === "error") throw new Error(event.error?.message || "Claude request stopped.");
          if (event.delta?.stop_reason === "refusal") throw new Error("Claude declined this request.");
          if (event.delta?.stop_reason === "max_tokens") throw new Error("Edited file exceeds Claude's output budget. No changes applied.");
          if (event.delta?.type === "text_delta") { text += event.delta.text ?? ""; setDraft(text); }
          if (event.type === "message_stop") completed = true;
        }
      }
      if (!completed || !text.trim()) throw new Error("Claude did not complete the edit. No changes applied.");
      setDraft(editedCode(text));
    } catch (e) {
      setDraft(null);
      setError(controller.signal.aborted ? "Edit stopped. No changes applied." : e instanceof Error ? e.message : "Edit failed.");
    } finally { setBusy(false); abort.current = null; }
  }
  async function apply(undo = false) {
    if (applying || (!undo && draft === null)) return;
    if (!undo && code !== original) { setError("Code changed. Generate a fresh comparison."); return; }
    setApplying(true); setError("");
    try {
      const response = await call({ action: undo ? "file_undo" : "file_edit", code: undo ? code : draft, expected: undo ? baseCode : originalBase });
      const result = await response.json() as { code: string; canUndo: boolean };
      onSaved(result.code, result.canUndo); setDraft(null); setOpen(false); setInstruction("");
      toast.success(undo ? "Previous code restored" : "AI edit applied");
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setApplying(false); }
  }
  return <div className="studio-editor flex min-h-[440px] flex-1 flex-col overflow-hidden rounded-md border border-border">
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
      <span className="mr-auto font-mono text-xs text-muted-foreground">index.html</span>
      <Button variant="ghost" size="sm" disabled={!canUndo || busy || applying} title="Undo saved file edit" onClick={() => void apply(true)}><Undo2 /> Undo</Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Sparkles /> AI Edit</Button>
    </div>
    {open && <form className="flex flex-wrap items-center gap-2 border-b border-primary/40 bg-background p-2" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
      <Sparkles className="h-4 w-4 text-primary" />
      <input ref={inputRef} aria-label="AI edit instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Make this black, add NO QUIT brand…" disabled={busy || applying} className="min-w-0 basis-full bg-transparent text-sm outline-none" />
      {busy ? <Button type="button" size="sm" variant="outline" onClick={() => abort.current?.abort()}><X /> Stop</Button> : <Button size="sm" disabled={!instruction.trim() || applying}><Sparkles /> Generate</Button>}
      <Button type="button" size="icon" variant="ghost" aria-label="Close AI edit" disabled={busy || applying} onClick={() => { setOpen(false); setDraft(null); setError(""); }}><X /></Button>
    </form>}
    {error && <p role="alert" className="border-b border-border p-2 text-xs text-destructive">{error}</p>}
    {draft !== null ? <>
      <div className="flex items-center gap-2 border-b border-border p-2 text-xs">
        <span className="mr-auto text-muted-foreground">Original → Proposed {busy && "· Generating…"}</span>
        <Button variant="ghost" size="sm" disabled={busy || applying} onClick={() => setDraft(null)}><X /> Discard</Button>
        <Button size="sm" disabled={busy || applying} onClick={() => void apply()}>{applying ? <Loader2 className="animate-spin" /> : <Check />} Apply</Button>
      </div>
      <DiffEditor height="420px" original={original} modified={draft} originalModelPath={`studio/${memoryId}/original.html`} modifiedModelPath={`studio/${memoryId}/proposed.html`} keepCurrentOriginalModel keepCurrentModifiedModel language="html" theme="vs-dark" options={{ readOnly: true, renderSideBySide: false, minimap: { enabled: false }, automaticLayout: true, fontSize: 12, scrollBeyondLastLine: false }} />
    </> : <Editor height="420px" language="html" theme="vs-dark" value={code} onChange={(value) => onChange(value ?? "")} options={{ minimap: { enabled: false }, automaticLayout: true, wordWrap: "on", fontSize: 12, scrollBeyondLastLine: false }} onMount={(editor) => {
      editor.addAction({ id: "nqai-inline-edit", label: "NO QUIT AI Edit", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK], run: () => setOpen(true) });
    }} />}
  </div>;
}