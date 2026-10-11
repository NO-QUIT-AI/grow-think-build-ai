import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Camera, ChevronRight, FileText, Flashlight, Globe, Hammer, History, ImageIcon, Instagram,
  Link2, MessageCircle, Mic, Music, Phone, Plus, Radio, Search, FileSearch,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type Tool = { id: string; name: string; icon: typeof Plus; section: string };

const TOOLS: Tool[] = [
  { id: "new", name: "New Chat", icon: Plus, section: "QUICK CHAT" },
  { id: "history", name: "History", icon: History, section: "QUICK CHAT" },
  { id: "builds", name: "My Builds", icon: Hammer, section: "MY CREATIONS" },
  { id: "cvs", name: "My CVs", icon: FileText, section: "MY CREATIONS" },
  { id: "websites", name: "My Websites", icon: Globe, section: "MY CREATIONS" },
  { id: "domains", name: "My Domains", icon: Link2, section: "MY CREATIONS" },
  { id: "whatsapp", name: "WhatsApp Sender", icon: MessageCircle, section: "PHONE TOOLS" },
  { id: "call", name: "Call Dialer", icon: Phone, section: "PHONE TOOLS" },
  { id: "music", name: "Play Music", icon: Music, section: "PHONE TOOLS" },
  { id: "flash", name: "Flashlight", icon: Flashlight, section: "PHONE TOOLS" },
  { id: "camera", name: "Camera", icon: Camera, section: "PHONE TOOLS" },
  { id: "instagram", name: "Instagram Opener", icon: Instagram, section: "PHONE TOOLS" },
  { id: "jalsa", name: "Jalsa Mode (Offline Mesh)", icon: Radio, section: "PHONE TOOLS" },
  { id: "t2i", name: "Text to Image", icon: ImageIcon, section: "AI TOOLS" },
  { id: "pdf", name: "PDF Reader", icon: FileSearch, section: "AI TOOLS" },
  { id: "voice", name: "Voice Tools", icon: Mic, section: "AI TOOLS" },
  { id: "space", name: "Space Photo (NASA)", icon: ImageIcon, section: "AI TOOLS" },
];

/** Ask home page to switch its middle tab. */
export const OPEN_TAB_EVT = "nqai-open-tab";
/** Ask chat to prefill input / open voice. */
export const CHAT_ACTION_EVT = "nqai-chat-action";

export function ToolsMenu({ onNewChat, onClose, history }: { onNewChat: () => void; onClose: () => void; history: ReactNode }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [modal, setModal] = useState<"whatsapp" | "call" | null>(null);
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [jalsa, setJalsa] = useState(false);
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null);

  useEffect(() => setJalsa(localStorage.getItem("nqai_jalsa") === "1"), []);

  const list = useMemo(() => TOOLS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase().trim())), [q]);
  const sections = [...new Set(list.map((t) => t.section))];

  const tab = (v: string) => { window.dispatchEvent(new CustomEvent(OPEN_TAB_EVT, { detail: v })); onClose(); };
  const chat = (detail: { prefill?: string; voice?: boolean }) => { window.dispatchEvent(new CustomEvent(CHAT_ACTION_EVT, { detail })); onClose(); };
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  async function toggleTorch() {
    if (torch) { torch.stop(); setTorch(null); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const track = s.getVideoTracks()[0]; if (!track) throw new Error("no cam");
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      setTorch(track);
      toast.success("Flashlight ON — dobara tap = OFF");
    } catch {
      toast.error("Is phone/browser me flashlight support nahi");
    }
  }

  function run(id: string) {
    switch (id) {
      case "new": onNewChat(); return;
      case "history": setShowHistory((v) => !v); return;
      case "builds": case "websites": case "domains": tab("builds"); return;
      case "cvs": onClose(); void navigate({ to: "/cv" }); return;
      case "space": onClose(); void navigate({ to: "/space" }); return;
      case "whatsapp": case "call": setModal(id); return;
      case "music": open("https://music.youtube.com"); return;
      case "flash": void toggleTorch(); return;
      case "camera": {
        const i = document.createElement("input");
        i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.click();
        return;
      }
      case "instagram": open("https://instagram.com"); return;
      case "jalsa": {
        const v = !jalsa; setJalsa(v); localStorage.setItem("nqai_jalsa", v ? "1" : "0");
        toast(v ? "Jalsa Mode ON (offline mesh jald aa raha hai)" : "Jalsa Mode OFF");
        return;
      }
      case "t2i": chat({ prefill: "Ek image banao: " }); return;
      case "pdf": {
        const i = document.createElement("input");
        i.type = "file"; i.accept = "application/pdf";
        i.onchange = () => { const f = i.files?.[0]; if (f) open(URL.createObjectURL(f)); };
        i.click();
        return;
      }
      case "voice": chat({ voice: true }); return;
    }
  }

  const digits = phone.replace(/[^\d+]/g, "");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/50 p-3 pt-12">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tool search karo..." className="pl-9" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sections.map((s) => (
          <div key={s} className="mb-3">
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold tracking-widest text-muted-foreground">{s}</p>
            {list.filter((t) => t.section === s).map((t) => (
              <div key={t.id}>
                <button onClick={() => run(t.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-secondary/70">
                  <t.icon className="h-4 w-4 text-primary" />
                  <span className="flex-1">{t.name}</span>
                  {t.id === "jalsa" ? (
                    <Switch checked={jalsa} onClick={(e) => e.stopPropagation()} onCheckedChange={() => run("jalsa")} />
                  ) : (
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${t.id === "history" && showHistory ? "rotate-90" : ""}`} />
                  )}
                </button>
                {t.id === "history" && showHistory && <div className="ml-4 border-l border-border/50 pl-1">{history}</div>}
              </div>
            ))}
          </div>
        ))}
        {list.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">Koi tool nahi mila</p>}
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal === "call" ? "Call Dialer" : "WhatsApp Sender"}</DialogTitle></DialogHeader>
          <Input inputMode="tel" placeholder="+92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {modal === "whatsapp" && <Input placeholder="Message" value={msg} onChange={(e) => setMsg(e.target.value)} />}
          <button
            disabled={digits.length < 5}
            className="btn-green h-10 rounded-xl text-sm disabled:opacity-50"
            onClick={() => {
              if (modal === "call") window.location.href = `tel:${digits}`;
              else open(`https://wa.me/${digits.replace("+", "")}?text=${encodeURIComponent(msg)}`);
              setModal(null);
            }}
          >
            {modal === "call" ? "Call karo" : "WhatsApp pe bhejo"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
