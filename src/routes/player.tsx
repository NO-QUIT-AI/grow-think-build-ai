import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type F = { key: string; name: string; size: number; url: string };

export const Route = createFileRoute("/player")({
  head: () => ({
    meta: [
      { title: "Cloud Player — NO QUIT AI" },
      { name: "description", content: "Upload videos to the cloud and play them instantly with NO QUIT AI." },
      { property: "og:title", content: "Cloud Player — NO QUIT AI" },
      { property: "og:description", content: "Upload videos to the cloud and play them instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Player,
});

function Player() {
  const [files, setFiles] = useState<F[]>([]);
  const [cur, setCur] = useState<F | null>(null);
  const [status, setStatus] = useState("");
  const [pct, setPct] = useState(0);

  const load = async () => {
    const r = await fetch("/api/public/r2-video");
    const d = await r.json();
    if (d.error) setStatus(d.error);
    setFiles(d.files ?? []);
  };
  useEffect(() => { load(); }, []);

  const upload = (file: File) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/public/r2-video");
    x.setRequestHeader("content-type", file.type || "video/mp4");
    x.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    x.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      const d = JSON.parse(x.responseText || "{}");
      if (x.status >= 300) return setStatus("Error: " + d.error);
      setStatus("Uploaded to R2!");
      setCur(d);
      load();
    };
    x.onerror = () => setStatus("Upload failed");
    setPct(0);
    setStatus("Uploading...");
    x.send(file);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="font-display text-2xl font-bold">Cloud Player</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border border-border bg-card p-3">
          <video key={cur?.url} src={cur?.url} controls playsInline className="aspect-video w-full rounded-xl bg-background" />
          <p className="mt-2 text-sm text-muted-foreground break-all">{cur?.name ?? "Video select ya upload karo"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-primary/50 p-4 text-center text-sm">
            Video choose karo
            <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-muted-foreground">{status}</p>
          <ul className="max-h-96 space-y-1 overflow-auto">
            {files.map((f) => (
              <li key={f.key}>
                <button onClick={() => setCur(f)} className={`w-full break-all rounded-lg p-2 text-left text-sm hover:bg-muted ${cur?.key === f.key ? "bg-muted" : ""}`}>
                  {f.name} <span className="text-muted-foreground">· {(f.size / 1048576).toFixed(1)} MB</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
