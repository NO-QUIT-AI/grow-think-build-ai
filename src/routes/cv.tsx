import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  FileDown,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  ACCENTS,
  compressPhoto,
  cvFileName,
  deleteCv,
  downloadCvHtml,
  downloadCvPdf,
  emptyCv,
  listCvs,
  polishCv,
  renderCvHtml,
  saveCv,
  type CvData,
  type CvRecord,
} from "@/lib/cv";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: [
      { title: "CV Maker — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI CV Maker: apni tafseel bharo, photo add karo, AI se behtar karwao aur ek tap me professional CV PDF download karo.",
      },
      { property: "og:title", content: "CV Maker — NO QUIT AI" },
      {
        property: "og:description",
        content: "Build, update and download a professional CV as PDF with your photo in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CvPage,
});

function CvPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }
  return <CvBuilder userId={user.id} />;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl text-sm"
      />
    </label>
  );
}

function CvBuilder({ userId }: { userId: string }) {
  const [saved, setSaved] = useState<CvRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [data, setData] = useState<CvData>(emptyCv());
  const [busy, setBusy] = useState<"save" | "ai" | "photo" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listCvs(userId).then((rows) => {
      setSaved(rows);
      if (rows[0]) {
        setActiveId(rows[0].id);
        setData(rows[0].data);
      }
    });
  }, [userId]);

  const html = useMemo(() => renderCvHtml(data), [data]);

  function set<K extends keyof CvData>(key: K, value: CvData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Sirf image file chunein");
    setBusy("photo");
    try {
      set("photo", await compressPhoto(file));
      toast.success("Photo CV me lag gayi");
    } catch {
      toast.error("Photo add nahi ho saki");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save");
    try {
      const id = await saveCv(userId, activeId, data);
      setActiveId(id);
      setSaved(await listCvs(userId));
      toast.success("CV save ho gaya — kabhi bhi update kar sakte ho");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save nahi hua");
    } finally {
      setBusy(null);
    }
  }

  async function handlePolish() {
    setBusy("ai");
    try {
      const result = await polishCv(data);
      setData((prev) => ({
        ...prev,
        summary: result.summary || prev.summary,
        experience:
          result.experience && result.experience.length ? result.experience : prev.experience,
      }));
      toast.success("AI ne CV behtar kar diya — Save karna na bhoolein");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI se jawab nahi aaya");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    await deleteCv(id);
    const rows = await listCvs(userId);
    setSaved(rows);
    if (activeId === id) {
      setActiveId(rows[0]?.id ?? null);
      setData(rows[0]?.data ?? emptyCv());
    }
  }

  return (
    <CommunityShell userId={userId} title="CV Maker" subtitle="Banao, update karo, PDF download karo">
      <div className="flex flex-col gap-3">
        {/* Saved CVs */}
        <div className="panel flex flex-wrap items-center gap-2 p-2">
          {saved.map((item) => (
            <span
              key={item.id}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                item.id === activeId
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              <button
                onClick={() => {
                  setActiveId(item.id);
                  setData(item.data);
                }}
              >
                {item.title.slice(0, 24)}
              </button>
              <button aria-label="Delete CV" onClick={() => void handleDelete(item.id)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-full text-xs"
            onClick={() => {
              setActiveId(null);
              setData(emptyCv());
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Naya CV
          </Button>
        </div>

        {/* Photo + basics */}
        <div className="panel space-y-3 p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary">
              {data.photo ? (
                <img src={data.photo} alt="CV photo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <FileText className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  void pickPhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 rounded-xl text-xs"
                disabled={busy === "photo"}
                onClick={() => photoInput.current?.click()}
              >
                {busy === "photo" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Photo lagao
              </Button>
              {data.photo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => set("photo", "")}
                >
                  <X className="h-3 w-3" /> Photo hatao
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Poora naam" value={data.name} onChange={(v) => set("name", v)} placeholder="Ali Ahmad" />
            <Field label="Title / Role" value={data.role} onChange={(v) => set("role", v)} placeholder="Graphic Designer" />
            <Field label="Email" value={data.email} onChange={(v) => set("email", v)} placeholder="ali@gmail.com" />
            <Field label="Phone" value={data.phone} onChange={(v) => set("phone", v)} placeholder="+92 300 1234567" />
            <Field label="Sheher" value={data.location} onChange={(v) => set("location", v)} placeholder="Lahore, Pakistan" />
            <Field label="Link (portfolio/LinkedIn)" value={data.links} onChange={(v) => set("links", v)} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Color:</span>
            {ACCENTS.map((color) => (
              <button
                key={color}
                aria-label={`Accent ${color}`}
                onClick={() => set("accent", color)}
                className={`h-6 w-6 rounded-full border-2 ${
                  data.accent === color ? "border-primary" : "border-transparent"
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="panel space-y-2 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Profile / Summary</span>
          <Textarea
            value={data.summary}
            onChange={(event) => set("summary", event.target.value)}
            placeholder="Apne baare me 2-3 lines — tajruba, strength, kya kaam dhoond rahe ho."
            className="min-h-20 rounded-xl text-sm"
          />
        </div>

        {/* Experience */}
        <div className="panel space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Experience</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 rounded-xl text-xs"
              onClick={() =>
                set("experience", [...data.experience, { role: "", company: "", period: "", points: "" }])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {data.experience.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-border p-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <Field
                  label="Role"
                  value={item.role}
                  onChange={(v) =>
                    set(
                      "experience",
                      data.experience.map((row, i) => (i === index ? { ...row, role: v } : row)),
                    )
                  }
                />
                <Field
                  label="Company"
                  value={item.company}
                  onChange={(v) =>
                    set(
                      "experience",
                      data.experience.map((row, i) => (i === index ? { ...row, company: v } : row)),
                    )
                  }
                />
                <Field
                  label="Period"
                  value={item.period}
                  onChange={(v) =>
                    set(
                      "experience",
                      data.experience.map((row, i) => (i === index ? { ...row, period: v } : row)),
                    )
                  }
                  placeholder="2022 — Abhi tak"
                />
              </div>
              <Textarea
                value={item.points}
                placeholder="Har line ek point — jo kaam kiya, jo result mila."
                onChange={(event) =>
                  set(
                    "experience",
                    data.experience.map((row, i) =>
                      i === index ? { ...row, points: event.target.value } : row,
                    ),
                  )
                }
                className="min-h-20 rounded-xl text-sm"
              />
              {data.experience.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px] text-muted-foreground"
                  onClick={() =>
                    set(
                      "experience",
                      data.experience.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" /> Hatao
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Education */}
        <div className="panel space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Education</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 rounded-xl text-xs"
              onClick={() => set("education", [...data.education, { degree: "", school: "", period: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {data.education.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-border p-2 sm:grid-cols-3">
              <Field
                label="Degree"
                value={item.degree}
                onChange={(v) =>
                  set(
                    "education",
                    data.education.map((row, i) => (i === index ? { ...row, degree: v } : row)),
                  )
                }
              />
              <Field
                label="School / University"
                value={item.school}
                onChange={(v) =>
                  set(
                    "education",
                    data.education.map((row, i) => (i === index ? { ...row, school: v } : row)),
                  )
                }
              />
              <Field
                label="Period"
                value={item.period}
                onChange={(v) =>
                  set(
                    "education",
                    data.education.map((row, i) => (i === index ? { ...row, period: v } : row)),
                  )
                }
              />
            </div>
          ))}
        </div>

        {/* Skills */}
        <div className="panel grid gap-2 p-3 sm:grid-cols-2">
          <Field
            label="Skills (comma se alag)"
            value={data.skills}
            onChange={(v) => set("skills", v)}
            placeholder="Photoshop, Illustrator, Branding"
          />
          <Field
            label="Languages"
            value={data.languages}
            onChange={(v) => set("languages", v)}
            placeholder="Urdu, English"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="btn-green h-10 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
            onClick={() => downloadCvPdf(data)}
          >
            <FileDown className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            size="sm"
            className="h-10 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
            disabled={busy === "save"}
            onClick={() => void handleSave()}
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 flex-1 gap-1.5 rounded-xl border-primary/40 text-xs sm:flex-none"
            disabled={busy === "ai"}
            onClick={() => void handlePolish()}
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI se behtar karo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 flex-1 gap-1.5 rounded-xl border-primary/40 text-xs sm:flex-none"
            onClick={() => setShowPreview((prev) => !prev)}
          >
            <Eye className="h-4 w-4" /> {showPreview ? "Preview band" : "Preview"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
            onClick={() => downloadCvHtml(data)}
          >
            <FileText className="h-4 w-4" /> HTML
          </Button>
        </div>

        {showPreview && (
          <div className="panel overflow-hidden p-1">
            <iframe
              title={cvFileName(data)}
              srcDoc={html}
              sandbox=""
              className="h-[70vh] w-full rounded-xl bg-white"
            />
          </div>
        )}

        <p className="px-1 text-[11px] text-muted-foreground">
          Tip: “Download PDF” dabate hi print window khulegi — wahan se “Save as PDF” choose karein.
        </p>
      </div>
    </CommunityShell>
  );
}
